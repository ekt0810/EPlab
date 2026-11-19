import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createTestEnvironment } from "../tests/environment.js";
import { publicGateway } from "./public-gateway.js";
import { readinessProbe } from "./readiness-probe.js";
const env = await createTestEnvironment("soak");
const { pool } = await import("../apps/api/src/db.js");
const { migrate } = await import("../apps/api/src/migrate.js");
const { seed } = await import("../apps/api/src/seed.js");
const { buildApp } = await import("../apps/api/src/server.js");
const { config } = await import("../apps/api/src/config.js");
const { hash } = await import("../apps/api/src/security.js");
let app: any, gateway: any;
const out = path.join(config.root, "test-results/security");
await fs.mkdir(out, { recursive: true });
try {
  await migrate();
  await seed();
  app = await buildApp();
  const api = await app.listen({ host: "127.0.0.1", port: 0 });
  const users = [];
  for (let i = 0; i < 4; i++) {
    const id = (
      await pool.query(
        "INSERT INTO users(email,name,password_hash,verified) VALUES($1,'Soak fixture','no-login-test',true) RETURNING id",
        [`soak${i}@example.test`],
      )
    ).rows[0].id;
    await pool.query(
      "INSERT INTO lab_memberships(user_id,status,tracks,message) VALUES($1,'approved',ARRAY['embedded','kicad','solidworks'],'Temporary soak fixture')",
      [id],
    );
    const sid = randomBytes(32).toString("hex"),
      csrf = randomBytes(32).toString("hex");
    await pool.query(
      "INSERT INTO sessions(id,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
      [hash(sid), id, csrf],
    );
    users.push({ cookie: "ep_session=" + sid, csrf });
  }
  let probes = 0;
  const ready = readinessProbe(async () => {
    probes++;
    const r = await fetch(api + "/api/auth/me");
    await r.arrayBuffer();
    return r.ok;
  });
  gateway = publicGateway({
    origin: "https://soak.example.test",
    apiPort: Number(new URL(api).port),
    webPort: Number(new URL(api).port),
    ready,
  });
  await new Promise<void>((r) => gateway.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + gateway.address().port;
  const duration = 600000,
    started = Date.now(),
    latencies: number[] = [],
    samples: any[] = [],
    failures: any[] = [];
  let total = 0,
    tick = 0;
  const headers = {
    host: "soak.example.test",
    "x-forwarded-proto": "https",
    "x-forwarded-for": "203.0.113.1",
  };
  async function request(route: string, user: any = null, body?: any) {
    const start = performance.now();
    const r = await fetch(base + route, {
      method: body ? "PUT" : "GET",
      headers: {
        ...headers,
        ...(user ? { cookie: user.cookie, "x-csrf-token": user.csrf } : {}),
        ...(body
          ? { origin: config.url, "content-type": "application/json" }
          : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
    });
    const data = await r.json();
    total++;
    latencies.push(performance.now() - start);
    if (r.status !== 200)
      failures.push({ tick, route, status: r.status, error: data.error });
  }
  while (Date.now() - started < duration) {
    const cycle = Date.now();
    await Promise.all([
      ...users.map((u, i) =>
        request(
          [
            "/api/classroom/embedded/lessons/c01",
            "/api/embedded/exercises",
            "/api/classroom/solidworks",
            "/api/classroom/progress",
          ][(i + tick) % 4],
          u,
        ),
      ),
      request("/api/classroom"),
    ]);
    if (tick % 15 === 0)
      await Promise.all(
        users.map((u) =>
          request("/api/classroom/embedded/lessons/c01/progress", u, {
            scene: 1,
            note: "Soak note " + tick,
            checklist: [],
          }),
        ),
      );
    if (tick % 60 === 0) {
      global.gc?.();
      const mem = process.memoryUsage();
      samples.push({
        seconds: Math.round((Date.now() - started) / 1000),
        rssMB: Math.round(mem.rss / 1048576),
        heapMB: Math.round(mem.heapUsed / 1048576),
        pool: pool.totalCount,
        waiting: pool.waitingCount,
      });
      console.log(
        JSON.stringify({
          soakSeconds: Math.round((Date.now() - started) / 1000),
          total,
          failures: failures.length,
          ...samples.at(-1),
        }),
      );
    }
    tick++;
    await new Promise((r) =>
      setTimeout(r, Math.max(0, 1000 - (Date.now() - cycle))),
    );
  }
  global.gc?.();
  const end = process.memoryUsage();
  latencies.sort((a, b) => a - b);
  assert.deepEqual(failures, []);
  assert.equal(pool.waitingCount, 0);
  assert.ok(pool.totalCount <= 8);
  const baseline = samples[Math.min(1, samples.length - 1)];
  assert.ok(
    end.heapUsed / 1048576 - baseline.heapMB < 64,
    "Unbounded retained heap growth",
  );
  assert.ok(end.rss < 700 * 1048576, "Excessive process working set");
  const report = {
    status: "passed",
    checkedAt: new Date().toISOString(),
    durationSeconds: Math.round((Date.now() - started) / 1000),
    requests: total,
    failures,
    concurrentLearners: 4,
    guest: true,
    throughLocalGateway: true,
    readinessProbes: probes,
    p50Ms: Math.round(latencies[Math.floor(latencies.length * 0.5)]),
    p95Ms: Math.round(latencies[Math.floor(latencies.length * 0.95)]),
    p99Ms: Math.round(latencies[Math.floor(latencies.length * 0.99)]),
    samples,
    finalHeapMB: Math.round(end.heapUsed / 1048576),
    finalRssMB: Math.round(end.rss / 1048576),
    scope:
      "10 minute isolated HTTP soak; not a months-long uptime guarantee or a capacity benchmark",
  };
  await fs.writeFile(
    path.join(out, "soak.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  if (gateway) {
    gateway.closeAllConnections();
    await new Promise<void>((r) => gateway.close(() => r()));
  }
  await app?.close();
  await pool.end();
  await env.dispose();
}
