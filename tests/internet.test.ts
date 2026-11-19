import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import dotenv from "dotenv";
import {
  publicOrigin,
  validatePublicSettings,
} from "../apps/api/src/public-config.js";
import {
  smtpTransport,
  smtpSettings,
  smtpFailure,
} from "../apps/api/src/smtp.js";
import { patchEnv, updateEnvFile } from "../scripts/env-file.js";

const sample = {
  SMTP_HOST: "smtp.gmail.com",
  SMTP_PORT: "587",
  SMTP_USER: "sender@example.com",
  SMTP_PASSWORD: "fictional-only",
  SMTP_FROM: "sender@example.com",
  APP_URL: "https://ep-lab.ngrok-free.app",
  MAIL_MODE: "smtp",
};

test("public configuration rejects local/HTTP URLs, injected credentials, paths and incomplete SMTP", () => {
  assert.equal(validatePublicSettings(sample), sample.APP_URL);
  for (const url of [
    "http://ep-lab.ngrok-free.app",
    "https://127.0.0.1",
    "https://[::1]",
    "https://localhost",
    "https://eplab.local",
    "https://ep-lab.ngrok-free.app/a",
    "https://user:pass@ep-lab.ngrok-free.app",
    "https://ep-lab.ngrok-free.app?q=a",
    "https://ep-lab.ngrok-free.app#x",
    "https://example.com",
    "https://ep-lab.ngrok-free.app:444",
  ])
    assert.throws(() => publicOrigin(url));
  assert.throws(() =>
    validatePublicSettings({ ...sample, APP_URL: sample.APP_URL + "/" }),
  );
  for (const key of [
    "SMTP_HOST",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
    "MAIL_MODE",
  ])
    assert.throws(() => validatePublicSettings({ ...sample, [key]: "" }));
  assert.throws(() => smtpSettings({ ...sample, SMTP_PORT: "invalid" }));
});

test("SMTP refuses TLS downgrade before transmitting authentication or a message", async () => {
  const commands: string[] = [];
  const peers = new Set<net.Socket>();
  const server = net.createServer((socket) => {
    peers.add(socket);
    socket.on("close", () => peers.delete(socket));
    socket.on("error", () => {});
    socket.write("220 localhost fake SMTP for test\r\n");
    let buffer = "";
    socket.on("data", (data) => {
      buffer += data.toString();
      let end: number;
      while ((end = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        commands.push(line.split(" ")[0]);
        if (line.startsWith("EHLO"))
          socket.write("250-localhost\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (line === "STARTTLS")
          socket.end("502 STARTTLS unavailable\r\n");
        else socket.end("500 unexpected command\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  const { transport } = smtpTransport({
    ...sample,
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: String(port),
  });
  try {
    await assert.rejects(transport.verify());
    assert.ok(commands.includes("STARTTLS"));
    assert.ok(
      !commands.some((c) => ["AUTH", "MAIL", "RCPT", "DATA"].includes(c)),
    );
  } finally {
    transport.close();
    for (const peer of peers) peer.destroy();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test("SMTP failure messages do not echo provider credentials", () => {
  for (const code of ["EAUTH", "ECONNECTION", "ETIMEDOUT", "OTHER"]) {
    const result = smtpFailure({
      code,
      message: "secret-password auth-token sender@example.com",
    });
    assert.ok(!/secret-password|auth-token|sender@/.test(result));
  }
  assert.equal(
    smtpSettings({ ...sample, SMTP_PORT: "465" }).options.secure,
    true,
  );
});

test("environment editing preserves secrets literally and removes duplicate keys", () => {
  const original =
    "# keep comment\nUNCHANGED='abc#123'\nSMTP_PASSWORD=old\nexport SMTP_PASSWORD=duplicate\n";
  const password = 'dollar$ backtick` quote" hash# backslash\\n';
  const changed = patchEnv(original, {
    SMTP_PASSWORD: password,
    MAIL_MODE: "smtp",
  });
  assert.equal(dotenv.parse(changed).SMTP_PASSWORD, password);
  assert.equal(dotenv.parse(changed).UNCHANGED, "abc#123");
  assert.equal(changed.match(/^SMTP_PASSWORD=/gm)?.length, 1);
  assert.ok(changed.includes("# keep comment"));
  assert.throws(() =>
    patchEnv(original, { SMTP_PASSWORD: "bad\nPUBLIC_MODE=true" }),
  );
  assert.throws(() => patchEnv(original, { "INVALID KEY": "value" }));
});

test("atomic private environment update works without modifying an unrelated key", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "eplab-env-test-"));
  try {
    await fs.writeFile(
      path.join(dir, ".env"),
      "SECRET_KEY=fictional-test\nMAIL_MODE=local\n",
    );
    await updateEnvFile(dir, {
      MAIL_MODE: "smtp",
      SMTP_PASSWORD: "fake-test-only#123",
    });
    const read = dotenv.parse(await fs.readFile(path.join(dir, ".env")));
    assert.equal(read.SECRET_KEY, "fictional-test");
    assert.equal(read.SMTP_PASSWORD, "fake-test-only#123");
    assert.deepEqual(await fs.readdir(path.join(dir, "data/operations")), []);
  } finally {
    assert.equal(path.dirname(dir), os.tmpdir());
    assert.ok(path.basename(dir).startsWith("eplab-env-test-"));
    await fs.rm(dir, { recursive: true });
  }
});
