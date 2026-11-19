import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { password as promptPassword } from "@inquirer/prompts";
import { config } from "../apps/api/src/config.js";
import { pool } from "../apps/api/src/db.js";
import { storage } from "../apps/api/src/storage.js";
import { TABLES, seal, digest } from "./backup-format.js";
export async function backup(
  password: string,
  destination = path.join(config.root, "backups"),
) {
  await fs.mkdir(destination, { recursive: true });
  const client = await pool.connect();
  let oldMaintenance = false;
  let maintenanceChanged = false;
  try {
    await client.query("SELECT pg_advisory_lock(8493027)");
    oldMaintenance = (
      await pool.query("SELECT value FROM settings WHERE key='maintenance'")
    ).rows[0].value;
    await pool.query(
      "UPDATE settings SET value='true' WHERE key='maintenance'",
    );
    maintenanceChanged = true;
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
    const tablesPresent = (
      await client.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public'",
      )
    ).rows.map((r) => r.tablename);
    const available = TABLES.filter((t) => tablesPresent.includes(t));
    const classroomInstalled = (
      await client.query(
        "SELECT EXISTS(SELECT 1 FROM migrations WHERE name='013_interactive_classroom.sql') AS installed",
      )
    ).rows[0].installed;
    // Allow a pre-release backup before the additive classroom migration.
    for (const t of TABLES)
      if (
        !tablesPresent.includes(t) &&
        (classroomInstalled || !t.startsWith("classroom_"))
      )
        throw new Error(`Missing backup table: ${t}`);
    await client.query(
      `LOCK TABLE ${available.map((t) => `"${t}"`).join(",")} IN SHARE MODE`,
    );
    const tables: Record<string, any[]> = {};
    for (const table of available)
      tables[table] = (
        await client.query({
          text: `SELECT * FROM "${table}"`,
          // Preserve PostgreSQL microseconds; JS Date would truncate to milliseconds.
          types: {
            getTypeParser: (oid: number, format?: any) =>
              [1114, 1184].includes(oid)
                ? (value: string) => value
                : pg.types.getTypeParser(oid, format),
          },
        })
      ).rows;
    const files: Record<string, { data: string; sha256: string }> = {};
    let size = 0;
    for (const r of tables.resources) {
      const stream = await storage.get(r.storage_key);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) {
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > 128 * 1024 * 1024)
          throw new Error(
            "Backup ứng dụng giới hạn 128 MB tài liệu. Dùng quy trình pg_dump/object-storage trong tài liệu cho dữ liệu lớn.",
          );
        chunks.push(buffer);
      }
      const bytes = Buffer.concat(chunks);
      if (digest(bytes) !== r.sha256)
        throw new Error(`Checksum tài liệu không khớp: ${r.id}`);
      files[r.storage_key] = {
        data: bytes.toString("base64"),
        sha256: digest(bytes),
      };
    }
    const snapshot = {
      version: 1,
      createdAt: new Date().toISOString(),
      database: (await client.query("SELECT current_database() AS name"))
        .rows[0].name,
      migrations: (
        await client.query("SELECT name,checksum FROM migrations ORDER BY name")
      ).rows,
      tables,
      files,
    };
    const bytes = seal(snapshot, password);
    const name = `eplab-${new Date().toISOString().replace(/[:.]/g, "-")}.eplab`;
    const output = path.join(destination, name);
    await fs.writeFile(output, bytes, { flag: "wx", mode: 0o600 });
    await fs.writeFile(output + ".sha256", digest(bytes) + "  " + name + "\n");
    await client.query("COMMIT");
    const retention = Number(process.env.BACKUP_RETAIN || 14);
    if (!Number.isInteger(retention) || retention < 1)
      throw new Error("BACKUP_RETAIN phải >=1");
    const candidates = (await fs.readdir(destination))
      .filter((n) => /^eplab-\d{4}-.*\.eplab$/.test(n))
      .sort()
      .reverse();
    for (const old of candidates.slice(retention)) {
      const resolved = path.resolve(destination, old);
      if (path.dirname(resolved) !== path.resolve(destination))
        throw new Error("Unsafe backup rotation path");
      await fs.unlink(resolved);
      await fs.unlink(resolved + ".sha256").catch(() => {});
    }
    if (process.env.BACKUP_DESTINATION) {
      const other = path.resolve(process.env.BACKUP_DESTINATION);
      if (other !== path.resolve(destination)) {
        await fs.mkdir(other, { recursive: true });
        await fs.copyFile(output, path.join(other, name));
        await fs.copyFile(
          output + ".sha256",
          path.join(other, name + ".sha256"),
        );
        if (digest(await fs.readFile(path.join(other, name))) !== digest(bytes))
          throw new Error("Checksum bản sao ngoài máy không khớp.");
      }
    }
    return {
      file: output,
      checksum: digest(bytes),
      rows: Object.fromEntries(available.map((t) => [t, tables[t].length])),
      resources: Object.keys(files).length,
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    try {
      if (maintenanceChanged)
        await pool.query(
          "UPDATE settings SET value=$1::jsonb WHERE key='maintenance'",
          [JSON.stringify(oldMaintenance)],
        );
    } finally {
      await client.query("SELECT pg_advisory_unlock(8493027)").catch(() => {});
      client.release();
    }
  }
}
if (process.argv[1]?.endsWith("backup.ts")) {
  try {
    const result = await backup(
      process.env.BACKUP_PASSWORD ||
        (await promptPassword({
          message: "Mật khẩu mã hóa backup (>=16 ký tự):",
          mask: "*",
        })),
    );
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}
