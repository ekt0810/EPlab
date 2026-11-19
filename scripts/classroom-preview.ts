/** An isolated local review, never using production users or changing public hosting. */
import fs from "node:fs/promises";
import path from "node:path";
import net from "node:net";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { createTestEnvironment } from "../tests/environment.js";

const port = 3440;
const probe = net.createServer();
await new Promise<void>((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(port, "127.0.0.1", resolve);
});
await new Promise<void>((resolve) => probe.close(() => resolve()));
const environment = await createTestEnvironment("classroompreview");
const { pool } = await import("../apps/api/src/db.js");
const { config } = await import("../apps/api/src/config.js");
const { migrate } = await import("../apps/api/src/migrate.js");
const { seed } = await import("../apps/api/src/seed.js");
const { reserveAdmins } = await import("./admin.js");
const { hashPassword } = await import("../apps/api/src/auth.js");
const { buildApp } = await import("../apps/api/src/server.js");
await migrate();
await seed();
await reserveAdmins(["preview@classroom.test", "reviewer@classroom.test"]);
const password = "Review-" + randomBytes(10).toString("hex");
await pool.query(
  "UPDATE users SET password_hash=$1,verified=true,setup_pending=false WHERE role='admin'",
  [await hashPassword(password)],
);
config.url = `http://127.0.0.1:${port}`;
process.env.APP_URL = config.url;
const app = await buildApp();
const api = await app.listen({ host: "127.0.0.1", port: 0 });
const dir = path.join(config.root, "work/classroom-preview");
await fs.mkdir(dir, { recursive: true });
await fs.rm(path.join(dir, "stop"), { force: true });
await fs.writeFile(
  path.join(dir, "ACCESS.md"),
  `# EP LAB - bản xem thử cục bộ\n\nMở ${config.url}/kicad/lop-hoc\n\nTài khoản dữ liệu thử: preview@classroom.test\n\nMật khẩu: ${password}\n\nCả ba môn và bản PDF đều có đủ trong tài khoản thử. Đây là cơ sở dữ liệu tách biệt, không phải tài khoản EP LAB thật. Không dùng bản này để lưu bài học lâu dài.\n\nDừng bản xem thử bằng npm run classroom:preview:stop.\n`,
  { mode: 0o600 },
);
const web = spawn(
  process.execPath,
  [
    path.join(config.root, "node_modules/next/dist/bin/next"),
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    String(port),
  ],
  {
    cwd: path.join(config.root, "apps/web"),
    windowsHide: true,
    stdio: "inherit",
    env: {
      ...process.env,
      EP_API_URL: api,
      NEXT_BUILD_DIR: ".next-classroom-preview",
      EP_LOCAL_REVIEW: "true",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
await fs.writeFile(
  path.join(dir, "status.json"),
  JSON.stringify(
    {
      pid: process.pid,
      webPid: web.pid,
      url: config.url,
      database: environment.databaseName,
      startedAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  try {
    if (web.pid && web.exitCode === null) {
      if (process.platform === "win32")
        await promisify(execFile)(
          "taskkill",
          ["/PID", String(web.pid), "/T", "/F"],
          { windowsHide: true },
        );
      else web.kill("SIGTERM");
    }
  } finally {
    await app.close();
    await pool.end();
    await environment.dispose();
    await fs.writeFile(
      path.join(dir, "status.json"),
      JSON.stringify({ status: "stopped" }),
    );
    process.exit(0);
  }
}
const timer = setInterval(() => {
  void fs
    .access(path.join(dir, "stop"))
    .then(() => stop())
    .catch(() => {});
}, 1000);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => void stop());
web.once("exit", () => void stop());
console.log(
  `Local classroom preview: ${config.url}/kicad/lop-hoc. Review account saved in work/classroom-preview/ACCESS.md.`,
);
