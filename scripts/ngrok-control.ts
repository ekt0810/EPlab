import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import dotenv from "dotenv";
import { ROOT } from "../apps/api/src/config.js";
import { updateEnvFile } from "./env-file.js";
import { ngrokOrigin } from "./ngrok-settings.js";

const exec = promisify(execFile);
const dir = path.join(ROOT, "data/operations");
const marker = path.join(dir, "ngrok-enabled");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function control(action: string) {
  const inherited = { ...process.env };
  // A fallback Startup process must read the new .env, not inherit stale values
  // loaded by this CLI before a public/local mode switch.
  const keys = Object.keys(
    dotenv.parse(await fs.readFile(path.join(ROOT, ".env"))),
  );
  for (const key of keys) delete inherited[key];
  return exec(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(ROOT, "scripts/server-control.ps1"),
      "-Action",
      action,
    ],
    { cwd: ROOT, windowsHide: true, timeout: 120000, env: inherited },
  );
}
async function waitLocal(publicMode: boolean) {
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch("http://127.0.0.1:3100/api/auth/me", {
        signal: AbortSignal.timeout(2000),
      });
      const mode = await response.json();
      if (
        response.ok &&
        mode.publicMode === publicMode &&
        (!publicMode || mode.mailMode === "smtp")
      )
        return;
    } catch {}
    await sleep(2000);
  }
  throw new Error("Server did not return in the expected mode");
}
async function stopTunnel() {
  await fs.rm(marker, { force: true });
  // The gateway refuses new requests as soon as its marker is removed.
  await control("Stop");
}
async function checkPublic(origin: string) {
  const checks = [];
  for (const [route, expected] of [
    ["/api/health", 200],
    ["/api/auth/me", 200],
    ["/api/admin/users", 401],
    ["/", 200],
  ] as const) {
    const response = await fetch(origin + route, {
      redirect: "error",
      headers: { "ngrok-skip-browser-warning": "1" },
      signal: AbortSignal.timeout(15000),
    });
    let ok = response.status === expected;
    if (route === "/api/auth/me") {
      const mode = await response.json();
      ok =
        ok &&
        mode.publicMode === true &&
        mode.mailMode === "smtp" &&
        !mode.user;
    } else if (route === "/api/health") {
      const health = await response.json();
      ok = ok && health.status === "ok";
    } else {
      const body = await response.text();
      if (route === "/") ok = ok && /EP LAB/i.test(body);
    }
    checks.push({ route, status: response.status, ok });
  }
  const report = {
    checkedAt: new Date().toISOString(),
    origin,
    checks,
    passed: checks.every((c) => c.ok),
    scope:
      "HTTPS fetches through ngrok from server network; not a full browser/learner journey",
  };
  await fs.writeFile(
    path.join(ROOT, "docs/reports/ngrok-public-check.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) throw new Error("Public checks failed");
}
const action = process.argv[2] || "status";
try {
  if (action === "status") {
    const state = await fs
      .readFile(path.join(dir, "ngrok-status.json"), "utf8")
      .catch(() => "Chưa khởi động ngrok cho EP LAB.");
    console.log(state);
    console.log("Enabled:", !!(await fs.stat(marker).catch(() => null)));
  } else if (action === "disable") {
    await stopTunnel();
    await updateEnvFile(ROOT, {
      APP_URL: "http://127.0.0.1:3100",
      PUBLIC_MODE: "false",
      TRUST_PROXY: "false",
    });
    await control("Start");
    await waitLocal(false);
    console.log(
      "Đã tắt ngrok và phục hồi truy cập local. Cấu hình SMTP được giữ nguyên.",
    );
  } else if (action === "enable" || action === "check") {
    const setting = JSON.parse(
      await fs.readFile(path.join(dir, "ngrok.json"), "utf8"),
    );
    const origin = ngrokOrigin(setting.origin);
    if (action === "check") await checkPublic(origin);
    else {
      console.log(
        "Kiểm tra URL, SMTP, MFA và sao lưu trước khi mở Internet...",
      );
      try {
        const result = await exec(
          process.execPath,
          ["--import", "tsx", "scripts/internet-check.ts", "--url", origin],
          { cwd: ROOT, windowsHide: true, timeout: 60000 },
        );
        console.log(result.stdout);
      } catch (error) {
        console.log(
          (error as { stdout?: string }).stdout || "Kiểm tra chưa đạt.",
        );
        throw new Error("Preflight failed");
      }
      await exec(
        setting.binary,
        ["config", "check", "--config", path.join(dir, "ngrok.yml")],
        { windowsHide: true, timeout: 10000 },
      );
      await control("Backup");
      const before = dotenv.parse(await fs.readFile(path.join(ROOT, ".env")));
      const restore = {
        APP_URL: before.APP_URL || "http://127.0.0.1:3100",
        PUBLIC_MODE: before.PUBLIC_MODE || "false",
        TRUST_PROXY: before.TRUST_PROXY || "false",
        MAIL_MODE: before.MAIL_MODE || "local",
      };
      try {
        await stopTunnel();
        await updateEnvFile(ROOT, {
          APP_URL: origin,
          PUBLIC_MODE: "true",
          TRUST_PROXY: "true",
          MAIL_MODE: "smtp",
        });
        await control("Start");
        await waitLocal(true);
        await fs.writeFile(marker, new Date().toISOString(), { mode: 0o600 });
        // Supervisor notices this marker within 15 seconds and starts the guarded worker.
        let connected = false;
        for (let n = 0; n < 30; n++) {
          await sleep(2000);
          try {
            const state = JSON.parse(
              await fs.readFile(path.join(dir, "ngrok-status.json"), "utf8"),
            );
            if (
              state.origin === origin &&
              state.phase === "connected" &&
              Date.now() - Date.parse(state.updatedAt) < 15000
            ) {
              connected = true;
              break;
            }
          } catch {}
        }
        if (!connected) throw new Error("Ngrok did not connect");
        await checkPublic(origin);
        console.log(
          `Đã kết nối ${origin}. Cần kiểm thử đăng nhập, email và nộp/chấm bài trên trình duyệt từ mạng khác.`,
        );
      } catch {
        console.error(
          "Kết nối chưa đạt; đang tắt ngrok và khôi phục cấu hình trước đó.",
        );
        await stopTunnel();
        await updateEnvFile(ROOT, restore);
        await control("Start");
        await waitLocal(restore.PUBLIC_MODE === "true");
        throw new Error("Enable rolled back");
      }
    }
  } else throw new Error("Unknown action");
} catch {
  console.error(
    "Chưa hoàn tất thao tác ngrok. Kiểm tra cấu hình riêng và docs/reports/internet-readiness.json; không chia sẻ token.",
  );
  process.exitCode = 1;
}
