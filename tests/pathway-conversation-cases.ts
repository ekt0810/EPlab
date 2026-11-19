import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { TestContext } from "node:test";
export async function pathwayConversationCases(
  t: TestContext,
  { call, admin, student, other, pool }: any,
) {
  await t.test(
    "All three paths have four exercises per level, ordered prerequisites and isolated completion",
    async () => {
      for (const [track, prefix] of [
        ["embedded", "c"],
        ["kicad", "e"],
        ["solidworks", "s"],
      ]) {
        const list = (
          await call("GET", `/api/${track}/exercises`, undefined, student)
        ).json();
        assert.equal(list.length, 12);
        for (const level of ["basic", "intermediate", "advanced"])
          assert.equal(list.filter((e: any) => e.level === level).length, 4);
        for (let i = 0; i < 12; i++) {
          assert.equal(list[i].order, i + 1);
          assert.deepEqual(
            list[i].prerequisites,
            i ? [`${prefix}${String(i).padStart(2, "0")}`] : [],
          );
        }
        const last = (
          await call(
            "GET",
            `/api/${track}/exercises/${prefix}12`,
            undefined,
            admin,
          )
        ).json();
        assert.equal(last.level, "advanced");
        assert.ok(last.steps.length >= 3);
        const anonymous = (await call("GET", `/api/${track}/exercises`)).json();
        assert.ok(anonymous.every((e: any) => !e.passed && !e.submitted));
      }
      const { seed } = await import("../apps/api/src/seed.js");
      await seed();
      assert.equal(
        (await pool.query("SELECT count(*)::int AS n FROM exercises")).rows[0]
          .n,
        36,
      );
    },
  );
  for (const [track, exerciseId] of [
    ["embedded", "c09"],
    ["kicad", "e12"],
    ["solidworks", "s12"],
  ]) {
    await t.test(
      `${track}: private participant-host exchange, retry deduplication and resolve/reopen permissions`,
      async () => {
        const url = `/api/${track}/conversations`,
          body = {
            exerciseId,
            subject: "Câu hỏi riêng về bài nâng cao",
            body: "Tôi cần làm rõ tiêu chí trong bài này.",
            clientId: randomUUID(),
          };
        assert.equal((await call("POST", url, body, other)).statusCode, 403);
        assert.equal(
          (
            await call(
              "POST",
              url,
              { ...body, participantId: randomUUID() },
              student,
            )
          ).statusCode,
          400,
        );
        const r = await call("POST", url, body, student);
        assert.equal(r.statusCode, 201, r.body);
        const id = r.json().id;
        const retry = await call("POST", url, body, student);
        assert.equal(retry.statusCode, 200);
        assert.equal(retry.json().id, id);
        assert.equal(retry.json().duplicate, true);
        assert.equal((await call("GET", url + "/" + id)).statusCode, 401);
        assert.equal(
          (await call("GET", url + "/" + id, undefined, other)).statusCode,
          404,
        );
        assert.ok(
          !(await call("GET", url, undefined, other))
            .json()
            .items.some((x: any) => x.id === id),
        );
        assert.ok(
          (await call("GET", url, undefined, admin))
            .json()
            .items.some((x: any) => x.id === id && x.waiting_for === "host"),
        );
        const wrong = track === "kicad" ? "embedded" : "kicad";
        assert.equal(
          (
            await call(
              "GET",
              `/api/${wrong}/conversations/${id}`,
              undefined,
              admin,
            )
          ).statusCode,
          404,
        );
        assert.equal(
          (
            await call(
              "POST",
              url + "/" + id + "/messages",
              { body: "Không thuộc cuộc trao đổi", clientId: randomUUID() },
              other,
            )
          ).statusCode,
          404,
        );
        const answer = {
          body: "Người chủ trì hướng dẫn: đối chiếu từng ca kiểm tra.",
          clientId: randomUUID(),
        };
        const simultaneous = await Promise.all([
          call("POST", url + "/" + id + "/messages", answer, admin),
          call("POST", url + "/" + id + "/messages", answer, admin),
        ]);
        assert.deepEqual(
          simultaneous.map((x: any) => x.statusCode).sort(),
          [200, 201],
        );
        assert.equal(
          (
            await call(
              "POST",
              url + "/" + id + "/messages",
              { ...answer, body: "Nội dung khác cùng mã" },
              admin,
            )
          ).statusCode,
          409,
        );
        const d = (
          await call("GET", url + "/" + id, undefined, student)
        ).json();
        assert.equal(d.messages.length, 2);
        assert.equal(d.messages[0].author_role, "Người tham gia");
        assert.equal(d.messages[1].author_role, "Người chủ trì");
        assert.equal(
          (await call("PATCH", url + "/" + id, { resolved: true }, student))
            .statusCode,
          403,
        );
        assert.equal(
          (await call("PATCH", url + "/" + id, { resolved: true }, admin))
            .statusCode,
          200,
        );
        assert.equal(
          (
            await call(
              "POST",
              url + "/" + id + "/messages",
              { body: "Hỏi thêm", clientId: randomUUID() },
              student,
            )
          ).statusCode,
          409,
        );
        assert.equal(
          (await call("PATCH", url + "/" + id, { resolved: false }, student))
            .statusCode,
          200,
        );
        const html = "<script>alert('text only')</script>";
        assert.equal(
          (
            await call(
              "POST",
              url + "/" + id + "/messages",
              { body: html, clientId: randomUUID() },
              student,
            )
          ).statusCode,
          201,
        );
        assert.equal(
          (
            await call(
              "POST",
              url + "/" + id + "/messages",
              { body: " ", clientId: randomUUID() },
              student,
            )
          ).statusCode,
          400,
        );
        assert.equal(
          (
            await call(
              "POST",
              url + "/" + id + "/messages",
              { body: "x".repeat(3001), clientId: randomUUID() },
              student,
            )
          ).statusCode,
          400,
        );
        // Seed history directly to exercise cursor boundaries without evading HTTP rate limits.
        await pool.query(
          "INSERT INTO practice_messages(thread_id,author_id,client_id,body) SELECT $1,participant_id,gen_random_uuid(),'Lịch sử '||n FROM practice_threads CROSS JOIN generate_series(1,55) n WHERE id=$1",
          [id],
        );
        const newest = (
          await call("GET", url + "/" + id, undefined, student)
        ).json();
        assert.equal(newest.messages.length, 50);
        assert.equal(newest.hasOlder, true);
        const older = (
          await call(
            "GET",
            url + "/" + id + "?before=" + newest.nextBefore,
            undefined,
            student,
          )
        ).json();
        assert.equal(older.messages.length, 8);
        assert.equal(older.hasOlder, false);
        assert.equal(
          new Set([...older.messages, ...newest.messages].map((x: any) => x.id))
            .size,
          58,
        );
        assert.equal(older.messages[2].body, html);
      },
    );
  }
}
