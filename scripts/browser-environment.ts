import { spawn, execFile, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import net from "node:net";
import path from "node:path";
import { promisify } from "node:util";
import { chromium, type Browser } from "playwright";
import { createTestEnvironment } from "../tests/environment.js";

async function availablePort() {
  const probe = net.createServer();
  await new Promise<void>((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const port = (probe.address() as net.AddressInfo).port;
  await new Promise<void>((resolve, reject) =>
    probe.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

export async function startBrowserEnvironment() {
  const environment = await createTestEnvironment("browser");
  const { pool } = await import("../apps/api/src/db.js");
  const { config } = await import("../apps/api/src/config.js");
  const { buildApp } = await import("../apps/api/src/server.js");
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  let web: ChildProcess | undefined;
  let browser: Browser | undefined;
  async function stop() {
    try {
      await browser?.close();
    } finally {
      try {
        if (web?.pid && web.exitCode === null) {
          if (process.platform === "win32") {
            await promisify(execFile)(
              "taskkill",
              ["/PID", String(web.pid), "/T", "/F"],
              { windowsHide: true },
            );
          } else {
            web.kill("SIGTERM");
          }
        }
      } finally {
        try {
          await app?.close();
        } finally {
          try {
            await pool.end();
          } finally {
            await environment.dispose();
          }
        }
      }
    }
  }
  try {
    const { migrate } = await import("../apps/api/src/migrate.js");
    const { seed } = await import("../apps/api/src/seed.js");
    const { reserveAdmins } = await import("./admin.js");
    const { hashPassword } = await import("../apps/api/src/auth.js");
    await migrate();
    await seed();
    await reserveAdmins(["one@example.test", "two@example.test"]);
    const password = "Ui-" + randomBytes(20).toString("hex");
    await pool.query(
      "UPDATE users SET password_hash=$1,verified=true,setup_pending=false WHERE role='admin'",
      [await hashPassword(password)],
    );
    const webPort = await availablePort();
    config.url = `http://127.0.0.1:${webPort}`;
    process.env.APP_URL = config.url;
    app = await buildApp();
    const apiUrl = await app.listen({ host: "127.0.0.1", port: 0 });
    web = spawn(
      process.execPath,
      [
        path.join(config.root, "node_modules/next/dist/bin/next"),
        "dev",
        "--hostname",
        "127.0.0.1",
        "--port",
        String(webPort),
      ],
      {
        cwd: path.join(config.root, "apps/web"),
        stdio: "pipe",
        windowsHide: true,
        env: {
          ...process.env,
          EP_API_URL: apiUrl,
          NEXT_BUILD_DIR: ".next-test",
          NEXT_TELEMETRY_DISABLED: "1",
        },
      },
    );
    let output = "";
    web.stdout?.on("data", (chunk) => {
      output = (output + chunk).slice(-6000);
    });
    web.stderr?.on("data", (chunk) => {
      output = (output + chunk).slice(-6000);
    });
    let launchError: Error | undefined;
    web.once("error", (error) => {
      launchError = error;
    });
    let ready = false;
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (launchError) throw launchError;
      if (web.exitCode !== null)
        throw new Error(`Test frontend exited: ${output}`);
      try {
        const response = await fetch(config.url, {
          signal: AbortSignal.timeout(3000),
        });
        await response.arrayBuffer();
        if (response.ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready)
      throw new Error(`Test frontend did not become ready: ${output}`);
    browser = await chromium.launch({
      channel: process.platform === "win32" ? "msedge" : undefined,
      headless: true,
    });
    return { pool, config, password, browser, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}
