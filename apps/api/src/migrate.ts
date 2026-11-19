import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pool, tx } from "./db.js";
import { config } from "./config.js";
export async function migrate() {
  const dir = path.join(config.root, "apps/api/migrations");
  await tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(8493021)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz DEFAULT now())",
    );
    for (const name of (await fs.readdir(dir))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const source = await fs.readFile(path.join(dir, name), "utf8");
      const checksum = createHash("sha256").update(source).digest("hex");
      const previous = (
        await c.query("SELECT checksum FROM migrations WHERE name=$1", [name])
      ).rows[0];
      if (previous) {
        if (previous.checksum !== checksum)
          throw new Error(`Migration đã thay đổi: ${name}`);
        continue;
      }
      await c.query(source);
      await c.query("INSERT INTO migrations(name,checksum) VALUES($1,$2)", [
        name,
        checksum,
      ]);
    }
  });
}
if (
  process.argv[1]?.endsWith("migrate.ts") ||
  process.argv[1]?.endsWith("migrate.js")
) {
  await migrate();
  console.log("Migration hoàn tất.");
  await pool.end();
}
