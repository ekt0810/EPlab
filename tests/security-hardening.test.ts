import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { createTestEnvironment } from "./environment.js";
const env = await createTestEnvironment("security");
const { pool, tx } = await import("../apps/api/src/db.js");
const { migrate } = await import("../apps/api/src/migrate.js");
const { seed } = await import("../apps/api/src/seed.js");
const { buildApp } = await import("../apps/api/src/server.js");
const { config } = await import("../apps/api/src/config.js");
const { hash, encrypt } = await import("../apps/api/src/security.js");
const { hashPassword } = await import("../apps/api/src/auth.js");
await migrate();
await seed();
const app = await buildApp();
await app.ready();
after(async () => {
  await app.close();
  await pool.end();
  await env.dispose();
});
const password = "Security-fixture-" + randomBytes(10).toString("hex");
const user = (
  await pool.query(
    "INSERT INTO users(email,name,password_hash,verified,mfa_secret) VALUES('mfa-review@example.test','MFA fixture',$1,true,$2) RETURNING id",
    [await hashPassword(password), encrypt("JBSWY3DPEHPK3PXP")],
  )
).rows[0];
await pool.query(
  "INSERT INTO lab_memberships(user_id,status,tracks,message) VALUES($1,'approved',ARRAY['embedded','kicad','solidworks'],'Security fixture membership')",
  [user.id],
);
const legacy = (
  await pool.query(
    "SELECT id,slug FROM lessons WHERE preview=true AND audience='student' LIMIT 1",
  )
).rows[0];
await pool.query(
  "INSERT INTO progress(user_id,lesson_id,note,completed) VALUES($1,$2,'PRIVATE_LEGACY_NOTE',true)",
  [user.id, legacy.id],
);
await pool.query(
  "INSERT INTO classroom_progress(user_id,track,lesson_id,note,completed) VALUES($1,'embedded','cb01','PRIVATE_CLASSROOM_NOTE',true)",
  [user.id],
);
await pool.query(
  "INSERT INTO classroom_messages(user_id,track,lesson_id,role,question,answer,mode) VALUES($1,'embedded','cb01','teacher','PRIVATE_QUESTION','PRIVATE_ANSWER','guide')",
  [user.id],
);
const login = await app.inject({
  method: "POST",
  url: "/api/auth/login",
  headers: { origin: config.url },
  payload: { email: "mfa-review@example.test", password },
});
assert.equal(login.statusCode, 200);
assert.equal(login.json().mfaRequired, true);
const cookie = login.cookies[0].name + "=" + login.cookies[0].value;
const get = (url: string) =>
  app.inject({ method: "GET", url, headers: { cookie } });

test("pending MFA never exposes personal notes or classroom history on public previews", async () => {
  const legacyResult = await get("/api/lessons/" + legacy.slug);
  assert.equal(legacyResult.statusCode, 200);
  assert.equal(legacyResult.json().progress, null);
  const classroom = await get("/api/classroom/embedded/lessons/cb01");
  assert.equal(classroom.statusCode, 200);
  assert.equal(classroom.json().progress, null);
  assert.deepEqual(classroom.json().messages, []);
  const catalog = await get("/api/classroom/embedded");
  assert.ok(catalog.json().lessons.every((l: any) => l.progress === null));
  for (const url of [
    "/api/progress",
    "/api/classroom/embedded/report",
    "/api/embedded/submissions",
    "/api/admin/users",
  ])
    assert.equal((await get(url)).statusCode, 403, url);
});

test("completing MFA restores private data and expired/forged sessions do not", async () => {
  const sid = randomBytes(32).toString("hex"),
    csrf = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO sessions(id,user_id,csrf,mfa_verified,expires_at) VALUES($1,$2,$3,true,now()+interval '1 hour')",
    [hash(sid), user.id, csrf],
  );
  const response = await app.inject({
    url: "/api/classroom/embedded/lessons/cb01",
    headers: { cookie: "ep_session=" + sid },
  });
  assert.equal(response.json().progress.note, "PRIVATE_CLASSROOM_NOTE");
  assert.equal(response.json().messages[0].answer, "PRIVATE_ANSWER");
  await pool.query(
    "UPDATE sessions SET expires_at=now()-interval '1 minute' WHERE id=$1",
    [hash(sid)],
  );
  const expired = await app.inject({
    url: "/api/classroom/embedded/lessons/cb01",
    headers: { cookie: "ep_session=" + sid },
  });
  assert.equal(expired.json().progress, null);
  assert.equal(
    (
      await app.inject({
        url: "/api/admin/users",
        headers: {
          cookie: "ep_session=" + randomBytes(32).toString("hex"),
          "x-forwarded-for": "127.0.0.1",
        },
      })
    ).statusCode,
    401,
  );
});

test("SQL injection input and oversized JSON fail without changing users", async () => {
  const before = (await pool.query("SELECT count(*)::int AS n FROM users"))
    .rows[0].n;
  for (const url of [
    "/api/lessons/" + encodeURIComponent("';DROP TABLE users;--"),
    "/api/files/" + encodeURIComponent("../../.env"),
    "/api/embedded/submissions/not-a-uuid",
  ]) {
    const r = await app.inject({ url });
    assert.ok([400, 401, 403, 404].includes(r.statusCode), r.body);
    assert.doesNotMatch(
      r.body,
      /password_hash|DATABASE_URL|SECRET_KEY|SELECT .*FROM|\.env=/,
    );
  }
  const over = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    headers: { origin: config.url },
    payload: { email: "review@example.test", password: "a".repeat(160000) },
  });
  assert.equal(over.statusCode, 413);
  assert.equal(
    (await pool.query("SELECT count(*)::int AS n FROM users")).rows[0].n,
    before,
  );
});
