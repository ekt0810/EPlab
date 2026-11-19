import { startBrowserEnvironment } from "./browser-environment.js";
import { coursePracticeBrowser } from "./course-practice-browser.js";
import assert from "node:assert/strict";
import path from "node:path";
import fs from "node:fs/promises";
const env = await startBrowserEnvironment();
const { pool, config, password, browser, stop } = env;
try {
  const email = `practice-${Date.now()}@example.test`;
  const user = (
    await pool.query(
      "INSERT INTO users(email,name,password_hash,verified,phone) SELECT $1,'Người tham gia kiểm thử',password_hash,true,'0900000010' FROM users WHERE role='admin' LIMIT 1 RETURNING id",
      [email],
    )
  ).rows[0];
  await pool.query(
    "INSERT INTO lab_memberships(user_id,status,tracks,message) VALUES($1,'approved',ARRAY['embedded','kicad','solidworks'],'Isolated browser fixture')",
    [user.id],
  );
  const studentContext = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  for (const [context, loginEmail] of [
    [studentContext, email],
    [adminContext, "one@example.test"],
  ] as const) {
    const r = await context.request.post(config.url + "/api/auth/login", {
      headers: { origin: config.url },
      data: { email: loginEmail, password },
    });
    assert.equal(r.status(), 200, await r.text());
  }
  const page = await studentContext.newPage(),
    admin = await adminContext.newPage();
  const errors: string[] = [],
    checks: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  admin.on("pageerror", (e) => errors.push(e.message));
  const out = path.join(config.root, "test-results/practice-workflow");
  await fs.mkdir(out, { recursive: true });
  await coursePracticeBrowser({
    page,
    admin,
    email,
    base: config.url,
    out,
    checks,
  });
  assert.deepEqual(errors, []);
  const report = {
    status: "passed",
    checkedAt: new Date().toISOString(),
    checks,
    errors,
  };
  await fs.writeFile(
    path.join(out, "check.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await stop();
}
