import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { pool } from "../apps/api/src/db.js";
import { config } from "../apps/api/src/config.js";
// Read-only snapshot comparison. Does not restart processes or alter application data.
const snapshot: Record<string, { count: number; digest: string }> = {};
try {
  for (const table of [
    "users",
    "courses",
    "chapters",
    "lessons",
    "resources",
    "progress",
    "orders",
    "payment_transactions",
    "entitlements",
    "settings",
    "kicad_lessons",
    "exercises",
    "quiz_results",
    "assignments",
    "submissions",
    "submission_reviews",
    "practice_threads",
    "practice_messages",
  ]) {
    const records = (
      await pool.query(`SELECT row_to_json(t) AS record FROM ${table} t`)
    ).rows
      .map((r) => JSON.stringify(r.record))
      .sort();
    snapshot[table] = {
      count: records.length,
      digest: createHash("sha256")
        .update(JSON.stringify(records))
        .digest("hex"),
    };
  }
  const out = path.join(config.root, "test-results");
  await fs.mkdir(out, { recursive: true });
  const baseline = path.join(out, "restart-baseline.json");
  if (process.argv.includes("--before")) {
    await fs.writeFile(baseline, JSON.stringify(snapshot, null, 2));
    console.log(
      "Saved read-only baseline; no record contents or passwords are exported.",
    );
  } else {
    assert.deepEqual(snapshot, JSON.parse(await fs.readFile(baseline, "utf8")));
    const report = {
      checkedAt: new Date().toISOString(),
      status: "passed",
      tables: Object.fromEntries(
        Object.entries(snapshot).map(([k, v]) => [k, v.count]),
      ),
      allRecordDigestsUnchanged: true,
    };
    await fs.writeFile(
      path.join(out, "restart-check.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  }
} finally {
  await pool.end();
}
