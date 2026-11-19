import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import sharp from "sharp";
import { config } from "../apps/api/src/config.js";
import { curriculum } from "../apps/api/src/practice/content.js";
export async function practiceCases(
  t: TestContext,
  { app, call, admin, student, other, studentId, login, pool }: any,
) {
  let assignment: any, submission: any;
  const fixture = await sharp({
    create: { width: 900, height: 600, channels: 3, background: "#dae9ed" },
  })
    .png()
    .toBuffer();
  async function upload(
    fields: Record<string, string>,
    buffers = [fixture],
    session = student,
  ) {
    const boundary = "ep-lab-test-boundary";
    const chunks: Buffer[] = [];
    for (const [k, v] of Object.entries(fields))
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`,
        ),
      );
    for (const b of buffers) {
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="images"; filename="circuit.png"\r\nContent-Type: image/png\r\n\r\n`,
        ),
        b,
        Buffer.from("\r\n"),
      );
    }
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return app.inject({
      method: "POST",
      url: "/api/kicad/submissions",
      remoteAddress: "127.0.0.110",
      headers: {
        origin: config.url,
        cookie: session.cookie,
        "x-csrf-token": session.csrf,
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      payload: Buffer.concat(chunks),
    });
  }
  await t.test(
    "KiCad import preserves 24 lessons, 12 exercises and 43 sources; premium study and answer keys stay private",
    async () => {
      const cat = (await call("GET", "/api/kicad/catalog")).json();
      assert.equal(cat.modules.length, 8);
      assert.equal(cat.lessons.length, 24);
      assert.ok(cat.lessons.every((l: any) => !l.accessible));
      assert.equal(
        (await call("GET", "/api/kicad/exercises")).json().length,
        12,
      );
      assert.equal(
        (await call("GET", "/api/kicad/library")).json().videos.length,
        43,
      );
      assert.equal(
        (await call("GET", "/api/lessons/kicad-l01")).statusCode,
        403,
      );
      assert.equal(
        (await call("GET", "/api/kicad/exercises/e03", undefined, other))
          .statusCode,
        403,
      );
      for (const l of curriculum.lessons) {
        const r = await call(
          "GET",
          `/api/lessons/kicad-${l.id}`,
          undefined,
          student,
        );
        assert.equal(r.statusCode, 200);
        assert.deepEqual(r.json().study.concepts, l.concepts);
        assert.equal(r.json().study.quiz.answer, undefined);
        assert.equal(r.json().study.quiz.explanation, undefined);
      }
      const { seed } = await import("../apps/api/src/seed.js");
      await seed();
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM kicad_lessons"))
          .rows[0].n,
        24,
      );
    },
  );
  await t.test(
    "KiCad self-check is server-scored and preserves private notes and earlier passes",
    async () => {
      const url = "/api/kicad/lessons/kicad-l02/quiz";
      assert.equal(
        (await call("POST", url, { answer: 2 }, other)).statusCode,
        403,
      );
      assert.equal(
        (await call("POST", url, { answer: 2, score: 100 }, student))
          .statusCode,
        400,
      );
      await call(
        "PUT",
        "/api/progress/kicad-l02",
        { completed: false, note: "my-kicad-note" },
        student,
      );
      assert.equal(
        (await call("POST", url, { answer: 0 }, student)).json().correct,
        false,
      );
      assert.equal(
        (await call("POST", url, { answer: 2 }, student)).json().correct,
        true,
      );
      await call("POST", url, { answer: 0 }, student);
      const l = (
        await call("GET", "/api/lessons/kicad-l02", undefined, student)
      ).json();
      assert.equal(l.progress.note, "my-kicad-note");
      assert.equal(l.progress.completed, true);
      const q = (
        await pool.query(
          "SELECT passed,attempts FROM quiz_results WHERE user_id=$1",
          [studentId],
        )
      ).rows[0];
      assert.equal(q.passed, true);
      assert.equal(q.attempts, 3);
    },
  );
  await t.test(
    "Admins assign to a student or class, close/reopen work, and learners cannot forge assignments",
    async () => {
      const b = {
        exerciseId: "e03",
        studentId,
        instructions: "Bài kiểm thử: đọc tiêu chí, nộp ảnh và báo cáo ERC.",
        dueAt: new Date(Date.now() + 86400000).toISOString(),
      };
      assert.equal(
        (await call("POST", "/api/admin/kicad/assignments", b, student))
          .statusCode,
        403,
      );
      const r = await call("POST", "/api/admin/kicad/assignments", b, admin);
      assert.equal(r.statusCode, 200, r.body);
      assignment = r.json();
      assert.equal(
        (await call("GET", "/api/kicad/assignments", undefined, other)).json()
          .length,
        0,
      );
      assert.equal(
        (
          await call("GET", "/api/kicad/assignments", undefined, student)
        ).json()[0].id,
        assignment.id,
      );
      const all = await call(
        "POST",
        "/api/admin/kicad/assignments",
        { ...b, studentId: null },
        admin,
      );
      assert.equal(all.statusCode, 200);
      assert.equal(
        (await call("GET", "/api/kicad/assignments", undefined, other)).json()
          .length,
        1,
      );
      const foreign = await call(
        "POST",
        "/api/admin/kicad/assignments",
        {
          ...b,
          studentId: (
            await call("GET", "/api/auth/me", undefined, other)
          ).json().user.id,
        },
        admin,
      );
      const fields = {
        exerciseId: "e03",
        notes: "Test evidence only, not a validated circuit.",
        assignmentId: foreign.json().id,
      };
      assert.equal((await upload(fields)).statusCode, 404);
      fields.assignmentId = assignment.id;
      await call(
        "PATCH",
        `/api/admin/kicad/assignments/${assignment.id}`,
        { closed: true },
        admin,
      );
      assert.equal((await upload(fields)).statusCode, 409);
      await call(
        "PATCH",
        `/api/admin/kicad/assignments/${assignment.id}`,
        { closed: false },
        admin,
      );
      assert.equal(
        (await upload({ ...fields, exerciseId: "e01" })).statusCode,
        404,
      );
    },
  );
  await t.test(
    "Image and KiCad report validation rejects malformed input; duplicate concurrent submissions create one pending manual review",
    async () => {
      const fields = {
        exerciseId: "e03",
        assignmentId: assignment.id,
        notes: "Test evidence only, not a validated circuit.",
        report: JSON.stringify({
          kicad_version: "9.0",
          violations: [{ severity: "error", description: "test" }],
          unconnected_items: [{ severity: "warning" }],
        }),
      };
      assert.equal(
        (await upload(fields, [Buffer.from('<svg onload="alert(1)"></svg>')]))
          .statusCode,
        400,
      );
      assert.equal((await upload({ ...fields, score: "100" })).statusCode, 400);
      assert.equal(
        (await upload({ ...fields, selfChecks: "[]", score: "100" }))
          .statusCode,
        413,
      );
      assert.equal(
        (await upload({ ...fields, report: '{"violations":"fake"}' }))
          .statusCode,
        400,
      );
      assert.equal((await upload(fields, [])).statusCode, 400);
      const over = await upload(fields, [fixture, fixture, fixture]);
      assert.equal(over.statusCode, 413);
      assert.equal((await upload(fields, [fixture], other)).statusCode, 403);
      const results = await Promise.all([upload(fields), upload(fields)]);
      assert.deepEqual(results.map((r) => r.statusCode).sort(), [200, 201]);
      submission = results[0].json();
      assert.equal(submission.status, "pending_manual");
      assert.equal(submission.result, null);
      assert.equal(submission.report.errors, 1);
      assert.equal(submission.report.warnings, 1);
      assert.equal(submission.images, undefined);
      const stored = (
        await pool.query("SELECT images FROM submissions WHERE id=$1", [
          submission.id,
        ])
      ).rows[0];
      assert.ok(
        JSON.parse(stored.images)[0].startsWith("data:image/webp;base64,"),
      );
      const large = Buffer.alloc(5 * 1024 * 1024 + 1);
      assert.equal((await upload(fields, [large])).statusCode, 413);
    },
  );
  await t.test(
    "Submission ownership, private images and admin review authorization are enforced",
    async () => {
      assert.equal(
        (
          await call(
            "GET",
            `/api/kicad/submissions/${submission.id}`,
            undefined,
            other,
          )
        ).statusCode,
        404,
      );
      assert.equal(
        (
          await call(
            "GET",
            `/api/kicad/submissions/${submission.id}/images/0`,
            undefined,
            other,
          )
        ).statusCode,
        404,
      );
      assert.equal(
        (await call("GET", `/api/kicad/submissions/${submission.id}/images/0`))
          .statusCode,
        401,
      );
      assert.equal(
        (await call("GET", "/api/admin/kicad/submissions", undefined, student))
          .statusCode,
        403,
      );
      for (const s of [admin, student]) {
        const r = await call(
          "GET",
          `/api/kicad/submissions/${submission.id}/images/0`,
          undefined,
          s,
        );
        assert.equal(r.statusCode, 200);
        assert.equal(r.headers["content-type"], "image/webp");
        assert.equal(r.headers["cache-control"], "private, no-store");
      }
    },
  );
  await t.test(
    "Manual rubric scoring is calculated on server, retains history and rejects simultaneous stale reviews",
    async () => {
      const body = {
        revision: 0,
        summary: "Kiểm thử luồng chấm thủ công, không chứng nhận ảnh mạch.",
        criteria: curriculum.exercises[2].criteria.map((c, i) => ({
          id: c.id,
          status: i === 3 ? "not_met" : "met",
          evidence: "Bằng chứng kiểm thử do giảng viên ghi nhận.",
          action: "Đối chiếu lại đề bài.",
        })),
      };
      const url = `/api/admin/kicad/submissions/${submission.id}/review`;
      assert.equal((await call("POST", url, body, student)).statusCode, 403);
      assert.equal(
        (await call("POST", url, { ...body, score: 100 }, admin)).statusCode,
        400,
      );
      assert.equal(
        (
          await call(
            "POST",
            url,
            {
              ...body,
              criteria: body.criteria.map((c) => ({ ...c, id: "c1" })),
            },
            admin,
          )
        ).statusCode,
        400,
      );
      const r = await call("POST", url, body, admin);
      assert.equal(r.statusCode, 200, r.body);
      assert.equal(r.json().result.score, 75);
      assert.equal(r.json().result.status, "visual_pass");
      assert.equal((await call("POST", url, body, admin)).statusCode, 409);
      const next = {
        ...body,
        revision: 1,
        criteria: body.criteria.map((c) => ({ ...c, status: "unclear" })),
      };
      const two = await login("two@example.test");
      const results = await Promise.all([
        call("POST", url, next, admin),
        call("POST", url, next, two),
      ]);
      assert.deepEqual(
        results.map((r: any) => r.statusCode).sort(),
        [200, 409],
      );
      const details = (
        await call(
          "GET",
          `/api/kicad/submissions/${submission.id}`,
          undefined,
          student,
        )
      ).json();
      assert.equal(details.status, "needs_review");
      assert.equal(details.result.score, 0);
      assert.equal(details.reviews.length, 2);
      assert.ok(
        details.reviews.every((r: any) => r.result.reviewer === "human"),
      );
      assert.equal(
        (
          await call(
            "POST",
            `/api/kicad/submissions/${submission.id}/retry`,
            {},
            student,
          )
        ).statusCode,
        404,
      );
    },
  );
}
