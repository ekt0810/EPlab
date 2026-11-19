import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createTestEnvironment } from "../tests/environment.js";
import pg from "pg";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import dotenv from "dotenv";
dotenv.config({ quiet: true });
const automatic = process.argv.includes("--automatic");
const environment = automatic
  ? undefined
  : await createTestEnvironment("backup");
const url = new URL(process.env.DATABASE_URL!);
assert.equal(url.hostname, "127.0.0.1");
const expectedDatabase = decodeURIComponent(url.pathname.slice(1));
const { backup } = await import("./backup.js");
const { pool } = await import("../apps/api/src/db.js");
const { config } = await import("../apps/api/src/config.js");
const { storage } = await import("../apps/api/src/storage.js");
const { unseal, digest } = await import("./backup-format.js");
const password = automatic
  ? process.env.BACKUP_PASSWORD!
  : randomBytes(32).toString("hex");
assert.ok(
  password?.length >= 16,
  "Automatic backup check requires a protected backup password.",
);
const dbName = "eplab_restore_test_" + randomBytes(8).toString("hex");
const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "eplab-restore-test-"));
let restoreCreated = false;
const target = new URL(url);
target.pathname = "/" + dbName;
const rootClient = new pg.Client({
  host: "127.0.0.1",
  port: Number(url.port),
  user: "postgres",
  password: process.env.LOCAL_PG_PASSWORD,
  database: "postgres",
});
const restored = new pg.Client({ connectionString: target.toString() });
try {
  await rootClient.connect();
  if (!automatic) {
    const { seedBackupFixtures } = await import("../tests/backup-fixtures.js");
    await seedBackupFixtures();
  }
  assert.equal(
    (await pool.query("SELECT current_database() AS name")).rows[0].name,
    expectedDatabase,
  );
  // Verify fixture checksums independently before snapshotting.
  for (const r of (await pool.query("SELECT id,storage_key FROM resources"))
    .rows) {
    const s = await storage.get(r.storage_key);
    const b = [];
    for await (const c of s) b.push(Buffer.from(c));
    const actual = digest(Buffer.concat(b));
    const stored = (
      await pool.query("SELECT sha256 FROM resources WHERE id=$1", [r.id])
    ).rows[0].sha256;
    assert.equal(actual, stored);
  }
  const saved = automatic
    ? JSON.parse(
        (
          await fs.readFile(
            path.join(config.root, "data/operations/backup-status.json"),
            "utf8",
          )
        ).replace(/^\uFEFF/, ""),
      )
    : await backup(password, path.join(environment!.data, "archives"));
  const encrypted = await fs.readFile(saved.file);
  assert.throws(() =>
    unseal(encrypted, "incorrect-password-with-enough-length"),
  );
  const changed = Buffer.from(encrypted);
  changed[changed.length - 1] ^= 1;
  assert.throws(() => unseal(changed, password));
  const owner = decodeURIComponent(url.username);
  assert.match(owner, /^[a-zA-Z_][a-zA-Z0-9_]*$/);
  await rootClient.query(`CREATE DATABASE "${dbName}" OWNER "${owner}"`);
  restoreCreated = true;
  const output = await new Promise<string>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--import",
        "tsx",
        path.join(config.root, "scripts/restore.ts"),
        saved.file,
      ],
      {
        cwd: config.root,
        windowsHide: true,
        env: {
          ...process.env,
          RESTORE_DATABASE_URL: target.toString(),
          RESTORE_DATA_DIR: dataDir,
          BACKUP_PASSWORD: password,
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (x) => (stdout += x));
    child.stderr.on("data", (x) => (stderr += x));
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve(stdout) : reject(new Error(stderr)),
    );
  });
  await restored.connect();
  const snapshot = unseal(encrypted, password);
  for (const table of [
    "users",
    "courses",
    "chapters",
    "lessons",
    "resources",
    "orders",
    "payment_transactions",
    "entitlements",
    "lab_memberships",
    "progress",
    "audit_logs",
    "kicad_lessons",
    "exercises",
    "quiz_results",
    "assignments",
    "submissions",
    "submission_reviews",
    "practice_threads",
    "practice_messages",
    "classroom_progress",
    "classroom_messages",
  ]) {
    const actual = (
      await restored.query(`SELECT count(*)::int AS n FROM ${table}`)
    ).rows[0].n;
    assert.equal(
      actual,
      saved.rows[table as keyof typeof saved.rows] ?? 0,
      table,
    );
  }
  const users = (
    await restored.query("SELECT id,password_hash FROM users ORDER BY id")
  ).rows;
  const source = (
    await pool.query("SELECT id,password_hash FROM users ORDER BY id")
  ).rows;
  assert.deepEqual(users, source);
  for (const table of [
    "entitlements",
    "lab_memberships",
    "orders",
    "payment_transactions",
    "progress",
    "lessons",
    "kicad_lessons",
    "exercises",
    "quiz_results",
    "assignments",
    "submissions",
    "submission_reviews",
    "practice_threads",
    "practice_messages",
    "classroom_progress",
    "classroom_messages",
  ]) {
    if (!snapshot.tables[table]) continue;
    const before = (
      await pool.query(`SELECT row_to_json(t) AS record FROM ${table} t`)
    ).rows
      .map((r) => JSON.stringify(r.record))
      .sort();
    const after = (
      await restored.query(`SELECT row_to_json(t) AS record FROM ${table} t`)
    ).rows
      .map((r) => JSON.stringify(r.record))
      .sort();
    assert.deepEqual(after, before, table);
  }
  for (const [key, entry] of Object.entries(snapshot.files) as [
    string,
    any,
  ][]) {
    assert.equal(
      digest(await fs.readFile(path.join(dataDir, "files", key))),
      entry.sha256,
    );
  }
  assert.equal(
    (await restored.query("SELECT count(*)::int AS n FROM sessions")).rows[0].n,
    0,
  );
  const classroomUser = (
    await restored.query("SELECT user_id FROM classroom_messages LIMIT 1")
  ).rows[0];
  if (classroomUser) {
    const max = (
      await restored.query("SELECT max(id)::text AS id FROM classroom_messages")
    ).rows[0].id;
    await restored.query("BEGIN");
    const inserted = (
      await restored.query(
        "INSERT INTO classroom_messages(user_id,track,lesson_id,role,question,answer,mode) VALUES($1,'solidworks','s02','teacher','Sequence check','Fixture','guide') RETURNING id",
        [classroomUser.user_id],
      )
    ).rows[0];
    assert.ok(BigInt(inserted.id) > BigInt(max));
    await restored.query("ROLLBACK");
  }
  // A restored identity must continue beyond history, not collide with an old message.
  const thread = (
    await restored.query(
      "SELECT id,participant_id FROM practice_threads LIMIT 1",
    )
  ).rows[0];
  if (thread) {
    const max = (
      await restored.query(
        "SELECT COALESCE(max(id),0)::text AS n FROM practice_messages",
      )
    ).rows[0].n;
    await restored.query("BEGIN");
    const inserted = (
      await restored.query(
        "INSERT INTO practice_messages(thread_id,author_id,client_id,body) VALUES($1,$2,gen_random_uuid(),'Restore sequence check') RETURNING id",
        [thread.id, thread.participant_id],
      )
    ).rows[0];
    assert.ok(BigInt(inserted.id) > BigInt(max));
    await restored.query("ROLLBACK");
  }
  assert.equal(
    (await restored.query("SELECT value FROM settings WHERE key='maintenance'"))
      .rows[0].value,
    true,
  );
  const report = {
    submittedFiles: (
      await pool.query(
        "SELECT COALESCE(sum(jsonb_array_length(attachments)),0)::int AS n FROM submissions",
      )
    ).rows[0].n,
    checkedAt: new Date().toISOString(),
    status: "passed",
    rows: saved.rows,
    resources: Object.keys(snapshot.files).length,
    automaticProductionBackup: automatic,
    encryptedBackup: true,
    wrongPasswordRejected: true,
    tamperRejected: true,
    passwordHashesPreserved: true,
    entitlementsOrdersProgressContentPreserved: true,
    practiceAssignmentsImagesReviewsPreserved: true,
    sourceAndCadFilesPreserved: true,
    conversationsAndMessageSequencePreserved: true,
    classroomProgressEvidenceAndSequencePreserved: true,
    learnerSelfChecksPreserved: true,
    sessionsRevoked: true,
    maintenance: true,
  };
  await fs.writeFile(
    path.join(
      config.root,
      automatic
        ? "test-results/automatic-backup-check.json"
        : "test-results/backup-check.json",
    ),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await restored.end().catch(() => {});
  try {
    assert.match(dbName, /^eplab_restore_test_[a-f0-9]{16}$/);
    if (restoreCreated)
      await rootClient.query(`DROP DATABASE "${dbName}" WITH (FORCE)`);
  } finally {
    await rootClient.end();
    try {
      await pool.end();
    } finally {
      try {
        await environment?.dispose();
      } finally {
        assert.equal(path.dirname(dataDir), os.tmpdir());
        assert.ok(path.basename(dataDir).startsWith("eplab-restore-test-"));
        await fs.rm(dataDir, { recursive: true, force: true });
      }
    }
  }
}
