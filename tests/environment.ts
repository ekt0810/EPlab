import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** A fresh owned database and private temporary storage for each test process. */
export async function createTestEnvironment(label: string) {
  assert.match(label, /^[a-z][a-z0-9_]{0,20}$/);
  dotenv.config({ path: path.join(root, ".env"), quiet: true });
  const source = new URL(process.env.DATABASE_URL || "");
  assert.equal(source.hostname, "127.0.0.1", "Tests require local PostgreSQL");
  const owner = decodeURIComponent(source.username);
  assert.match(owner, /^[a-zA-Z_][a-zA-Z0-9_]*$/);
  assert.ok(
    process.env.LOCAL_PG_PASSWORD,
    "LOCAL_PG_PASSWORD is needed to create the temporary test database",
  );
  const databaseName = `eplab_test_${label}_${randomBytes(6).toString("hex")}`;
  const data = await fs.mkdtemp(path.join(os.tmpdir(), "eplab-test-"));
  const options = {
    host: "127.0.0.1",
    port: Number(source.port || 5432),
    user: "postgres",
    password: process.env.LOCAL_PG_PASSWORD,
    database: "postgres",
    connectionTimeoutMillis: 5000,
  };
  const admin = new pg.Client(options);
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}" OWNER "${owner}"`);
  } catch (error) {
    await fs.rm(data, { recursive: true, force: true });
    throw error;
  } finally {
    await admin.end();
  }
  const target = new URL(source);
  target.pathname = "/" + databaseName;
  Object.assign(process.env, {
    DATABASE_URL: target.toString(),
    DATA_DIR: data,
    APP_URL: "http://127.0.0.1:3200",
    SECRET_KEY: randomBytes(32).toString("hex"),
    PUBLIC_MODE: "false",
    MAIL_MODE: "local",
    LOG_LEVEL: "silent",
    TRUST_PROXY: "false",
    STORAGE_DRIVER: "local",
    BACKUP_DESTINATION: "",
  });
  let disposed = false;
  return {
    databaseName,
    data,
    async dispose() {
      if (disposed) return;
      assert.match(databaseName, /^eplab_test_[a-z0-9_]+_[a-f0-9]{12}$/);
      assert.notEqual(
        databaseName,
        decodeURIComponent(source.pathname.slice(1)),
      );
      const cleanup = new pg.Client(options);
      try {
        await cleanup.connect();
        await cleanup.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
      } finally {
        await cleanup.end();
        assert.equal(path.dirname(data), os.tmpdir());
        assert.ok(path.basename(data).startsWith("eplab-test-"));
        await fs.rm(data, { recursive: true, force: true });
      }
      disposed = true;
    },
  };
}
