import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { after } from "node:test";
import { createTestEnvironment } from "./environment.js";
const environment = await createTestEnvironment("legacy");
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
const { reserveAdmins } = await import("../scripts/admin.js");
const { hashPassword } = await import("../apps/api/src/auth.js");
const { config } = await import("../apps/api/src/config.js");
const { parseVietQR } = await import("../apps/api/src/qr.js");
const { storage } = await import("../apps/api/src/storage.js");
const { encrypt, decrypt } = await import("../apps/api/src/security.js");
type Session = { cookie: string; csrf: string };
const pass = "Test-" + randomBytes(18).toString("hex");
await test("EP LAB — PostgreSQL, authentication, authorization and legacy paid-mode regression", async (t) => {
  assert.equal(
    (await pool.query("SELECT current_database() AS db")).rows[0].db,
    environment.databaseName,
  );
  await migrate();
  await seed();
  // Preserve legacy billing regression coverage only in this disposable database.
  await pool.query(
    "UPDATE settings SET value='\"paid\"' WHERE key='access_mode'",
  );
  let app = await buildApp();
  await app.ready();
  const testAddresses = new Map<string, string>();
  async function call(
    method: any,
    url: string,
    body?: any,
    s?: Session,
    extra: Record<string, string> = {},
  ) {
    const key = s?.cookie || "anonymous";
    if (!testAddresses.has(key))
      testAddresses.set(key, `127.0.0.${testAddresses.size + 1}`);
    return app.inject({
      remoteAddress: testAddresses.get(key),
      method,
      url,
      headers: {
        origin: config.url,
        ...(s ? { cookie: s.cookie, "x-csrf-token": s.csrf } : {}),
        ...extra,
      },
      ...(body !== undefined ? { payload: body } : {}),
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
  async function findToken(email: string) {
    const files = await fs.readdir(path.join(config.data, "mail"));
    for (const f of files.reverse()) {
      const m = JSON.parse(
        await fs.readFile(path.join(config.data, "mail", f), "utf8"),
      );
      if (m.to === email) return m.text.match(/#token=([a-f0-9]{64})/)[1];
    }
    throw new Error("No local email");
  }
  let admin!: Session,
    student!: Session,
    other!: Session,
    studentId!: string,
    order: any,
    paidLesson: any,
    firstLesson: any,
    textbook: any;
  try {
    await t.test(
      "seed has exactly three tracks and seven free previews; rerun preserves edits",
      async () => {
        assert.equal((await call("GET", "/api/courses")).json().length, 3);
        assert.equal((await call("GET", "/api/previews")).json().length, 7);
        const embeddedVideos = (
          await pool.query(
            "SELECT video_url,author,preview FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE c.category='embedded' AND l.video_url IS NOT NULL ORDER BY l.position",
          )
        ).rows;
        assert.deepEqual(
          embeddedVideos.map((l) => l.video_url),
          [
            "https://www.youtube.com/watch?v=rVSXMW4fJzA",
            "https://www.youtube.com/watch?v=Ekb3uwhQrqg",
            "https://www.youtube.com/watch?v=oUjk4myxqhs",
          ],
        );
        assert.ok(
          embeddedVideos.every(
            (l) => l.author === "Lập Trình Nhúng A-Z" && l.preview,
          ),
        );
        const kicad = (
          await pool.query(
            "SELECT l.author,l.video_url,l.preview,l.rights,l.software_version FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE c.category='kicad' AND l.video_url IS NOT NULL ORDER BY l.position",
          )
        ).rows;
        assert.equal(kicad.length, 2);
        assert.deepEqual(
          kicad.map((l) => l.video_url),
          [
            "https://www.youtube.com/watch?v=O-zNn5k5Bn4",
            "https://www.youtube.com/watch?v=igQWdVGZGpI",
          ],
        );
        assert.ok(
          kicad.every(
            (l) =>
              l.author === "Phil's Lab" &&
              l.preview &&
              l.rights === "public_reference" &&
              l.software_version.includes("KiCad 9"),
          ),
        );
        await seed();
        assert.equal(
          (await pool.query("SELECT count(*)::int AS n FROM courses")).rows[0]
            .n,
          3,
        );
        firstLesson = (
          await pool.query("SELECT * FROM lessons WHERE preview LIMIT 1")
        ).rows[0];
        paidLesson = (
          await pool.query(
            "SELECT * FROM lessons WHERE NOT preview AND status='draft' AND content!='' LIMIT 1",
          )
        ).rows[0];
      },
    );
    await t.test(
      "anonymous users cannot fetch draft/premium content, answers or admin API",
      async () => {
        assert.equal(
          (await call("GET", `/api/lessons/${paidLesson.slug}`)).statusCode,
          403,
        );
        assert.equal(
          (await call("GET", `/api/lessons/${firstLesson.slug}/answer`))
            .statusCode,
          401,
        );
        assert.equal((await call("GET", "/api/admin/users")).statusCode, 401);
        const c = (await call("GET", "/api/courses/lap-trinh-nhung-c")).body;
        assert.ok(!c.includes(paidLesson.answer));
        assert.ok(!c.includes("video_url"));
        assert.ok(!c.includes("password_hash"));
      },
    );
    await t.test(
      "registration rejects role escalation and cross-origin writes",
      async () => {
        assert.equal(
          (
            await call("POST", "/api/auth/register", {
              name: "Attacker",
              email: "bad@example.test",
              password: pass,
              role: "admin",
            })
          ).statusCode,
          400,
        );
        assert.equal(
          (
            await call(
              "POST",
              "/api/auth/register",
              { name: "Attacker", email: "bad@example.test", password: pass },
              undefined,
              { origin: "https://evil.example" },
            )
          ).statusCode,
          403,
        );
      },
    );
    await t.test(
      "registration, local email verification, one-use token and login",
      async () => {
        for (const [name, email] of [
          ["Student A", "a@example.test"],
          ["Student B", "b@example.test"],
        ]) {
          assert.equal(
            (
              await call("POST", "/api/auth/register", {
                name,
                email,
                password: pass,
                phone: email === "a@example.test" ? "0900000001" : "0900000002",
              })
            ).statusCode,
            200,
          );
          assert.equal(
            (await call("POST", "/api/auth/login", { email, password: pass }))
              .statusCode,
            403,
          );
          const token = await findToken(email);
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
        studentId = (
          await call("GET", "/api/auth/me", undefined, student)
        ).json().user.id;
      },
    );
    await t.test(
      "reserves two admins idempotently; database rejects third admin",
      async () => {
        await reserveAdmins(["one@example.test", "two@example.test"]);
        const before = (
          await pool.query("SELECT password_hash FROM users WHERE admin_slot=1")
        ).rows[0].password_hash;
        await reserveAdmins(["one@example.test", "two@example.test"]);
        assert.equal(
          (
            await pool.query(
              "SELECT password_hash FROM users WHERE admin_slot=1",
            )
          ).rows[0].password_hash,
          before,
        );
        await assert.rejects(
          pool.query(
            "INSERT INTO users(email,name,password_hash,role,admin_slot) VALUES('three@example.test','Three','x','admin',3)",
          ),
        );
        await assert.rejects(
          pool.query(
            "INSERT INTO users(email,name,password_hash,role) VALUES('three@example.test','Three','x','admin')",
          ),
        );
        await pool.query(
          "UPDATE users SET password_hash=$1,verified=true,setup_pending=false WHERE role='admin'",
          [await hashPassword(pass)],
        );
        admin = await login("one@example.test");
        assert.equal(
          (await call("GET", "/api/auth/me", undefined, admin)).json().user
            .active,
          true,
        );
      },
    );
    await t.test(
      "both admins access every lesson and video without payment, including draft courses",
      async () => {
        const secondAdmin = await login("two@example.test");
        const lessons = (await pool.query("SELECT slug,video_url FROM lessons"))
          .rows;
        for (const session of [admin, secondAdmin]) {
          for (const lesson of lessons) {
            const r = await call(
              "GET",
              `/api/lessons/${lesson.slug}`,
              undefined,
              session,
            );
            assert.equal(r.statusCode, 200, r.body);
            assert.equal(r.json().video_url, lesson.video_url);
          }
        }
        assert.equal(
          (await pool.query("SELECT count(*)::int AS n FROM orders")).rows[0].n,
          0,
        );
        assert.equal(
          (await pool.query("SELECT count(*)::int AS n FROM entitlements"))
            .rows[0].n,
          0,
        );
        const c = (
          await pool.query(
            "SELECT c.* FROM courses c JOIN chapters ch ON ch.course_id=c.id WHERE ch.id=$1",
            [paidLesson.chapter_id],
          )
        ).rows[0];
        await pool.query("UPDATE courses SET status='draft' WHERE id=$1", [
          c.id,
        ]);
        try {
          for (const session of [admin, secondAdmin]) {
            assert.equal(
              (await call("GET", "/api/courses", undefined, session)).json()
                .length,
              3,
            );
            const outline = await call(
              "GET",
              `/api/courses/${c.slug}`,
              undefined,
              session,
            );
            assert.equal(outline.statusCode, 200, outline.body);
            assert.ok(
              outline
                .json()
                .chapters.flatMap((ch: any) => ch.lessons)
                .every((l: any) => l.accessible),
            );
            assert.equal(
              (
                await call(
                  "GET",
                  `/api/lessons/${paidLesson.slug}`,
                  undefined,
                  session,
                )
              ).statusCode,
              200,
            );
            assert.equal(
              (
                await call(
                  "GET",
                  `/api/lessons/${paidLesson.slug}/answer`,
                  undefined,
                  session,
                )
              ).statusCode,
              200,
            );
          }
          assert.equal((await call("GET", "/api/courses")).json().length, 2);
          assert.equal(
            (await call("GET", `/api/courses/${c.slug}`)).statusCode,
            404,
          );
          assert.equal(
            (await call("GET", `/api/courses/${c.slug}`, undefined, student))
              .statusCode,
            404,
          );
        } finally {
          await pool.query("UPDATE courses SET status=$1 WHERE id=$2", [
            c.status,
            c.id,
          ]);
        }
      },
    );
    await t.test(
      "SOLIDWORKS uses the supplied v5 private PDF; admins read every section and guests only introductions",
      async () => {
        const { textbookSha256 } =
          await import("../apps/api/src/content/install-solidworks-textbook.js");
        const lessons = (
          await pool.query(
            "SELECT l.* FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE c.category='solidworks' AND l.audience='student' AND l.slug<>'eplab-giao-trinh-solidworks-v5'",
          )
        ).rows;
        assert.equal(lessons.length, 9);
        assert.ok(
          lessons.every(
            (l) =>
              l.video_type === "none" &&
              l.video_url === null &&
              !l.embed_verified,
          ),
        );
        assert.equal(lessons.filter((l) => l.preview).length, 2);
        const book = lessons.find((l) => l.slug === "solidworks-thuc-hanh");
        textbook = (
          await pool.query("SELECT * FROM resources WHERE id=$1", [
            book.document_resource_id,
          ])
        ).rows[0];
        assert.equal(textbook.sha256, textbookSha256);
        assert.equal(Number(textbook.size), 800035);
        for (const intro of lessons.filter((l) => l.preview)) {
          const r = await call("GET", `/api/lessons/${intro.slug}`);
          assert.equal(r.statusCode, 200);
          assert.deepEqual(r.json().resources, []);
          assert.equal(r.json().document_resource_id, null);
        }
        for (const session of [undefined, student]) {
          assert.equal(
            (await call("GET", `/api/lessons/${book.slug}`, undefined, session))
              .statusCode,
            403,
          );
          for (const suffix of ["", "/view"])
            assert.equal(
              (
                await call(
                  "GET",
                  `/api/files/${textbook.id}${suffix}`,
                  undefined,
                  session,
                )
              ).statusCode,
              403,
            );
        }
        const outline = await call("GET", "/api/courses/thiet-ke-solidworks");
        assert.ok(!outline.body.includes("document_resource_id"));
        assert.ok(!outline.body.includes(textbook.id));
        for (const l of lessons.filter((l) => !l.preview)) {
          const r = await call(
            "GET",
            `/api/lessons/${l.slug}`,
            undefined,
            admin,
          );
          assert.equal(r.statusCode, 200);
          assert.equal(r.json().resources[0].id, textbook.id);
          assert.equal(r.json().document_page_start, l.document_page_start);
          assert.equal(r.json().document_page_end, l.document_page_end);
        }
        for (const session of [admin, await login("two@example.test")]) {
          const r = await call(
            "GET",
            `/api/files/${textbook.id}/view`,
            undefined,
            session,
          );
          assert.equal(r.statusCode, 200);
          assert.equal(r.headers["content-type"], "application/pdf");
          assert.ok(
            String(r.headers["content-disposition"]).startsWith("inline;"),
          );
          assert.equal(r.headers["cache-control"], "private, no-store");
          assert.equal(
            createHash("sha256").update(r.rawPayload).digest("hex"),
            textbookSha256,
          );
        }
        const before = (
          await pool.query(
            "SELECT row_to_json(l) AS row FROM lessons l WHERE id=$1",
            [book.id],
          )
        ).rows[0];
        const { tx } = await import("../apps/api/src/db.js");
        const { installSolidworksTextbook } =
          await import("../apps/api/src/content/install-solidworks-textbook.js");
        assert.equal((await tx(installSolidworksTextbook)).updated, false);
        await seed();
        assert.deepEqual(
          (
            await pool.query(
              "SELECT row_to_json(l) AS row FROM lessons l WHERE id=$1",
              [book.id],
            )
          ).rows[0],
          before,
        );
        const keys = [
          "chapter_id",
          "slug",
          "title",
          "summary",
          "objectives",
          "prerequisites",
          "content",
          "exercise",
          "answer",
          "status",
          "preview",
          "position",
          "duration_minutes",
          "software_version",
          "video_url",
          "video_type",
          "author",
          "language",
          "source_url",
          "rights",
          "embed_verified",
        ];
        const body = Object.fromEntries(keys.map((k) => [k, book[k]]));
        body.video_type = "reference";
        body.video_url = "https://www.youtube.com/watch?v=O-zNn5k5Bn4";
        body.preview = true;
        const rejected = await call(
          "PUT",
          `/api/admin/lessons/${book.id}`,
          body,
          admin,
        );
        assert.equal(rejected.statusCode, 400);
        assert.ok(rejected.json().error.includes("SOLIDWORKS"));
      },
    );
    await t.test(
      "CSRF, pending-user authorization and ownership are enforced",
      async () => {
        assert.equal(
          (
            await call(
              "PATCH",
              "/api/auth/profile",
              { name: "Hacked" },
              student,
              { "x-csrf-token": "invalid" },
            )
          ).statusCode,
          403,
        );
        assert.equal(
          (await call("GET", "/api/admin/users", undefined, student))
            .statusCode,
          403,
        );
        assert.equal(
          (
            await call(
              "GET",
              `/api/lessons/${paidLesson.slug}`,
              undefined,
              student,
            )
          ).statusCode,
          403,
        );
        assert.equal(
          (await call("POST", "/api/orders", {}, student)).statusCode,
          503,
        );
      },
    );
    await t.test(
      "admin can publish owned practice but cannot monetize public video",
      async () => {
        const data = Object.fromEntries(
          [
            "chapter_id",
            "slug",
            "title",
            "summary",
            "objectives",
            "prerequisites",
            "content",
            "exercise",
            "answer",
            "status",
            "preview",
            "position",
            "duration_minutes",
            "software_version",
            "video_url",
            "video_type",
            "author",
            "language",
            "source_url",
            "rights",
            "embed_verified",
          ].map((k) => [k, paidLesson[k]]),
        );
        data.status = "published";
        let r = await call(
          "PUT",
          `/api/admin/lessons/${paidLesson.id}`,
          data,
          admin,
        );
        assert.equal(r.statusCode, 200, r.body);
        data.video_type = "reference";
        data.video_url = "https://www.youtube.com/watch?v=gL8OoS9E1rw";
        assert.equal(
          (
            await call(
              "PUT",
              `/api/admin/lessons/${paidLesson.id}`,
              data,
              admin,
            )
          ).statusCode,
          400,
        );
        assert.equal(
          (await call("GET", `/api/lessons/${paidLesson.slug}`)).statusCode,
          403,
        );
      },
    );
    const qr =
      "0002010102111531397007040052044600005169946888838550010A000000727012500069704230111516994688880208QRIBFTTA5204513753037045802VN5916NGUYEN KIM TRUNG6006Ha Noi8707CLASSIC63044859";
    await t.test(
      "QR checksum, recipient and encrypted MFA secret round trip",
      async () => {
        assert.equal(parseVietQR(qr).accountNumber, "51699468888");
        assert.equal(parseVietQR(qr).amount, null);
        assert.throws(() => parseVietQR(qr.slice(0, -1) + "0"));
        assert.equal(
          decrypt(encrypt("sensitive-test-secret")),
          "sensitive-test-secret",
        );
      },
    );
    await t.test(
      "billing configuration requires reauthentication",
      async () => {
        const b = {
          price: 150000,
          bankName: "TPBank",
          accountNumber: "51699468888",
          accountHolder: "NGUYEN KIM TRUNG",
          enabled: true,
          supportEmail: "support@example.test",
          qrPayload: qr,
        };
        assert.equal(
          (await call("PUT", "/api/admin/settings", b, admin)).statusCode,
          403,
        );
        const reauthenticated = await call(
          "POST",
          "/api/auth/reauth",
          { password: pass },
          admin,
        );
        assert.equal(reauthenticated.statusCode, 200, reauthenticated.body);
        admin = {
          cookie: reauthenticated.cookies
            .map((c) => `${c.name}=${c.value}`)
            .join("; "),
          csrf: reauthenticated.json().csrf,
        };
        const r = await call("PUT", "/api/admin/settings", b, admin);
        assert.equal(r.statusCode, 200, r.body);
        assert.equal((await call("GET", "/api/billing")).json().ready, true);
      },
    );
    await t.test(
      "server sets price; duplicate order creation returns one pending order",
      async () => {
        assert.equal(
          (
            await call(
              "POST",
              "/api/orders",
              { amount: 1, user_id: studentId },
              student,
            )
          ).statusCode,
          400,
        );
        const rr = await Promise.all([
          call("POST", "/api/orders", {}, student),
          call("POST", "/api/orders", {}, student),
        ]);
        assert.equal(rr[0].statusCode, 200, rr[0].body);
        assert.equal(rr[1].statusCode, 200, rr[1].body);
        order = rr[0].json();
        assert.equal(order.id, rr[1].json().id);
        assert.equal(order.amount, 150000);
        assert.equal(
          (await call("POST", "/api/orders", {}, admin)).statusCode,
          409,
        );
      },
    );
    await t.test(
      "student cannot read another order or its payment QR",
      async () => {
        assert.equal(
          (await call("GET", `/api/orders/${order.id}`, undefined, other))
            .statusCode,
          404,
        );
        assert.equal(
          (await call("GET", `/api/orders/${order.id}/qr`, undefined, other))
            .statusCode,
          404,
        );
        const r = await call(
          "GET",
          `/api/orders/${order.id}/qr`,
          undefined,
          student,
        );
        assert.equal(r.statusCode, 200, r.body);
        assert.ok(r.json().image.startsWith("data:image/png;base64,"));
      },
    );
    await t.test(
      "reporting transfer and forged webhook never grant access",
      async () => {
        assert.equal(
          (await call("POST", `/api/orders/${order.id}/report`, {}, student))
            .statusCode,
          200,
        );
        assert.equal(
          (
            await call("POST", "/api/payments/webhook", {
              status: "paid",
              orderId: order.id,
              amount: 150000,
            })
          ).statusCode,
          503,
        );
        assert.equal(
          (
            await call(
              "GET",
              `/api/lessons/${paidLesson.slug}`,
              undefined,
              student,
            )
          ).statusCode,
          403,
        );
        assert.equal(
          (
            await call(
              "POST",
              `/api/admin/orders/${order.id}/approve`,
              {},
              student,
            )
          ).statusCode,
          403,
        );
      },
    );
    await t.test(
      "wrong amount/account do not activate; concurrent valid approvals are idempotent",
      async () => {
        const b = {
          reference: "BANK-TEST-000001",
          amount: 1,
          accountNumber: "51699468888",
          note: "Verified in dedicated test fixtures only",
          confirmed: true,
        };
        assert.equal(
          (
            await call(
              "POST",
              `/api/admin/orders/${order.id}/approve`,
              b,
              admin,
            )
          ).statusCode,
          409,
        );
        b.amount = 150000;
        b.accountNumber = "9999";
        assert.equal(
          (
            await call(
              "POST",
              `/api/admin/orders/${order.id}/approve`,
              b,
              admin,
            )
          ).statusCode,
          409,
        );
        b.accountNumber = "51699468888";
        const r = await Promise.all([
          call("POST", `/api/admin/orders/${order.id}/approve`, b, admin),
          call("POST", `/api/admin/orders/${order.id}/approve`, b, admin),
        ]);
        assert.equal(r[0].statusCode, 200, r[0].body);
        assert.equal(r[1].statusCode, 200, r[1].body);
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int AS n FROM payment_transactions",
            )
          ).rows[0].n,
          1,
        );
        assert.equal(
          (
            await pool.query(
              "SELECT count(*)::int AS n FROM entitlements WHERE active",
            )
          ).rows[0].n,
          1,
        );
      },
    );
    await t.test(
      "payment unlocks all published member content and keeps answers separate",
      async () => {
        const r = await call(
          "GET",
          `/api/lessons/${paidLesson.slug}`,
          undefined,
          student,
        );
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(r.json().answer, undefined);
        assert.equal(
          (
            await call(
              "GET",
              `/api/lessons/${paidLesson.slug}/answer`,
              undefined,
              student,
            )
          ).json().answer,
          paidLesson.answer,
        );
        assert.equal(
          (await call("POST", "/api/orders", {}, student)).statusCode,
          409,
        );
      },
    );
    await t.test(
      "activated learner opens and downloads the PDF with identical bytes; draft course revokes reading",
      async () => {
        const r = await call(
          "GET",
          "/api/lessons/solidworks-lo-trinh-5",
          undefined,
          student,
        );
        assert.equal(r.statusCode, 200);
        assert.equal(r.json().document_page_start, 20);
        assert.equal(r.json().document_page_end, 25);
        assert.equal(r.json().resources[0].id, textbook.id);
        for (const suffix of ["", "/view"]) {
          const pdf = await call(
            "GET",
            `/api/files/${textbook.id}${suffix}`,
            undefined,
            student,
          );
          assert.equal(pdf.statusCode, 200);
          assert.equal(
            createHash("sha256").update(pdf.rawPayload).digest("hex"),
            textbook.sha256,
          );
        }
        await pool.query(
          "UPDATE courses SET status='draft' WHERE category='solidworks'",
        );
        try {
          assert.equal(
            (
              await call(
                "GET",
                `/api/files/${textbook.id}/view`,
                undefined,
                student,
              )
            ).statusCode,
            403,
          );
          assert.equal(
            (
              await call(
                "GET",
                `/api/files/${textbook.id}/view`,
                undefined,
                admin,
              )
            ).statusCode,
            200,
          );
        } finally {
          await pool.query(
            "UPDATE courses SET status='published' WHERE category='solidworks'",
          );
        }
      },
    );
    const { handbookCases } = await import("./handbook-cases.js");
    await handbookCases(t, { call, admin, student, other, pool, login });
    const { hubCases } = await import("./hub-cases.js");
    await hubCases(t, { call, admin, student, other, pool, login });
    // A fresh in-process app isolates the expanded suite's request budget.
    // Production rate limits remain enabled and unchanged.
    await app.close();
    app = await buildApp();
    await app.ready();
    const { accountCases } = await import("./account-cases.js");
    await accountCases(t, {
      call,
      admin,
      student,
      other,
      pool,
      findToken,
      pass,
      paidLesson,
      config,
    });
    await app.close();
    app = await buildApp();
    await app.ready();
    const { practiceCases } = await import("./practice-cases.js");
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
      "progress and private notes are durable and isolated by user",
      async () => {
        assert.equal(
          (
            await call(
              "PUT",
              `/api/progress/${paidLesson.slug}`,
              { completed: true, note: "private-note-A" },
              student,
            )
          ).statusCode,
          200,
        );
        assert.equal(
          (await call("GET", "/api/progress", undefined, student)).json()[0]
            .note,
          "private-note-A",
        );
        assert.equal(
          (await call("GET", "/api/progress", undefined, other)).json().length,
          0,
        );
      },
    );
    await t.test(
      "private downloads require entitlement and are not static assets",
      async () => {
        const key = "11111111-2222-4333-8444-555555555555";
        await storage.remove(key);
        await storage.put(key, Buffer.from("private lab content"));
        const r = (
          await pool.query(
            "INSERT INTO resources(lesson_id,name,storage_key,content_type,size,sha256) VALUES($1,'lab.txt',$2,'text/plain',19,$3) RETURNING id",
            [
              paidLesson.id,
              key,
              createHash("sha256").update("private lab content").digest("hex"),
            ],
          )
        ).rows[0];
        assert.equal((await call("GET", `/api/files/${r.id}`)).statusCode, 403);
        assert.equal(
          (await call("GET", `/api/files/${r.id}`, undefined, other))
            .statusCode,
          403,
        );
        const response = await call(
          "GET",
          `/api/files/${r.id}`,
          undefined,
          student,
        );
        assert.equal(response.statusCode, 200, response.body);
        assert.equal(response.body, "private lab content");
        assert.equal(
          (await call("GET", `/api/files/${r.id}/view`, undefined, student))
            .statusCode,
          415,
        );
        assert.ok(
          String(response.headers["content-disposition"]).includes(
            "attachment",
          ),
        );
        assert.equal(response.headers["cache-control"], "private, no-store");
      },
    );
    await t.test(
      "unpublishing a course also protects answers, progress and attachments",
      async () => {
        const courseId = (
          await pool.query("SELECT course_id FROM chapters WHERE id=$1", [
            paidLesson.chapter_id,
          ])
        ).rows[0].course_id;
        const resourceId = (
          await pool.query(
            "SELECT id FROM resources WHERE lesson_id=$1 LIMIT 1",
            [paidLesson.id],
          )
        ).rows[0].id;
        await pool.query("UPDATE courses SET status='draft' WHERE id=$1", [
          courseId,
        ]);
        try {
          assert.equal(
            (
              await call(
                "GET",
                `/api/lessons/${paidLesson.slug}`,
                undefined,
                student,
              )
            ).statusCode,
            404,
          );
          assert.equal(
            (
              await call(
                "GET",
                `/api/lessons/${paidLesson.slug}/answer`,
                undefined,
                student,
              )
            ).statusCode,
            403,
          );
          assert.equal(
            (
              await call(
                "PUT",
                `/api/progress/${paidLesson.slug}`,
                { completed: true, note: "hidden" },
                student,
              )
            ).statusCode,
            403,
          );
          assert.equal(
            (await call("GET", `/api/files/${resourceId}`, undefined, student))
              .statusCode,
            403,
          );
          assert.equal(
            (
              await call(
                "GET",
                `/api/lessons/${paidLesson.slug}`,
                undefined,
                admin,
              )
            ).statusCode,
            200,
          );
          assert.equal(
            (await call("GET", `/api/files/${resourceId}`, undefined, admin))
              .statusCode,
            200,
          );
        } finally {
          await pool.query(
            "UPDATE courses SET status='published' WHERE id=$1",
            [courseId],
          );
        }
      },
    );
    await t.test(
      "upload rejects executable content and accepts a plain C attachment",
      async () => {
        const boundary = "eplab-test-boundary";
        const upload = async (name: string, body: string) =>
          call(
            "POST",
            `/api/admin/lessons/${paidLesson.id}/resources`,
            Buffer.from(
              `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n${body}\r\n--${boundary}--\r\n`,
            ),
            admin,
            { "content-type": `multipart/form-data; boundary=${boundary}` },
          );
        assert.equal((await upload("bad.exe", "MZ malicious")).statusCode, 400);
        const good = await upload("demo.c", "int main(void) { return 0; }");
        assert.equal(good.statusCode, 200, good.body);
      },
    );
    await t.test(
      "blocking a user revokes existing sessions immediately",
      async () => {
        assert.equal(
          (
            await call(
              "PATCH",
              `/api/admin/users/${studentId}`,
              { blocked: true, reason: "Isolated regression test blocking" },
              admin,
            )
          ).statusCode,
          200,
        );
        assert.equal(
          (await call("GET", "/api/auth/me", undefined, student)).json().user,
          null,
        );
        assert.equal(
          (
            await call(
              "GET",
              `/api/lessons/${paidLesson.slug}`,
              undefined,
              student,
            )
          ).statusCode,
          403,
        );
        assert.equal(
          (
            await call(
              "GET",
              `/api/files/${textbook.id}/view`,
              undefined,
              student,
            )
          ).statusCode,
          403,
        );
        await call(
          "PATCH",
          `/api/admin/users/${studentId}`,
          { blocked: false, reason: "Isolated regression test unblocking" },
          admin,
        );
        student = await login("a@example.test");
      },
    );
    await t.test(
      "refund recording revokes entitlement and sessions; no bank transfer is made",
      async () => {
        const r = await call(
          "POST",
          `/api/admin/orders/${order.id}/refund`,
          {
            reference: "REFUND-TEST-0001",
            note: "Confirmed test refund only",
            confirmed: true,
          },
          admin,
        );
        assert.equal(r.statusCode, 200, r.body);
        assert.equal(
          (
            await pool.query(
              "SELECT active FROM entitlements WHERE user_id=$1",
              [studentId],
            )
          ).rows[0].active,
          false,
        );
        assert.equal(
          (
            await pool.query("SELECT status FROM orders WHERE id=$1", [
              order.id,
            ])
          ).rows[0].status,
          "refunded",
        );
        for (const session of [student, await login("a@example.test")])
          assert.equal(
            (
              await call(
                "GET",
                `/api/files/${textbook.id}/view`,
                undefined,
                session,
              )
            ).statusCode,
            403,
          );
      },
    );
    await t.test(
      "password recovery token is one-use and removes active sessions",
      async () => {
        await call("POST", "/api/auth/forgot", { email: "b@example.test" });
        const token = await findToken("b@example.test");
        assert.equal(
          (await call("POST", "/api/auth/reset", { token, password: pass }))
            .statusCode,
          200,
        );
        assert.equal(
          (await call("POST", "/api/auth/reset", { token, password: pass }))
            .statusCode,
          400,
        );
        assert.equal(
          (await call("GET", "/api/auth/me", undefined, other)).json().user,
          null,
        );
      },
    );
    await t.test(
      "public mode lets both password-only admins manage all tracks and access all learning content",
      async () => {
        const previousApp = app;
        app = await buildApp();
        await app.ready();
        const previous = { url: config.url, public: config.public };
        config.url = "https://ep-lab.ngrok-free.app";
        config.public = true;
        try {
          const signedIn = await call("POST", "/api/auth/login", {
            email: "one@example.test",
            password: pass,
          });
          assert.equal(signedIn.statusCode, 200, signedIn.body);
          const cookie = signedIn.cookies.find((c) => c.name === "ep_session");
          assert.equal(cookie?.secure, true);
          assert.equal(cookie?.httpOnly, true);
          assert.equal(cookie?.sameSite, "Lax");
          assert.equal(signedIn.json().mfaRequired, false);
          const unpaid = await login("a@example.test");
          const previews = (await call("GET", "/api/previews")).json();
          assert.equal(previews.length, 7);
          for (const session of [undefined, unpaid]) {
            for (const preview of previews) {
              const lesson = await call(
                "GET",
                `/api/lessons/${preview.slug}`,
                undefined,
                session,
              );
              assert.equal(
                lesson.statusCode,
                200,
                `${preview.slug}: ${lesson.body}`,
              );
              assert.equal(lesson.json().preview, true);
              assert.equal(lesson.json().answer, undefined);
            }
            for (const book of (
              await call("GET", "/api/handbooks", undefined, session)
            ).json()) {
              assert.equal(book.accessible, false);
              assert.equal(book.resourceId, null);
              assert.equal(
                (
                  await call(
                    "GET",
                    `/api/lessons/${book.lessonSlug}`,
                    undefined,
                    session,
                  )
                ).statusCode,
                403,
              );
            }
          }
          const sessions = [
            {
              cookie: signedIn.cookies
                .map((c) => `${c.name}=${c.value}`)
                .join("; "),
              csrf: signedIn.json().csrf,
            },
            await login("two@example.test"),
          ];
          const lessons = (await pool.query("SELECT slug FROM lessons")).rows;
          for (const session of sessions) {
            for (const endpoint of [
              "overview",
              "users",
              "courses",
              "chapters",
              "lessons",
              "orders",
              "audit",
              ...["embedded", "kicad", "solidworks"].flatMap((track) => [
                `${track}/assignments`,
                `${track}/submissions`,
              ]),
            ]) {
              const response = await call(
                "GET",
                `/api/admin/${endpoint}`,
                undefined,
                session,
              );
              assert.equal(
                response.statusCode,
                200,
                `${endpoint}: ${response.body}`,
              );
            }
            for (const lesson of lessons) {
              const response = await call(
                "GET",
                `/api/lessons/${lesson.slug}`,
                undefined,
                session,
              );
              assert.equal(
                response.statusCode,
                200,
                `${lesson.slug}: ${response.body}`,
              );
            }
            const books = (
              await call("GET", "/api/handbooks", undefined, session)
            ).json();
            assert.equal(books.length, 3);
            for (const book of books) {
              assert.ok(book.accessible && book.resourceId);
              const pdf = await call(
                "GET",
                `/api/files/${book.resourceId}/view`,
                undefined,
                session,
              );
              assert.equal(pdf.statusCode, 200);
              assert.equal(pdf.headers["content-type"], "application/pdf");
            }
            const sensitive = await call(
              "POST",
              `/api/admin/orders/${order.id}/refund`,
              {},
              session,
            );
            assert.equal(sensitive.statusCode, 403);
            assert.match(sensitive.body, /xác thực lại mật khẩu/);
          }
          assert.equal(
            (
              await call(
                "GET",
                "/api/admin/users",
                undefined,
                await login("a@example.test"),
              )
            ).statusCode,
            403,
          );
          assert.equal((await call("GET", "/api/admin/users")).statusCode, 401);
          assert.equal(
            (
              await call("POST", "/api/auth/logout", {}, admin, {
                origin: "http://127.0.0.1:3100",
              })
            ).statusCode,
            403,
          );
          assert.equal(
            (await call("GET", "/api/auth/me", undefined, admin)).json()
              .publicMode,
            true,
          );
        } finally {
          Object.assign(config, previous);
          await app.close();
          app = previousApp;
        }
      },
    );
    await t.test(
      "optional MFA still protects accounts that enable it, including in public mode",
      async () => {
        const previousApp = app;
        app = await buildApp();
        await app.ready();
        const previous = { url: config.url, public: config.public };
        config.url = "https://ep-lab.ngrok-free.app";
        config.public = true;
        try {
          const r = await call(
            "POST",
            "/api/auth/mfa/setup",
            { password: pass },
            admin,
          );
          assert.equal(r.statusCode, 200, r.body);
          const secret = r.json().secret;
          const OTPAuth = await import("otpauth");
          const otp = new OTPAuth.TOTP({
            secret: OTPAuth.Secret.fromBase32(secret),
            algorithm: "SHA1",
            digits: 6,
            period: 30,
          });
          const enabled = await call(
            "POST",
            "/api/auth/mfa/enable",
            { code: otp.generate() },
            admin,
          );
          assert.equal(enabled.statusCode, 200, enabled.body);
          assert.equal(enabled.json().recoveryCodes.length, 8);
          const stored = (
            await pool.query("SELECT mfa_secret FROM users WHERE admin_slot=1")
          ).rows[0].mfa_secret;
          assert.notEqual(stored, secret);
          const next = await login("one@example.test");
          const blockedBooks = await call(
            "GET",
            "/api/handbooks",
            undefined,
            next,
          );
          assert.ok(
            blockedBooks
              .json()
              .every((b: any) => !b.accessible && !b.resourceId),
          );
          assert.equal(
            (await call("GET", "/api/admin/users", undefined, next)).statusCode,
            403,
          );
          const recovery = enabled.json().recoveryCodes[0];
          assert.equal(
            (
              await call(
                "GET",
                `/api/lessons/${paidLesson.slug}`,
                undefined,
                next,
              )
            ).statusCode,
            403,
          );
          const verified = await call(
            "POST",
            "/api/auth/mfa/verify",
            { code: recovery },
            next,
          );
          assert.equal(verified.statusCode, 200, verified.body);
          assert.equal(
            (await call("GET", "/api/auth/me", undefined, next)).json().user,
            null,
          );
          next.cookie = verified.cookies
            .map((c) => `${c.name}=${c.value}`)
            .join("; ");
          next.csrf = verified.json().csrf;
          assert.equal(
            (await call("GET", "/api/admin/users", undefined, next)).statusCode,
            200,
          );
          assert.equal(
            (
              await call(
                "GET",
                `/api/lessons/${paidLesson.slug}`,
                undefined,
                next,
              )
            ).statusCode,
            200,
          );
          assert.equal(
            (
              await call(
                "POST",
                "/api/auth/mfa/verify",
                { code: recovery },
                next,
              )
            ).statusCode,
            401,
          );
        } finally {
          Object.assign(config, previous);
          await app.close();
          app = previousApp;
        }
      },
    );
    await t.test(
      "maintenance mode rejects writes without mutating data",
      async () => {
        await pool.query(
          "UPDATE settings SET value='true' WHERE key='maintenance'",
        );
        assert.equal(
          (
            await call("POST", "/api/auth/login", {
              email: "b@example.test",
              password: pass,
            })
          ).statusCode,
          503,
        );
        assert.equal((await call("GET", "/api/health")).statusCode, 200);
        await pool.query(
          "UPDATE settings SET value='false' WHERE key='maintenance'",
        );
      },
    );
  } finally {
    await app.close();
  }
});
