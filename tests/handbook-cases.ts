import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { participantHandbooks } from "../apps/api/src/content/participant-handbooks.js";
export async function handbookCases(
  t: any,
  { call, admin, student, other, pool, login }: any,
) {
  await t.test(
    "v5 handbooks: paid learners and both admins receive exact PDFs; guests and pending learners are denied",
    async () => {
      const guests = (await call("GET", "/api/handbooks")).json();
      assert.equal(guests.length, 3);
      assert.ok(
        guests.every(
          (b: any) =>
            !b.accessible && b.resourceId === null && b.chapters.length === 12,
        ),
      );
      const pending = (
        await call("GET", "/api/handbooks", undefined, other)
      ).json();
      assert.ok(
        pending.every((b: any) => !b.accessible && b.resourceId === null),
      );
      const members = (
        await call("GET", "/api/handbooks", undefined, student)
      ).json();
      const secondAdmin = await login("two@example.test");
      for (const book of participantHandbooks) {
        const metadata = members.find((b: any) => b.category === book.category);
        assert.equal(metadata.pages, book.pages);
        assert.equal(metadata.version, "5.0");
        assert.equal(metadata.accessible, true);
        for (const session of [undefined, other]) {
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
          for (const suffix of ["", "/view"])
            assert.equal(
              (
                await call(
                  "GET",
                  `/api/files/${metadata.resourceId}${suffix}`,
                  undefined,
                  session,
                )
              ).statusCode,
              403,
            );
        }
        for (const session of [student, admin, secondAdmin]) {
          const lesson = await call(
            "GET",
            `/api/lessons/${book.lessonSlug}`,
            undefined,
            session,
          );
          assert.equal(lesson.statusCode, 200);
          assert.equal(lesson.json().handbook.pages, book.pages);
          assert.equal(lesson.json().video_type, "none");
          for (const suffix of ["", "/view"]) {
            const pdf = await call(
              "GET",
              `/api/files/${metadata.resourceId}${suffix}`,
              undefined,
              session,
            );
            assert.equal(pdf.statusCode, 200);
            assert.match(pdf.headers["cache-control"], /no-store/);
            assert.equal(
              createHash("sha256").update(pdf.rawPayload).digest("hex"),
              book.sha256,
            );
          }
        }
        for (const ch of book.chapters) {
          assert.ok(ch.page > 0 && ch.page <= book.pages);
          assert.equal(
            (
              await call(
                "GET",
                `/api/${book.category}/exercises/${ch.id}`,
                undefined,
                student,
              )
            ).statusCode,
            200,
          );
        }
      }
      await pool.query(
        "UPDATE courses SET status='draft' WHERE category='embedded'",
      );
      try {
        assert.equal(
          (await call("GET", "/api/handbooks", undefined, student)).json()
            .length,
          2,
        );
        assert.equal(
          (await call("GET", "/api/handbooks", undefined, admin)).json().length,
          3,
        );
        const resource = members.find(
          (b: any) => b.category === "embedded",
        ).resourceId;
        assert.equal(
          (await call("GET", `/api/files/${resource}/view`, undefined, student))
            .statusCode,
          403,
        );
      } finally {
        await pool.query(
          "UPDATE courses SET status='published' WHERE category='embedded'",
        );
      }
    },
  );
}
