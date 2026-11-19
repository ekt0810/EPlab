import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import net from "node:net";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "data", "operations");
const logs = path.join(dir, "logs");
fs.mkdirSync(logs, { recursive: true });
const disabled = () => fs.existsSync(path.join(dir, "disabled"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(promise, ms) {
  let timer;
  try {
    await Promise.race([
      promise,
      new Promise((r) => {
        timer = setTimeout(r, ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
const state = {
  supervisorPid: process.pid,
  startedAt: new Date().toISOString(),
  phase: "starting",
  restartCount: 0,
  apiPid: null,
  webPid: null,
  ngrokWorkerPid: null,
  lastHealthyAt: null,
  backup: null,
};
let api,
  web,
  ngrok,
  backupChild,
  stopping = false,
  failures = 0,
  nextBackup = 0;
function log(name, chunk) {
  const file = path.join(logs, name + ".log");
  try {
    if (fs.existsSync(file) && fs.statSync(file).size > 5 * 1024 * 1024) {
      fs.rmSync(file + ".3", { force: true });
      for (let n = 2; n >= 1; n--)
        if (fs.existsSync(file + "." + n))
          fs.renameSync(file + "." + n, file + "." + (n + 1));
      fs.renameSync(file, file + ".1");
    }
    fs.appendFileSync(file, chunk);
  } catch {
    /* A full disk must not throw from a child event handler. Health state reports it on the next tick. */
  }
}
function event(message) {
  log("supervisor", `${new Date().toISOString()} ${message}\n`);
}
function save() {
  fs.writeFileSync(
    path.join(dir, "status.tmp"),
    JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2),
  );
  fs.renameSync(path.join(dir, "status.tmp"), path.join(dir, "status.json"));
}
function launch(name, args, cwd = root, ipc = false) {
  const child = spawn(process.execPath, args, {
    cwd,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe", ...(ipc ? ["ipc"] : [])],
    env: {
      ...process.env,
      NODE_ENV: "production",
      EP_API_URL: "http://127.0.0.1:4100",
    },
  });
  child.stdout.on("data", (b) => log(name, b));
  child.stderr.on("data", (b) => log(name, b));
  child.on("error", (e) => event(`${name}: ${e.code || e.name}`));
  child.on("exit", (code, signal) =>
    event(`${name} exited code=${code} signal=${signal}`),
  );
  return child;
}
async function terminate(child, graceful = false) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const ended = new Promise((r) => child.once("exit", r));
  if (graceful && child.connected) child.send({ type: "shutdown" }, () => {});
  else child.kill();
  await until(ended, graceful ? 45000 : 5000);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill();
    await until(ended, 3000);
  }
}
async function stopWorkers() {
  await terminate(ngrok, true);
  ngrok = undefined;
  state.ngrokWorkerPid = null;
  await terminate(web);
  await terminate(api, true);
  web = api = undefined;
  state.apiPid = state.webPid = null;
}
function portFree(port) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once("error", () => resolve(false));
    s.listen(port, "127.0.0.1", () => s.close(() => resolve(true)));
  });
}
async function startWorkers() {
  if (!(await portFree(3100)) || !(await portFree(4100))) {
    state.phase = "port-conflict";
    event(
      "Existing listener on 3100/4100. Waiting; no unrelated process will be stopped.",
    );
    save();
    return false;
  }
  api = launch(
    "api",
    ["--import", "tsx", "scripts/local.ts", "--production", "--api-only"],
    root,
    true,
  );
  web = launch(
    "web",
    [
      "--require",
      path.join(root, "scripts/server-child-guard.cjs"),
      path.join(root, "node_modules/next/dist/bin/next"),
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3100",
    ],
    path.join(root, "apps/web"),
    true,
  );
  state.apiPid = api.pid;
  state.webPid = web.pid;
  state.phase = "starting";
  save();
  failures = 0;
  await sleep(10000);
  return true;
}
async function healthy() {
  try {
    const results = await Promise.all([
      fetch("http://127.0.0.1:4100/api/health", {
        signal: AbortSignal.timeout(5000),
      }),
      fetch("http://127.0.0.1:3100", { signal: AbortSignal.timeout(5000) }),
    ]);
    const ok =
      results.every((r) => r.ok) && (await results[0].json()).status === "ok";
    await results[1].arrayBuffer();
    return ok;
  } catch {
    return false;
  }
}
function maybeBackup() {
  let last = 0;
  try {
    const saved = JSON.parse(
      fs
        .readFileSync(path.join(dir, "backup-status.json"), "utf8")
        .replace(/^\uFEFF/, ""),
    );
    if (saved.ok) last = Date.parse(saved.completedAt);
    state.backup = saved;
  } catch {}
  if (backupChild || Date.now() < nextBackup || disabled()) return;
  if (Date.now() - last < 24 * 60 * 60 * 1000) return;
  nextBackup = Date.now() + 60 * 60 * 1000;
  backupChild = spawn(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      path.join(root, "scripts/server-backup.ps1"),
    ],
    { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
  );
  backupChild.stdout.on("data", (b) => log("backup", b));
  backupChild.stderr.on("data", (b) => log("backup", b));
  backupChild.on("error", (e) =>
    event(`Backup launch failed: ${e.code || e.name}`),
  );
  backupChild.on("close", (code) => {
    event(`Backup exited ${code}`);
    backupChild = undefined;
  });
}
async function stop() {
  if (stopping) return;
  stopping = true;
  state.phase = "stopping";
  save();
  // Let the consistent backup release its DB locks and restore maintenance state.
  if (backupChild) await new Promise((r) => backupChild.once("close", r));
  await stopWorkers();
  state.phase = "stopped";
  save();
  event("Stopped cleanly.");
}
process.on("SIGINT", () => void stop());
process.on("SIGTERM", () => void stop());
try {
  event("Supervisor started.");
  while (!stopping && !disabled()) {
    if (!api) {
      if (!(await startWorkers())) {
        await sleep(15000);
        continue;
      }
    }
    if (
      (await healthy()) &&
      api.exitCode === null &&
      api.signalCode === null &&
      web.exitCode === null &&
      web.signalCode === null
    ) {
      failures = 0;
      state.phase = "healthy";
      state.lastHealthyAt = new Date().toISOString();
      maybeBackup();
      if (fs.existsSync(path.join(dir, "ngrok-enabled"))) {
        if (!ngrok || ngrok.exitCode !== null || ngrok.signalCode !== null) {
          ngrok = launch(
            "ngrok-worker",
            ["--import", "tsx", "scripts/ngrok-worker.ts"],
            root,
            true,
          );
          state.ngrokWorkerPid = ngrok.pid;
        }
      } else if (ngrok) {
        await terminate(ngrok, true);
        ngrok = undefined;
        state.ngrokWorkerPid = null;
      }
    } else {
      state.phase = "recovering";
      failures++;
      if (
        failures >= 3 ||
        api.exitCode !== null ||
        api.signalCode !== null ||
        web.exitCode !== null ||
        web.signalCode !== null
      ) {
        event(
          "Worker or health failure; restarting owned application processes.",
        );
        await stopWorkers();
        state.restartCount++;
        await sleep(Math.min(30000, 3000 * Math.min(state.restartCount, 10)));
      }
    }
    save();
    await sleep(15000);
  }
  await stop();
} catch (e) {
  event(`Supervisor failure: ${e.code || e.name}`);
  await stop().catch(() => {});
  process.exitCode = 1;
}
