import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { config } from "../apps/api/src/config.js";
export async function startDatabase(
  attempt = 0,
): Promise<{ stop: () => Promise<void> } | null> {
  if (process.env.LOCAL_POSTGRES !== "true") return null;
  const dir = path.join(config.data, "postgres");
  const port = Number(new URL(config.database).port);
  const ctl = path.join(
    config.root,
    "node_modules/@embedded-postgres/windows-x64/native/bin/pg_ctl.exe",
  );
  const nativeWindows =
    process.platform === "win32" && !!(await fs.stat(ctl).catch(() => null));
  const run = (
    file: string,
    args: string[],
    options: { windowsHide: boolean; timeout: number },
  ) =>
    new Promise<void>((resolve, reject) => {
      // Avoid inherited pipe handles delaying execFile's close on Windows.
      const child = spawn(file, args, {
        windowsHide: options.windowsHide,
        stdio: "ignore",
      });
      const timeout = setTimeout(() => {
        child.kill();
        reject(new Error("pg_ctl timeout; inspect private PostgreSQL logs."));
      }, options.timeout);
      child.once("error", (e) => {
        clearTimeout(timeout);
        reject(e);
      });
      child.once("exit", (code) => {
        clearTimeout(timeout);
        code === 0
          ? resolve()
          : reject(
              new Error(
                `pg_ctl failed with code ${code}; inspect private PostgreSQL logs.`,
              ),
            );
      });
    });
  const nativeStop = {
    stop: async () => {
      await run(ctl, ["stop", "-D", dir, "-m", "fast", "-w", "-t", "30"], {
        windowsHide: true,
        timeout: 35000,
      });
    },
  };
  const probe = new pg.Client({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password: process.env.LOCAL_PG_PASSWORD,
    database: "postgres",
    connectionTimeoutMillis: 1500,
  });
  try {
    await probe.connect();
    const runningDir = (await probe.query("SHOW data_directory")).rows[0]
      .data_directory;
    await probe.end();
    if (
      path.resolve(runningDir).toLowerCase() !== path.resolve(dir).toLowerCase()
    )
      throw new Error("PostgreSQL port belongs to another data directory.");
    return nativeWindows && process.argv.includes("--api-only")
      ? nativeStop
      : null;
  } catch (error: any) {
    await probe.end().catch(() => {});
    if (error.code === "57P03" && attempt < 20) {
      await new Promise((r) => setTimeout(r, 1000));
      return startDatabase(attempt + 1);
    }
    if (error.code !== "ECONNREFUSED") throw error;
  }
  const embedded = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: process.env.LOCAL_PG_PASSWORD!,
    port,
    persistent: true,
    authMethod: "scram-sha-256",
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    postgresFlags: [
      "-h",
      "127.0.0.1",
      "-c",
      "max_connections=40",
      "-c",
      "shared_buffers=64MB",
    ],
    onLog: () => {},
    onError: (m) => {
      if (String(m).includes("FATAL")) console.error(String(m));
    },
  });
  if (!(await fs.stat(path.join(dir, "PG_VERSION")).catch(() => null)))
    await embedded.initialise();
  // pg_ctl performs a real fast shutdown on Windows; the portable library's
  // default stop uses taskkill /F, requiring crash recovery on the next start.
  if (nativeWindows) {
    await fs.mkdir(path.join(config.data, "operations"), { recursive: true });
    await run(
      ctl,
      [
        "start",
        "-D",
        dir,
        "-l",
        path.join(config.data, "operations/postgres-startup.log"),
        "-w",
        "-t",
        "30",
        "-o",
        `-p ${port} -h 127.0.0.1 -c max_connections=40 -c shared_buffers=64MB -c logging_collector=on -c log_filename=postgres-%a.log -c log_rotation_age=1d -c log_rotation_size=0 -c log_truncate_on_rotation=on`,
      ],
      { windowsHide: true, timeout: 40000 },
    );
  } else await embedded.start();
  const client = new pg.Client({
    host: "127.0.0.1",
    port,
    user: "postgres",
    password: process.env.LOCAL_PG_PASSWORD,
    database: "postgres",
  });
  await client.connect();
  const password = decodeURIComponent(new URL(config.database).password);
  if (!/^[a-f0-9]{48,64}$/.test(password))
    throw new Error("Local PostgreSQL requires setup-generated credentials.");
  if (
    !(await client.query("SELECT 1 FROM pg_roles WHERE rolname='eplab'"))
      .rowCount
  )
    await client.query(
      `CREATE ROLE eplab LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE`,
    );
  for (const name of ["eplab", "eplab_test"])
    if (
      !(
        await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [name])
      ).rowCount
    )
      await client.query(`CREATE DATABASE ${name} OWNER eplab`);
  await client.end();
  return nativeWindows ? nativeStop : embedded;
}
