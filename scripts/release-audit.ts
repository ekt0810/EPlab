import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { pool } from "../apps/api/src/db.js";
import { config } from "../apps/api/src/config.js";
const mode = process.argv[2];
if (!["before", "after"].includes(mode)) throw new Error("Use before or after");
const out = path.join(config.root, "work/practice-release");
await fs.mkdir(out, { recursive: true });
try {
  const database = (await pool.query("SELECT current_database() AS name"))
    .rows[0].name;
  if (database !== "eplab")
    throw new Error("Expected the configured production database");
  const preserved: Record<string, any> = {};
  for (const table of [
    "users",
    "entitlements",
    "orders",
    "lab_memberships",
    "exercises",
    "assignments",
    "submissions",
    "submission_reviews",
    "practice_threads",
    "practice_messages",
    "progress",
  ]) {
    const rows = (
      await pool.query(`SELECT row_to_json(t) AS value FROM ${table} t`)
    ).rows
      .map((r) => {
        if (table === "submissions") delete r.value.self_checks;
        return JSON.stringify(r.value);
      })
      .sort();
    preserved[table] = {
      count: rows.length,
      sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex"),
    };
  }
  const audit = {
    checkedAt: new Date().toISOString(),
    database,
    preserved,
    migrations: (
      await pool.query("SELECT name FROM migrations ORDER BY name")
    ).rows.map((r) => r.name),
  };
  if (mode === "after") {
    const before = JSON.parse(
      await fs.readFile(path.join(out, "before-database.json"), "utf8"),
    );
    for (const table of Object.keys(preserved)) {
      if (
        JSON.stringify(preserved[table]) !==
        JSON.stringify(before.preserved[table])
      )
        throw new Error(`Preserved data changed: ${table}`);
    }
  }
  await fs.writeFile(
    path.join(out, mode + "-database.json"),
    JSON.stringify(audit, null, 2),
  );
  console.log(
    JSON.stringify({
      mode,
      status: "passed",
      tables: Object.fromEntries(
        Object.entries(preserved).map(([k, v]) => [k, v.count]),
      ),
      migrations: audit.migrations.length,
    }),
  );
} finally {
  await pool.end();
}
