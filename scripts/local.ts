import { spawn } from "node:child_process";
import path from "node:path";
import { config } from "../apps/api/src/config.js";
import { startDatabase } from "./database.js";
import { buildApp } from "../apps/api/src/server.js";
const production = process.argv.includes("--production");
process.env.NODE_ENV = production ? "production" : "development";
const pg = await startDatabase();
const app = await buildApp();
await app.listen({ host: config.host, port: config.port });
const web = process.argv.includes("--api-only")
  ? null
  : spawn(
      process.execPath,
      [
        path.join(config.root, "node_modules/next/dist/bin/next"),
        production ? "start" : "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        "3100",
      ],
      {
        cwd: path.join(config.root, "apps/web"),
        stdio: "inherit",
        windowsHide: true,
        env: {
          ...process.env,
          EP_API_URL: `http://127.0.0.1:${config.port}`,
          NODE_ENV: production ? "production" : "development",
        },
      },
    );
console.log(
  web
    ? "EP LAB đang chạy tại http://127.0.0.1:3100 — chỉ localhost."
    : "EP LAB API ready.",
);
let stopping = false;
async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 40000);
  deadline.unref();
  try {
    web?.kill();
    const closing = app.close();
    app.server.closeIdleConnections();
    await closing;
    const { pool } = await import("../apps/api/src/db.js");
    await pool.end();
    if (pg) await pg.stop();
  } finally {
    process.exitCode = code;
    if (process.connected) process.disconnect?.();
  }
}
for (const s of ["SIGINT", "SIGTERM"] as const)
  process.on(s, () => void stop());
if (process.send) {
  process.on("message", (message: any) => {
    if (message?.type === "shutdown") void stop();
  });
  process.on("disconnect", () => void stop());
}
web?.on("exit", () => {
  if (!stopping) void stop(1);
});
