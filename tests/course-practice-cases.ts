import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import sharp from "sharp";
import { config } from "../apps/api/src/config.js";
import { courseExercises } from "../apps/api/src/practice/course-exercises.js";
import { inspectAttachments } from "../apps/api/src/practice/attachments.js";
export async function coursePracticeCases(
  t: TestContext,
  { app, call, admin, student, other, studentId, pool }: any,
) {
  const image = await sharp({
    create: { width: 400, height: 300, channels: 3, background: "#ddecee" },
  })
    .png()
    .toBuffer();
  const source = Buffer.from(
    "#include <stdint.h>\nint main(void) { return 0; }\n",
  );
  const step = Buffer.from(
    "ISO-10303-21;\nHEADER;\nFILE_DESCRIPTION(('Transport fixture, not a CAD validation'), '2;1');\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n",
  );
  const cad = Buffer.alloc(512);
  Buffer.from("d0cf11e0a1b11ae1", "hex").copy(cad);
  async function upload(
    track: string,
    exerciseId: string,
    attachments: { name: string; bytes: Buffer }[],
    session = student,
    extra: Record<string, string> = {},
  ) {
    const boundary = "course-practice-boundary",
      chunks: Buffer[] = [];
    for (const [key, value] of Object.entries({
      exerciseId,
      notes: "Kiểm thử truyền tệp; chưa xác nhận bài làm đúng.",
      ...extra,
    }))
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
        ),
      );
    for (const f of [
      { name: "result.png", bytes: image, field: "images" },
      ...attachments.map((f) => ({ ...f, field: "attachments" })),
    ])
      chunks.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${f.field}"; filename="${f.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`,
        ),
        f.bytes,
        Buffer.from("\r\n"),
      );
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    return app.inject({
      method: "POST",
      url: `/api/${track}/submissions`,
      remoteAddress: "127.0.0.121",
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
    "self-check evidence is validated, private, persisted and never auto-grades",
    async () => {
      const evidence = [
        {
          index: 0,
          status: "fail",
          observed: "Fixture: observed 1, expected 2; needs feedback.",
        },
      ];
      const sent = await upload(
        "embedded",
        "c04",
        [{ name: "main.c", bytes: source }],
        student,
        { selfChecks: JSON.stringify(evidence) },
      );
      assert.equal(sent.statusCode, 201, sent.body);
      const submission = sent.json();
      assert.deepEqual(submission.self_checks, evidence);
      assert.equal(submission.status, "pending_manual");
      assert.equal(submission.result, null);
      const list = (
        await call("GET", "/api/embedded/exercises", undefined, student)
      ).json();
      assert.deepEqual(list.find((e: any) => e.id === "c04").latest, {
        id: submission.id,
        status: "pending_manual",
      });
      const otherList = (
        await call("GET", "/api/embedded/exercises", undefined, other)
      ).json();
      assert.equal(otherList.find((e: any) => e.id === "c04").latest, null);
      const duplicate = await upload(
        "embedded",
        "c04",
        [{ name: "main.c", bytes: source }],
        student,
        { selfChecks: JSON.stringify(evidence) },
      );
      assert.equal(duplicate.statusCode, 200);
      assert.equal(duplicate.json().id, submission.id);
      for (const invalid of [
        "{",
        JSON.stringify([...evidence, ...evidence]),
        JSON.stringify([{ ...evidence[0], index: 99 }]),
        JSON.stringify([{ ...evidence[0], observed: " " }]),
        JSON.stringify([{ ...evidence[0], status: "visual_pass" }]),
      ]) {
        const bad = await upload(
          "embedded",
          "c04",
          [{ name: "main.c", bytes: source }],
          student,
          { selfChecks: invalid },
        );
        assert.equal(bad.statusCode, 400, bad.body);
      }
      const kicad = (
        await call("GET", "/api/kicad/exercises/e01", undefined, student)
      ).json();
      assert.equal(kicad.checks.length, kicad.criteria.length);
      assert.equal(kicad.checks[0][1], kicad.criteria[0].text);
    },
  );
  await t.test(
    "C and SOLIDWORKS each have 12 actionable exercises; private detail, textbook links and seed are correct",
    async () => {
      for (const track of ["embedded", "solidworks"]) {
        const list = (await call("GET", `/api/${track}/exercises`)).json();
        assert.equal(list.length, 12);
        assert.ok(
          list.every((e: any) => !e.accessible && !e.learn && !e.criteria),
        );
        for (const e of courseExercises.filter((e) => e.track === track)) {
          assert.equal(
            (await call("GET", `/api/${track}/exercises/${e.id}`)).statusCode,
            403,
          );
          const d = (
            await call(
              "GET",
              `/api/${track}/exercises/${e.id}`,
              undefined,
              student,
            )
          ).json();
          assert.ok(
            d.steps.length >= 3 && d.checks.length >= 3 && d.learn.length >= 2,
          );
          assert.equal(
            d.criteria.reduce((n: number, c: any) => n + c.points, 0),
            100,
          );
          if (track === "solidworks")
            assert.equal(
              (
                await pool.query(
                  "SELECT count(*)::int AS n FROM lessons WHERE slug=$1 AND status='published'",
                  [d.reading.slug],
                )
              ).rows[0].n,
              1,
            );
        }
      }
      assert.equal(
        (await call("GET", "/api/kicad/exercises")).json().length,
        12,
      );
      assert.equal(
        (await call("GET", "/api/embedded/exercises/s01", undefined, admin))
          .statusCode,
        404,
      );
      const { seed } = await import("../apps/api/src/seed.js");
      await seed();
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM exercises")).rows[0]
          .n,
        36,
      );
    },
  );
  await t.test(
    "Source/CAD upload validation rejects executable, wrong-course, duplicate, over-size and missing source files",
    async () => {
      assert.equal(
        (await upload("embedded", "c01", [], student)).statusCode,
        400,
      );
      assert.equal(
        (
          await upload("solidworks", "s01", [
            { name: "notes.txt", bytes: Buffer.from("text") },
          ])
        ).statusCode,
        400,
      );
      assert.equal(
        (await upload("embedded", "c01", [{ name: "main.exe", bytes: source }]))
          .statusCode,
        400,
      );
      assert.equal(
        (
          await upload("embedded", "c01", [
            { name: "main.c", bytes: Buffer.from([77, 90, 0, 0]) },
          ])
        ).statusCode,
        400,
      );
      assert.equal(
        (
          await upload("embedded", "c01", [
            { name: "main.c", bytes: source },
            { name: "main.c", bytes: source },
          ])
        ).statusCode,
        400,
      );
      assert.equal(
        (
          await upload("solidworks", "s01", [
            { name: "part.sldprt", bytes: source },
          ])
        ).statusCode,
        400,
      );
      assert.equal(
        (
          await upload(
            "embedded",
            "c01",
            [{ name: "main.c", bytes: source }],
            other,
          )
        ).statusCode,
        403,
      );
      assert.equal(
        (await upload("kicad", "e03", [{ name: "main.c", bytes: source }]))
          .statusCode,
        400,
      );
      assert.throws(() =>
        inspectAttachments([{ name: "../main.c", bytes: source }], "embedded"),
      );
      assert.throws(() =>
        inspectAttachments(
          [{ name: "large.c", bytes: Buffer.alloc(5 * 1024 * 1024 + 1, 65) }],
          "embedded",
        ),
      );
      assert.throws(() =>
        inspectAttachments(
          Array.from({ length: 7 }, (_, i) => ({
            name: `f${i}.c`,
            bytes: source,
          })),
          "embedded",
        ),
      );
      assert.throws(() =>
        inspectAttachments(
          Array.from({ length: 4 }, (_, i) => ({
            name: `f${i}.c`,
            bytes: Buffer.alloc(4 * 1024 * 1024, 65),
          })),
          "embedded",
        ),
      );
      assert.equal(
        inspectAttachments(
          [
            { name: "part.sldprt", bytes: cad },
            { name: "drawing.slddrw", bytes: cad },
            { name: "assembly.sldasm", bytes: cad },
          ],
          "solidworks",
        ).length,
        3,
      );
    },
  );
  for (const [track, id, files] of [
    [
      "embedded",
      "c01",
      [
        { name: "main.c", bytes: source },
        {
          name: "checks.txt",
          bytes: Buffer.from("Results recorded by student"),
        },
      ],
    ],
    [
      "solidworks",
      "s01",
      [
        { name: "part.step", bytes: step },
        { name: "part.sldprt", bytes: cad },
      ],
    ],
  ] as const) {
    await t.test(
      `${track}: assign, submit private files, manual review, resubmit and isolate from other tracks`,
      async () => {
        const assigned = await call(
          "POST",
          `/api/admin/${track}/assignments`,
          {
            exerciseId: id,
            studentId,
            instructions: "Kiểm thử bài giao theo môn",
            dueAt: null,
          },
          admin,
        );
        assert.equal(assigned.statusCode, 200);
        const a = assigned.json();
        const wrongTrack = track === "embedded" ? "solidworks" : "embedded";
        assert.ok(
          !(
            await call(
              "GET",
              `/api/${wrongTrack}/assignments`,
              undefined,
              student,
            )
          )
            .json()
            .some((x: any) => x.id === a.id),
        );
        assert.equal(
          (
            await call(
              "PATCH",
              `/api/admin/${wrongTrack}/assignments/${a.id}`,
              { closed: true },
              admin,
            )
          ).statusCode,
          404,
        );
        const r = await upload(track, id, [...files], student, {
          assignmentId: a.id,
        });
        assert.equal(r.statusCode, 201, r.body);
        const s = r.json();
        assert.equal(s.status, "pending_manual");
        assert.equal(s.attachments.length, 2);
        assert.ok(s.attachments.every((f: any) => !f.data));
        const duplicate = await upload(track, id, [...files], student, {
          assignmentId: a.id,
        });
        assert.equal(duplicate.statusCode, 200);
        assert.equal(duplicate.json().id, s.id);
        const endpoint = `/api/${track}/submissions/${s.id}`;
        const dl = await call("GET", endpoint + "/files/0", undefined, student);
        assert.equal(dl.statusCode, 200);
        assert.deepEqual(dl.rawPayload, files[0].bytes);
        assert.match(dl.headers["content-disposition"], /^attachment/);
        assert.equal(dl.headers["x-content-type-options"], "nosniff");
        assert.equal(
          (await call("GET", endpoint + "/files/0", undefined, admin))
            .statusCode,
          200,
        );
        assert.equal(
          (await call("GET", endpoint + "/files/0", undefined, other))
            .statusCode,
          404,
        );
        assert.equal(
          (await call("GET", endpoint + "/files/0")).statusCode,
          401,
        );
        assert.equal(
          (
            await call(
              "GET",
              `/api/${wrongTrack}/submissions/${s.id}/files/0`,
              undefined,
              admin,
            )
          ).statusCode,
          404,
        );
        assert.equal(
          (
            await call(
              "GET",
              `/api/${wrongTrack}/submissions/${s.id}`,
              undefined,
              admin,
            )
          ).statusCode,
          404,
        );
        assert.ok(
          !(
            await call(
              "GET",
              `/api/admin/${wrongTrack}/submissions`,
              undefined,
              admin,
            )
          )
            .json()
            .some((x: any) => x.id === s.id),
        );
        const review = {
          revision: 0,
          summary:
            "Đánh giá thử luồng thủ công, không xác nhận chất lượng file fixture.",
          criteria: s.rubric.criteria.map((c: any) => ({
            id: c.id,
            status: "met",
            evidence: "Giảng viên ghi nhận bằng chứng kiểm thử.",
            action: "",
          })),
        };
        assert.equal(
          (
            await call(
              "POST",
              `/api/admin/${wrongTrack}/submissions/${s.id}/review`,
              review,
              admin,
            )
          ).statusCode,
          404,
        );
        assert.equal(
          (
            await call(
              "POST",
              `/api/admin/${track}/submissions/${s.id}/review`,
              review,
              student,
            )
          ).statusCode,
          403,
        );
        assert.equal(
          (
            await call(
              "POST",
              `/api/admin/${track}/submissions/${s.id}/review`,
              review,
              admin,
            )
          ).statusCode,
          200,
        );
        const result = (await call("GET", endpoint, undefined, student)).json();
        assert.equal(result.result.score, 100);
        assert.equal(result.result.reviewer, "human");
        assert.equal(result.reviews.length, 1);
        const changed = await upload(track, id, [...files], student, {
          assignmentId: a.id,
          notes: "Bản sửa mới để kiểm thử lưu lịch sử độc lập.",
        });
        assert.equal(changed.statusCode, 201);
        assert.notEqual(changed.json().id, s.id);
        await call(
          "PATCH",
          `/api/admin/${track}/assignments/${a.id}`,
          { closed: true },
          admin,
        );
        assert.equal(
          (
            await upload(track, id, [...files], student, {
              assignmentId: a.id,
              notes: "Bản bị đóng không được nhận thêm bài.",
            })
          ).statusCode,
          409,
        );
      },
    );
  }
}
