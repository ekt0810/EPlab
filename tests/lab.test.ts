import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { after } from "node:test";
import { createTestEnvironment } from "./environment.js";
const environment = await createTestEnvironment("lab");
after(async () => {
  try {
    await pool.end();
  } finally {
    await environment.dispose();
  }
});
const { pool } = await import("../apps/api/src/db.js");
const { migrate } = await import("../apps/api/src/migrate.js");
const { seed } = await import("../apps/api/src/seed.js");
const { buildApp } = await import("../apps/api/src/server.js");
const { config } = await import("../apps/api/src/config.js");
const { reserveAdmins } = await import("../scripts/admin.js");
const { hashPassword } = await import("../apps/api/src/auth.js");
type Session = { cookie: string; csrf: string };
const pass = "Qa-" + randomBytes(20).toString("hex");
await test("EP LAB current free registration and Lab membership flow", async (t) => {
  assert.equal(
    (await pool.query("SELECT current_database() AS name")).rows[0].name,
    environment.databaseName,
  );
  await migrate();
  await seed();
  let app = await buildApp();
  await app.ready();
  const addresses = new Map<string, string>();
  async function call(
    method: any,
    route: string,
    body?: any,
    session?: Session,
    extra: Record<string, string> = {},
  ) {
    const key = session?.cookie || "guest";
    if (!addresses.has(key))
      addresses.set(key, `127.0.0.${addresses.size + 1}`);
    return app.inject({
      method,
      url: route,
      remoteAddress: addresses.get(key),
      headers: {
        origin: config.url,
        ...(session
          ? { cookie: session.cookie, "x-csrf-token": session.csrf }
          : {}),
        ...extra,
      },
      ...(body === undefined ? {} : { payload: body }),
    });
  }
  async function login(email: string) {
    const r = await call("POST", "/api/auth/login", { email, password: pass });
    assert.equal(r.statusCode, 200, r.body);
    return {
      cookie: r.cookies.map((c) => `${c.name}=${c.value}`).join("; "),
      csrf: r.json().csrf,
    };
  }
  async function tokenFor(email: string) {
    for (const file of await fs.readdir(path.join(config.data, "mail"))) {
      const mail = JSON.parse(
        await fs.readFile(path.join(config.data, "mail", file), "utf8"),
      );
      if (mail.to === email) return mail.text.match(/#token=([a-f0-9]{64})/)[1];
    }
    throw Error("Missing local verification fixture");
  }
  let student!: Session, other!: Session, admin!: Session, studentId!: string;
  try {
    await t.test(
      "register validates phone; verified learner can log in without paid access",
      async () => {
        assert.equal(
          (
            await call("POST", "/api/auth/register", {
              name: "Invalid fixture",
              email: "invalid@example.test",
              password: pass,
            })
          ).statusCode,
          400,
        );
        for (const [name, email, phone] of [
          ["QA Student A", "a@example.test", "0900000001"],
          ["QA Student B", "b@example.test", "0900000002"],
        ]) {
          const r = await call("POST", "/api/auth/register", {
            name,
            email,
            phone,
            password: pass,
          });
          assert.equal(r.statusCode, 200, r.body);
          assert.equal(
            (await call("POST", "/api/auth/login", { email, password: pass }))
              .statusCode,
            403,
          );
          const token = await tokenFor(email);
          assert.equal(
            (await call("POST", "/api/auth/verify", { token })).statusCode,
            200,
          );
          assert.equal(
            (await call("POST", "/api/auth/verify", { token })).statusCode,
            400,
          );
        }
        student = await login("a@example.test");
        other = await login("b@example.test");
        const billing = (await call("GET", "/api/billing")).json();
        assert.equal(billing.mode, "lab");
        assert.equal(billing.price, 0);
        assert.equal(billing.ready, false);
        assert.equal(
          (await call("POST", "/api/orders", {}, student)).statusCode,
          410,
        );
        const me = (
          await call("GET", "/api/auth/me", undefined, student)
        ).json().user;
        studentId = me.id;
        assert.equal(me.active, false);
        assert.equal(me.role, "student");
        assert.equal(
          (await call("GET", "/api/admin/accounts", undefined, student))
            .statusCode,
          403,
        );
      },
    );
    assert.ok(
      student && other,
      "Registration fixture must succeed before dependent cases",
    );
    await reserveAdmins(["one@example.test", "two@example.test"]);
    await pool.query(
      "UPDATE users SET password_hash=$1,verified=true,setup_pending=false WHERE role='admin'",
      [await hashPassword(pass)],
    );
    admin = await login("one@example.test");
    await t.test(
      "membership request enforces CSRF and duplicate protection",
      async () => {
        const body = {
          tracks: ["embedded", "kicad", "solidworks"],
          message: "Synthetic QA request for isolated test only.",
        };
        assert.equal(
          (
            await call("POST", "/api/lab/membership", body, student, {
              "x-csrf-token": "invalid",
            })
          ).statusCode,
          403,
        );
        const r = await call("POST", "/api/lab/membership", body, student);
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(r.json().duplicate, false);
        assert.equal(
          (await call("POST", "/api/lab/membership", body, student)).json()
            .duplicate,
          true,
        );
        assert.equal(
          (await call("GET", "/api/lab/membership", undefined, other)).json()
            .request,
          null,
        );
      },
    );
    await t.test(
      "admin approves free membership, rejects stale revisions, grants all three tracks",
      async () => {
        const r = await call(
          "GET",
          "/api/admin/lab-memberships",
          undefined,
          admin,
        );
        assert.equal(r.statusCode, 200, r.body);
        const item = r.json().items.find((x: any) => x.user_id === studentId);
        assert.ok(item);
        const body = {
          status: "approved",
          revision: item.revision,
          note: "Synthetic QA approval",
        };
        assert.equal(
          (
            await call(
              "PATCH",
              `/api/admin/lab-memberships/${studentId}`,
              body,
              other,
            )
          ).statusCode,
          403,
        );
        const approved = await call(
          "PATCH",
          `/api/admin/lab-memberships/${studentId}`,
          body,
          admin,
        );
        assert.equal(approved.statusCode, 200, approved.body);
        assert.equal(
          (
            await call(
              "PATCH",
              `/api/admin/lab-memberships/${studentId}`,
              body,
              admin,
            )
          ).statusCode,
          409,
        );
        assert.equal(
          (await call("GET", "/api/auth/me", undefined, student)).json().user
            .active,
          true,
        );
        assert.equal(
          (await pool.query("SELECT count(*)::int AS n FROM orders")).rows[0].n,
          0,
        );
        for (const [track, id] of [
          ["embedded", "c01"],
          ["kicad", "e01"],
          ["solidworks", "s01"],
        ])
          assert.equal(
            (
              await call(
                "GET",
                `/api/${track}/exercises/${id}`,
                undefined,
                student,
              )
            ).statusCode,
            200,
          );
      },
    );
    await t.test(
      "current handbook PDFs are correct and guest/unapproved access is blocked",
      async () => {
        const books = (
          await call("GET", "/api/handbooks", undefined, student)
        ).json();
        assert.equal(books.length, 3);
        for (const b of books) {
          assert.ok(b.accessible && b.resourceId);
          const r = await call(
            "GET",
            `/api/files/${b.resourceId}/view`,
            undefined,
            student,
          );
          assert.equal(r.statusCode, 200);
          assert.equal(r.headers["content-type"], "application/pdf");
          const expected = (
            await pool.query("SELECT sha256 FROM resources WHERE id=$1", [
              b.resourceId,
            ])
          ).rows[0].sha256;
          assert.equal(
            createHash("sha256").update(r.rawPayload).digest("hex"),
            expected,
          );
          for (const session of [undefined, other])
            assert.equal(
              (
                await call(
                  "GET",
                  `/api/files/${b.resourceId}/view`,
                  undefined,
                  session,
                )
              ).statusCode,
              403,
            );
        }
      },
    );
    await app.close();
    app = await buildApp();
    await app.ready();
    const { pathwayConversationCases } =
      await import("./pathway-conversation-cases.js");
    await pathwayConversationCases(t, { call, admin, student, other, pool });
    const { coursePracticeCases } = await import("./course-practice-cases.js");
    await coursePracticeCases(t, {
      app,
      call,
      admin,
      student,
      other,
      studentId,
      pool,
    });
    await app.close();
    app = await buildApp();
    await app.ready();
    const { practiceCases } = await import("./practice-cases.js");
    await practiceCases(t, {
      app,
      call,
      admin,
      student,
      other,
      studentId,
      login,
      pool,
    });
    await t.test(
      "revocation immediately blocks private lessons and downloads",
      async () => {
        admin = await login("one@example.test");
        const books = (
          await call("GET", "/api/handbooks", undefined, student)
        ).json();
        const membership = (
          await call("GET", "/api/lab/membership", undefined, student)
        ).json().request;
        const r = await call(
          "PATCH",
          `/api/admin/lab-memberships/${studentId}`,
          {
            status: "revoked",
            revision: membership.revision,
            note: "End isolated QA access",
          },
          admin,
        );
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(
          (await call("GET", "/api/auth/me", undefined, student)).json().user
            .active,
          false,
        );
        assert.equal(
          (await call("GET", "/api/embedded/exercises/c01", undefined, student))
            .statusCode,
          403,
        );
        for (const book of books)
          assert.equal(
            (
              await call(
                "GET",
                `/api/files/${book.resourceId}/view`,
                undefined,
                student,
              )
            ).statusCode,
            403,
          );
      },
    );
  } finally {
    await app.close();
  }
});
