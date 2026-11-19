import fs from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import dotenv from "dotenv";
import { ROOT } from "../apps/api/src/config.js";
import { validatePublicSettings } from "../apps/api/src/public-config.js";
import { ngrokOrigin } from "./ngrok-settings.js";
import { publicGateway } from "./public-gateway.js";
import { readinessProbe } from "./readiness-probe.js";

const dir = path.join(ROOT, "data/operations");
let child: ChildProcess | undefined,
  stopping = false;
let lastError: string | null = null;
const setting = JSON.parse(
  await fs.readFile(path.join(dir, "ngrok.json"), "utf8"),
);
const origin = ngrokOrigin(setting.origin);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const apiReady = readinessProbe(async () => {
  const response = await fetch("http://127.0.0.1:4100/api/auth/me", {
    signal: AbortSignal.timeout(2000),
  });
  const body = await response.json();
  return response.ok && body.publicMode === true && body.mailMode === "smtp";
});
async function ready() {
  try {
    if (stopping) return false;
    if (
      !(await fs.stat(path.join(dir, "ngrok-enabled")).catch(() => null)) ||
      (await fs.stat(path.join(dir, "disabled")).catch(() => null))
    )
      return false;
    const env = dotenv.parse(await fs.readFile(path.join(ROOT, ".env")));
    if (
      env.PUBLIC_MODE !== "true" ||
      env.TRUST_PROXY !== "true" ||
      validatePublicSettings(env) !== origin
    )
      return false;
    return (await apiReady()) && !stopping;
  } catch {
    return false;
  }
}
const gateway = publicGateway({ origin, ready });
async function save(phase: string) {
  await fs.writeFile(
    path.join(dir, "ngrok-status.tmp"),
    JSON.stringify(
      {
        phase,
        origin,
        workerPid: process.pid,
        agentPid: child?.pid || null,
        lastError,
        updatedAt: new Date().toISOString(),
        externalVerification:
          "Use ngrok:check; agent status alone does not verify Internet access.",
      },
      null,
      2,
    ),
  );
  await fs.rename(
    path.join(dir, "ngrok-status.tmp"),
    path.join(dir, "ngrok-status.json"),
  );
}
async function stopAgent() {
  if (child && child.exitCode === null && child.signalCode === null) {
    const ended = new Promise<void>((r) => child!.once("exit", () => r()));
    child.kill();
    await Promise.race([ended, sleep(3000)]);
  }
  child = undefined;
}
function requestStop() {
  stopping = true;
  void stopAgent();
  gateway.closeAllConnections();
}
process.on("disconnect", requestStop);
process.on("message", (message) => {
  if ((message as { type?: string })?.type === "shutdown") requestStop();
});
process.on("SIGINT", requestStop);
process.on("SIGTERM", requestStop);
try {
  await new Promise<void>((resolve, reject) => {
    gateway.once("error", reject);
    gateway.listen(3101, "127.0.0.1", resolve);
  });
  while (!stopping) {
    const available = await ready();
    if (stopping) break;
    if (!available) {
      await stopAgent();
      await save("waiting-for-public-config");
    } else {
      if (!child || child.exitCode !== null || child.signalCode !== null) {
        await stopAgent();
        // Refuse to overwrite another agent's control port.
        let occupied = false;
        try {
          const response = await fetch("http://127.0.0.1:4041/api/tunnels", {
            signal: AbortSignal.timeout(1000),
          });
          await response.arrayBuffer();
          occupied = true;
        } catch {}
        if (occupied) {
          lastError = "AGENT_PORT_IN_USE";
          await save("port-conflict");
          await sleep(10000);
          continue;
        }
        child = spawn(
          setting.binary,
          [
            "http",
            "http://127.0.0.1:3101",
            "--url",
            origin,
            "--inspect=false",
            "--config",
            path.join(dir, "ngrok.yml"),
            "--log=false",
          ],
          { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] },
        );
        lastError = null;
        const readError = (data: Buffer) => {
          const code = data.toString().match(/ERR_NGROK_\d+/)?.[0];
          if (code) lastError = code;
        };
        child.stdout!.on("data", readError);
        child.stderr!.on("data", readError);
        child.on("error", () => {
          lastError = "AGENT_LAUNCH_FAILED";
        });
        await save("connecting");
        await sleep(5000);
      }
      if (stopping) break;
      try {
        const response = await fetch("http://127.0.0.1:4041/api/tunnels", {
          signal: AbortSignal.timeout(2000),
        });
        const state = await response.json();
        const connected = state.tunnels?.some(
          (t: any) =>
            t.public_url === origin &&
            t.config?.addr === "http://127.0.0.1:3101",
        );
        await save(connected ? "connected" : "connecting");
      } catch {
        await save("connecting");
      }
    }
    await sleep(5000);
  }
} catch {
  lastError = "GATEWAY_OR_WORKER_FAILED";
  process.exitCode = 1;
} finally {
  stopping = true;
  await stopAgent();
  gateway.closeAllConnections();
  await new Promise<void>((resolve) => gateway.close(() => resolve()));
  await save("stopped");
  if (process.connected) process.disconnect?.();
}
