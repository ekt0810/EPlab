import { readinessProbe } from "../scripts/readiness-probe.js";
import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { ngrokOrigin, ngrokConfig } from "../scripts/ngrok-settings.js";
import { publicGateway, upstreamHeaders } from "../scripts/public-gateway.js";

const origin = "https://fixture.ngrok-free.app";
test("ngrok setup allows only assigned free HTTPS domains and no token injection", () => {
  assert.equal(ngrokOrigin("fixture.ngrok-free.app"), origin);
  assert.equal(
    ngrokOrigin("https://fixture.ngrok-free.dev/"),
    "https://fixture.ngrok-free.dev",
  );
  for (const value of [
    "example.com",
    "fixture.ngrok.app",
    "http://fixture.ngrok-free.app",
    "https://user:pass@fixture.ngrok-free.app",
    "https://fixture.ngrok-free.app/?token=x",
    "https://fixture.ngrok-free.app.evil.test",
  ])
    assert.throws(() => ngrokOrigin(value));
  assert.throws(() => ngrokConfig("fake-token\n  web_addr: 0.0.0.0:4041"));
});

test(
  "installed ngrok accepts the private configuration schema without connecting",
  { skip: process.platform !== "win32" },
  async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "eplab-ngrok-test-"));
    try {
      const file = path.join(dir, "ngrok.yml");
      await fs.writeFile(
        file,
        ngrokConfig("fictional_token_for_schema_test_only"),
      );
      const binary = path.join(
        process.env.LOCALAPPDATA!,
        "Microsoft/WindowsApps/ngrok.exe",
      );
      const result = await promisify(execFile)(
        binary,
        ["config", "check", "--config", file],
        { windowsHide: true, timeout: 10000 },
      );
      assert.match(result.stdout, /valid/i);
    } finally {
      assert.equal(path.dirname(dir), os.tmpdir());
      assert.ok(path.basename(dir).startsWith("eplab-ngrok-test-"));
      await fs.rm(dir, { recursive: true });
    }
  },
);

test("forwarded IP and scheme use only the last value appended by ngrok", () => {
  const headers = upstreamHeaders(
    {
      headers: {
        host: "fixture.ngrok-free.app",
        "x-forwarded-for": "1.2.3.4, 203.0.113.20",
        "x-forwarded-proto": "http, https",
        "x-forwarded-host": "evil.test",
        forwarded: "for=1.2.3.4",
        "x-real-ip": "1.2.3.4",
        connection: "keep-alive, x-untrusted",
        "x-untrusted": "bad",
      },
    },
    origin,
  );
  assert.equal(headers["x-forwarded-for"], "203.0.113.20");
  assert.equal(headers["x-forwarded-proto"], "https");
  assert.equal(headers["x-forwarded-host"], "fixture.ngrok-free.app");
  assert.ok(
    !headers.forwarded && !headers["x-real-ip"] && !headers["x-untrusted"],
  );
  assert.throws(() =>
    upstreamHeaders(
      {
        headers: {
          host: "wrong.test",
          "x-forwarded-proto": "https",
          "x-forwarded-for": "203.0.113.20",
        },
      },
      origin,
    ),
  );
  assert.throws(() =>
    upstreamHeaders(
      {
        headers: {
          host: "fixture.ngrok-free.app",
          "x-forwarded-proto": "https",
          "x-forwarded-for": "fake",
        },
      },
      origin,
    ),
  );
});

test("gateway fails closed, routes API/web, preserves uploads/cookies and enforces body limits", async () => {
  let ready = false,
    apiCalls = 0,
    webCalls = 0;
  const make = (kind: string) =>
    http.createServer((req, res) => {
      if (kind === "api") apiCalls++;
      else webCalls++;
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        res.setHeader(
          "set-cookie",
          "fixture=value; HttpOnly; Secure; SameSite=Lax",
        );
        res.end(JSON.stringify({ kind, body, headers: req.headers }));
      });
    });
  const api = make("api"),
    web = make("web");
  const listen = (server: http.Server) =>
    new Promise<number>((resolve) =>
      server.listen(0, "127.0.0.1", () =>
        resolve((server.address() as net.AddressInfo).port),
      ),
    );
  const apiPort = await listen(api),
    webPort = await listen(web);
  const gateway = publicGateway({
    origin,
    ready: async () => ready,
    apiPort,
    webPort,
  });
  const port = await listen(gateway);
  const call = (
    route: string,
    extra: Record<string, string> = {},
    body?: string,
  ) =>
    new Promise<{
      status: number;
      body: string;
      headers: http.IncomingHttpHeaders;
    }>((resolve, reject) => {
      const request = http.request(
        {
          host: "127.0.0.1",
          port,
          path: route,
          method: body ? "POST" : "GET",
          headers: {
            host: "fixture.ngrok-free.app",
            "x-forwarded-for": "1.2.3.4, 203.0.113.20",
            "x-forwarded-proto": "http, https",
            ...extra,
          },
        },
        (response) => {
          let content = "";
          response.on("data", (chunk) => (content += chunk));
          response.on("end", () =>
            resolve({
              status: response.statusCode!,
              body: content,
              headers: response.headers,
            }),
          );
        },
      );
      request.on("error", reject);
      request.end(body);
    });
  try {
    assert.equal((await call("/api/private")).status, 503);
    assert.equal(apiCalls + webCalls, 0);
    ready = true;
    const response = await call(
      "/api/submit",
      { "content-type": "text/plain", origin, cookie: "test=session" },
      "source-code\nint main() {}",
    );
    assert.equal(response.status, 200);
    const data = JSON.parse(response.body);
    assert.equal(data.kind, "api");
    assert.equal(data.body, "source-code\nint main() {}");
    assert.equal(data.headers.origin, origin);
    assert.equal(data.headers.cookie, "test=session");
    assert.equal(data.headers["x-forwarded-for"], "203.0.113.20");
    assert.match(response.headers["set-cookie"]![0], /Secure/);
    assert.match(
      String(response.headers["strict-transport-security"]),
      /max-age/,
    );
    assert.equal(JSON.parse((await call("/kicad")).body).kind, "web");
    assert.equal(
      (
        await call("/api/submit", {
          "content-length": String(28 * 1024 * 1024),
        })
      ).status,
      413,
    );
    assert.equal((await call("//evil.test/path")).status, 400);
    ready = false;
    assert.equal((await call("/api/private")).status, 503);
    assert.equal(apiCalls, 1);
    assert.equal(webCalls, 1);
  } finally {
    for (const server of [gateway, api, web]) {
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  }
});

test("public readiness coalesces asset bursts, expires and fails closed on probe errors", async () => {
  let now = 1000,
    calls = 0,
    healthy = true;
  const ready = readinessProbe(
    async () => {
      calls++;
      if (!healthy) throw new Error("Unavailable");
      return true;
    },
    1000,
    () => now,
  );
  assert.ok(
    (await Promise.all(Array.from({ length: 200 }, () => ready()))).every(
      Boolean,
    ),
  );
  assert.equal(calls, 1);
  now = 1999;
  assert.equal(await ready(), true);
  assert.equal(calls, 1);
  now = 2000;
  healthy = false;
  assert.equal(await ready(), false);
  assert.equal(calls, 2);
  now = 3000;
  healthy = true;
  assert.equal(await ready(), true);
  assert.equal(calls, 3);
});
