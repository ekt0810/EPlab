import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
import { password as promptPassword } from "@inquirer/prompts";
import { TABLES, unseal, digest } from "./backup-format.js";
dotenv.config({ quiet: true });
if (!process.env.RESTORE_DATABASE_URL)
  throw new Error(
    "Cần RESTORE_DATABASE_URL trỏ tới database trống riêng. Không phục hồi đè database đang dùng.",
  );
if (!process.env.RESTORE_DATA_DIR)
  throw new Error("Cần RESTORE_DATA_DIR riêng cho tài liệu phục hồi.");
process.env.DATABASE_URL = process.env.RESTORE_DATABASE_URL;
process.env.DATA_DIR = process.env.RESTORE_DATA_DIR;
const { pool } = await import("../apps/api/src/db.js");
const { migrate } = await import("../apps/api/src/migrate.js");
const { config } = await import("../apps/api/src/config.js");
const { storage } = await import("../apps/api/src/storage.js");
const file = process.argv[2];
if (!file) throw new Error("Cách dùng: npm run restore -- đường-dẫn.eplab");
const encrypted = await fs.readFile(path.resolve(file));
const checksum = (
  await fs.readFile(path.resolve(file) + ".sha256", "utf8")
).split(/\s/)[0];
if (digest(encrypted) !== checksum)
  throw new Error("Checksum backup không khớp.");
const snapshot = unseal(
  encrypted,
  process.env.BACKUP_PASSWORD ||
    (await promptPassword({ message: "Mật khẩu giải mã backup:", mask: "*" })),
);
if (snapshot.version !== 1) throw new Error("Phiên bản backup không hỗ trợ.");
const written: string[] = [];
try {
  await migrate();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `LOCK TABLE ${TABLES.map((t) => `"${t}"`).join(",")} IN ACCESS EXCLUSIVE MODE`,
    );
    for (const table of TABLES.filter((t) => t !== "settings")) {
      const count = (
        await client.query(`SELECT count(*)::int AS n FROM "${table}"`)
      ).rows[0].n;
      if (count)
        throw new Error(`Database đích không trống: ${table}. Không ghi đè.`);
    }
    for (const m of snapshot.migrations) {
      const local = (
        await client.query("SELECT checksum FROM migrations WHERE name=$1", [
          m.name,
        ])
      ).rows[0];
      if (!local || local.checksum !== m.checksum)
        throw new Error(`Migration không tương thích: ${m.name}`);
    }
    await client.query("DELETE FROM settings");
    for (const table of TABLES) {
      const cols = (
        await client.query(
          "SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",
          [table],
        )
      ).rows;
      const allowed = new Map(cols.map((c) => [c.column_name, c.data_type]));
      for (const row of snapshot.tables[table] || []) {
        const names = Object.keys(row);
        if (names.some((n) => !allowed.has(n)))
          throw new Error(`Cột không tương thích trong ${table}`);
        const values = names.map((n) =>
          ["json", "jsonb"].includes(allowed.get(n) as string)
            ? JSON.stringify(row[n])
            : row[n],
        );
        await client.query(
          `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(",")}) ${["practice_messages", "classroom_messages"].includes(table) ? "OVERRIDING SYSTEM VALUE " : ""}VALUES(${names.map((_, i) => "$" + (i + 1)).join(",")})`,
          values,
        );
      }
    }
    for (const [key, entry] of Object.entries(snapshot.files) as [
      string,
      any,
    ][]) {
      const bytes = Buffer.from(entry.data, "base64");
      if (digest(bytes) !== entry.sha256)
        throw new Error("Checksum tài liệu không đúng.");
      await storage.put(key, bytes);
      written.push(key);
    }
    const max = (
      await client.query(
        "SELECT COALESCE(max(id),0)::text AS id FROM audit_logs",
      )
    ).rows[0].id;
    await client.query(
      "SELECT setval(pg_get_serial_sequence('audit_logs','id'),$1,$2)",
      [Math.max(1, Number(max)), Number(max) > 0],
    );
    await client.query(
      "SELECT setval(pg_get_serial_sequence('practice_messages','id'),GREATEST(COALESCE(max(id),0),1),COALESCE(max(id),0)>0) FROM practice_messages",
    );
    await client.query(
      "SELECT setval(pg_get_serial_sequence('classroom_messages','id'),GREATEST(COALESCE(max(id),0),1),COALESCE(max(id),0)>0) FROM classroom_messages",
    );
    // Reauthentication is deliberate after migration. MFA secrets need original SECRET_KEY.
    await client.query("DELETE FROM sessions");
    await client.query("DELETE FROM tokens");
    await client.query(
      "UPDATE settings SET value='true' WHERE key='maintenance'",
    );
    await client.query("COMMIT");
    console.log(
      JSON.stringify(
        {
          status: "restored",
          database: new URL(process.env.DATABASE_URL!).pathname,
          dataDir: config.data,
          resources: written.length,
          maintenance: true,
          sessionsRevoked: true,
        },
        null,
        2,
      ),
    );
  } catch (e) {
    await client.query("ROLLBACK");
    for (const key of written) await storage.remove(key).catch(() => {});
    throw e;
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
