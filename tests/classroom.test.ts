import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, createHash } from "node:crypto";
import { createServer } from "node:http";
import { createTestEnvironment } from "./environment.js";
const environment = await createTestEnvironment("classroom");
const { pool } = await import("../apps/api/src/db.js");
const { migrate } = await import("../apps/api/src/migrate.js");
const { seed } = await import("../apps/api/src/seed.js");
const { buildApp } = await import("../apps/api/src/server.js");
const { config } = await import("../apps/api/src/config.js");
const { courses, sourceAudit, sceneCount } =
  await import("../apps/api/src/classroom/catalog.js");
await migrate();
await seed();
const app = await buildApp();
await app.ready();
after(async () => {
  await app.close();
  await pool.end();
  await environment.dispose();
});
type Session = { cookie: string; csrf: string; id: string };
async function student(name: string, active: boolean): Promise<Session> {
  const id = (
    await pool.query(
      "INSERT INTO users(email,name,password_hash,verified) VALUES($1,$2,'test-only-no-login',true) RETURNING id",
      [name + "@example.test", name],
    )
  ).rows[0].id;
  if (active)
    await pool.query(
      "INSERT INTO lab_memberships(user_id,status,tracks,message) VALUES($1,'approved',ARRAY['embedded','kicad','solidworks'],'Temporary classroom test fixture')",
      [id],
    );
  const sid = randomBytes(32).toString("hex"),
    csrf = randomBytes(32).toString("hex");
  await pool.query(
    "INSERT INTO sessions(id,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+interval '1 hour')",
    [createHash("sha256").update(sid).digest("hex"), id, csrf],
  );
  return { id, cookie: "ep_session=" + sid, csrf };
}
const member = await student("classroom-member", true),
  other = await student("classroom-other", true),
  pending = await student("classroom-pending", false);
const call = (
  method: any,
  url: string,
  body?: any,
  s?: Session,
  headers: any = {},
) =>
  app.inject({
    method,
    url,
    remoteAddress: s
      ? `127.0.0.${s === member ? 2 : s === other ? 3 : 4}`
      : "127.0.0.5",
    headers: {
      origin: config.url,
      ...(s ? { cookie: s.cookie, "x-csrf-token": s.csrf } : {}),
      ...headers,
    },
    ...(body === undefined ? {} : { payload: body }),
  });
test("100 lessons: unique IDs, valid answers, verified sources and real chapter anchors", () => {
  assert.deepEqual(
    Object.values(courses).map((c) => c.lessons.length),
    [32, 44, 24],
  );
  for (const course of Object.values(courses)) {
    assert.equal(
      new Set(course.lessons.map((l) => l.id)).size,
      course.lessons.length,
    );
    for (const l of course.lessons) {
      assert.ok(course.modules.some((m) => m.id === l.module));
      assert.ok(l.concepts.length >= 2 && l.steps.length >= 3);
      assert.ok(l.quiz.answer >= 0 && l.quiz.answer < l.quiz.options.length);
      assert.ok(l.quiz.explanation.length > 20);
      assert.ok(
        l.rubric.every((r) => typeof r === "string" && r.length > 10),
        `Invalid rubric in ${l.id}`,
      );
      assert.ok(l.steps.every((s) => typeof s === "string"));
      for (const ref of l.videos) {
        const v = sourceAudit.sources.find(
          (v) => v.id === ref.id && v.track === course.track,
        );
        assert.ok(v, ref.id);
        assert.ok(!["excluded", "unavailable"].includes(v.kind));
        if (ref.start)
          assert.ok(
            v.chapters?.some((ch) => ch.start_time === ref.start),
            `Unverified chapter ${l.id}/${ref.start}`,
          );
      }
    }
  }
  assert.equal(
    new Set(courses.embedded.lessons.flatMap((l) => l.videos.map((v) => v.id)))
      .size,
    30,
  );
  const mapped = new Set(
    courses.kicad.lessons.flatMap((l) => l.videos.map((v) => v.id)),
  );
  assert.equal(mapped.size, 95);
  for (const v of sourceAudit.sources.filter(
    (v) => v.track === "kicad" && !["excluded", "unavailable"].includes(v.kind),
  ))
    assert.ok(mapped.has(v.id), `Unmapped selected source ${v.id}`);
});
test("Catalog exposes summaries without private lesson bodies or quiz keys", async () => {
  for (const track of Object.keys(courses)) {
    const r = await call("GET", `/api/classroom/${track}`);
    assert.equal(r.statusCode, 200, r.body);
    for (const l of r.json().lessons) {
      assert.ok(!("concepts" in l));
      assert.ok(!("quiz" in l));
      assert.ok(!("note" in l));
    }
  }
  const r = await call("GET", "/api/classroom/embedded/lessons/cb01");
  assert.equal(r.statusCode, 200);
  assert.ok(!("answer" in r.json().lesson.quiz));
  assert.ok(!("explanation" in r.json().lesson.quiz));
  assert.equal(
    (await call("GET", "/api/classroom/embedded/lessons/c01")).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        "GET",
        "/api/classroom/embedded/lessons/c01",
        undefined,
        pending,
      )
    ).statusCode,
    403,
  );
});
test("Progress: ownership, strict validation, CSRF and completion prerequisites", async () => {
  const endpoint = "/api/classroom/embedded/lessons/cb01";
  const l = courses.embedded.lessons[0];
  assert.equal(
    (
      await call("PUT", endpoint + "/progress", {
        scene: 0,
        note: "private note",
        checklist: [],
        completed: false,
      })
    ).statusCode,
    401,
  );
  assert.equal(
    (
      await call(
        "PUT",
        endpoint + "/progress",
        { scene: 0, note: "private note", checklist: [], completed: false },
        member,
        { "x-csrf-token": "bad" },
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (
      await call(
        "PUT",
        endpoint + "/progress",
        { scene: sceneCount(l), note: "", checklist: [] },
        member,
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call(
        "PUT",
        endpoint + "/progress",
        { scene: 0, note: "", checklist: [], quiz_passed: true },
        member,
      )
    ).statusCode,
    400,
  );
  assert.equal(
    (
      await call(
        "PUT",
        endpoint + "/progress",
        {
          scene: 0,
          note: "",
          checklist: l.steps.map((_, i) => i),
          completed: true,
        },
        member,
      )
    ).statusCode,
    409,
  );
  assert.equal(
    (
      await call(
        "PUT",
        endpoint + "/progress",
        { scene: 2, note: "private-classroom-note", checklist: [0] },
        member,
      )
    ).statusCode,
    200,
  );
  assert.equal(
    (await call("GET", endpoint, undefined, member)).json().progress.note,
    "private-classroom-note",
  );
  assert.equal(
    (await call("GET", endpoint, undefined, other)).json().progress,
    null,
  );
  const wrong = (l.quiz.answer + 1) % l.quiz.options.length;
  assert.equal(
    (await call("POST", endpoint + "/quiz", { answer: wrong }, member)).json()
      .correct,
    false,
  );
  assert.equal(
    (
      await call("POST", endpoint + "/quiz", { answer: l.quiz.answer }, member)
    ).json().passed,
    true,
  );
  assert.equal(
    (await call("POST", endpoint + "/quiz", { answer: wrong }, member)).json()
      .passed,
    true,
  );
  const finished = await call(
    "PUT",
    endpoint + "/progress",
    {
      scene: sceneCount(l) - 1,
      note: "private-classroom-note",
      checklist: l.steps.map((_, i) => i),
      completed: true,
    },
    member,
  );
  assert.equal(finished.statusCode, 200, finished.body);
  assert.equal(finished.json().completed, true);
  assert.equal(finished.json().quiz_passed, true);
  assert.equal(
    (
      await call("GET", "/api/classroom/embedded/report", undefined, other)
    ).json().progress.length,
    0,
  );
});
test("Course withdrawal and membership revocation apply to classroom and PDFs", async () => {
  await pool.query(
    "UPDATE courses SET status='draft' WHERE category='embedded'",
  );
  assert.equal(
    (await call("GET", "/api/classroom/embedded", undefined, member))
      .statusCode,
    404,
  );
  assert.equal(
    (
      await call(
        "GET",
        "/api/classroom/embedded/lessons/cb01",
        undefined,
        member,
      )
    ).statusCode,
    403,
  );
  assert.equal(
    (await call("GET", "/api/classroom/embedded/handbook", undefined, member))
      .statusCode,
    403,
  );
  await pool.query(
    "UPDATE courses SET status='published' WHERE category='embedded'",
  );
  await pool.query(
    "UPDATE lab_memberships SET status='revoked' WHERE user_id=$1",
    [member.id],
  );
  assert.equal(
    (await call("GET", "/api/classroom/kicad/lessons/ka01", undefined, member))
      .statusCode,
    403,
  );
  await pool.query(
    "UPDATE lab_memberships SET status='approved' WHERE user_id=$1",
    [member.id],
  );
});
test("Question-only classroom answers cite the handbook and persist video evidence privately", async () => {
  const endpoint = "/api/classroom/embedded/lessons/cb01/chat";
  const question = "Giải thích ý chính của bài";
  const r = await call("POST", endpoint, { question }, member);
  assert.equal(r.statusCode, 200, r.body);
  const message = r.json();
  assert.equal(message.mode, "guide");
  assert.equal(message.role, undefined);
  assert.equal(message.evidence.matched, true);
  assert.ok(
    message.answer.includes(courses.embedded.lessons[0].concepts[0][1]),
  );
  assert.equal(message.evidence.references[0].lessonId, "cb01");
  assert.ok(message.evidence.videos.length > 0);
  for (const video of message.evidence.videos) {
    assert.ok(
      courses.embedded.lessons[0].videos.some((v) => v.id === video.id),
    );
    assert.ok(sourceAudit.sources.some((v) => v.id === video.id));
  }
  const detail = (
    await call("GET", "/api/classroom/embedded/lessons/cb01", undefined, member)
  ).json();
  assert.deepEqual(
    detail.messages.find((m: any) => m.id === message.id).evidence,
    message.evidence,
  );
  const otherDetail = (
    await call("GET", "/api/classroom/embedded/lessons/cb01", undefined, other)
  ).json();
  assert.equal(otherDetail.messages.length, 0);
  assert.equal((await call("POST", endpoint, { question })).statusCode, 401);
  assert.equal(
    (
      await call("POST", endpoint, { question }, member, {
        "x-csrf-token": "wrong",
      })
    ).statusCode,
    403,
  );
  assert.equal(
    (await call("POST", endpoint, { question, role: "peer" }, member))
      .statusCode,
    400,
  );
  assert.equal(
    (await call("GET", "/api/admin/classroom/progress", undefined, member))
      .statusCode,
    403,
  );
});

test("Handbook retrieval finds other lessons, declines unrelated questions and never invents video sources", async () => {
  const { handbookAnswer } =
    await import("../apps/api/src/classroom/answers.js");
  const current = courses.embedded.lessons[0];
  const answer = handbookAnswer(
    "embedded",
    current,
    "volatile là gì?",
    courses.embedded.lessons,
  );
  assert.equal(answer.evidence.matched, true);
  assert.ok(answer.answer.toLowerCase().includes("volatile"));
  assert.ok(answer.evidence.references.every((r) => r.lessonId !== current.id));
  for (const ref of answer.evidence.references) {
    const cited = courses.embedded.lessons.find((l) => l.id === ref.lessonId)!;
    assert.ok(
      cited.concepts.some(
        ([title, text]) =>
          title === ref.section && answer.answer.includes(text),
      ) || ref.section === "Lỗi thường gặp",
    );
  }
  const unknown = handbookAnswer(
    "embedded",
    current,
    "Giá vàng hôm nay là bao nhiêu?",
    courses.embedded.lessons,
  );
  assert.equal(unknown.evidence.matched, false);
  assert.deepEqual(unknown.evidence.videos, []);
  assert.deepEqual(unknown.evidence.references, []);
  const noVideoLesson = { ...courses.solidworks.lessons[0], videos: [] };
  const sw = handbookAnswer(
    "solidworks",
    noVideoLesson,
    "Giải thích ý chính của bài",
    [noVideoLesson],
  );
  assert.equal(sw.evidence.matched, true);
  assert.deepEqual(sw.evidence.videos, []);
  assert.ok(sw.evidence.documents.length > 0);
  const ki = handbookAnswer(
    "kicad",
    courses.kicad.lessons[0],
    "Giải thích ý chính của bài",
    courses.kicad.lessons,
  );
  for (const video of ki.evidence.videos) {
    const source = sourceAudit.sources.find(
      (s) => s.track === "kicad" && s.id === video.id,
    )!;
    assert.ok(
      video.start === 0 ||
        source.chapters?.some((c) => c.start_time === video.start),
    );
  }
});

test("SOLIDWORKS visual supplement covers every lesson and persists attributed video answers", async () => {
  const videos = sourceAudit.sources.filter((s) => s.track === "solidworks");
  assert.equal(videos.length, 27);
  assert.equal(new Set(videos.map((v) => v.id)).size, 27);
  assert.equal(videos.filter((v) => v.language === "vi").length, 6);
  for (const lesson of courses.solidworks.lessons) {
    assert.ok(lesson.videos.length > 0, lesson.id);
    assert.equal(lesson.visualGuide?.watchFor.length, 3, lesson.id);
    assert.ok(lesson.visualGuide!.tryIt.length > 20);
    for (const ref of lesson.videos) {
      const source = videos.find((v) => v.id === ref.id)!;
      assert.ok(source.lessonIds.includes(lesson.id));
      assert.ok(source.channel && source.duration && source.playableInEmbed);
      assert.ok(["vi", "en"].includes(source.language!));
    }
  }
  const sources = await call("GET", "/api/classroom/solidworks/sources");
  assert.equal(sources.statusCode, 200);
  assert.equal(sources.json().counts.selected, 27);
  const endpoint = "/api/classroom/solidworks/lessons/s05";
  const response = await call(
    "POST",
    endpoint + "/chat",
    { question: "Giải thích ý chính của bài" },
    member,
  );
  assert.equal(response.statusCode, 200, response.body);
  const video = response.json().evidence.videos[0];
  assert.equal(video.id, "IJawoVsJnF4");
  assert.equal(video.language, "vi");
  assert.equal(video.channel, "Procad Solidworks");
  const reloaded = await call("GET", endpoint, undefined, member);
  assert.equal(reloaded.statusCode, 200);
  assert.ok(
    reloaded
      .json()
      .messages.some((m: any) =>
        m.evidence?.videos?.some(
          (v: any) => v.id === video.id && v.language === "vi",
        ),
      ),
  );
});

test("Search and saved evidence respect membership when questions cite another lesson", async () => {
  const endpoint = "/api/classroom/kicad/lessons/l01";
  const privateLesson = courses.kicad.lessons.find(
    (l) => !l.preview && l.id === "ka01",
  )!;
  assert.ok(privateLesson);
  const question = privateLesson.concepts[0][0];
  const response = await call("POST", endpoint + "/chat", { question }, member);
  assert.equal(response.statusCode, 200, response.body);
  const message = response.json();
  assert.ok(
    message.evidence.references.some(
      (r: any) => r.lessonId === privateLesson.id,
    ),
    JSON.stringify(message),
  );
  try {
    await pool.query(
      "UPDATE lab_memberships SET status='revoked' WHERE user_id=$1",
      [member.id],
    );
    const detail = await call("GET", endpoint, undefined, member);
    assert.equal(detail.statusCode, 200, detail.body);
    assert.ok(!detail.json().messages.some((m: any) => m.id === message.id));
    const limited = await call(
      "POST",
      endpoint + "/chat",
      { question },
      pending,
    );
    assert.equal(limited.statusCode, 200, limited.body);
    for (const reference of limited.json().evidence.references)
      assert.ok(
        courses.kicad.lessons.find((l) => l.id === reference.lessonId)?.preview,
      );
  } finally {
    await pool.query(
      "UPDATE lab_memberships SET status='approved' WHERE user_id=$1",
      [member.id],
    );
  }
});

test("All three watermarked PDF downloads are private and contain valid PDF data", async () => {
  for (const track of Object.keys(courses)) {
    assert.equal(
      (await call("GET", `/api/classroom/${track}/handbook`)).statusCode,
      403,
    );
    const r = await call(
      "GET",
      `/api/classroom/${track}/handbook`,
      undefined,
      member,
    );
    assert.equal(r.statusCode, 200, r.body.slice(0, 200));
    assert.equal(r.headers["content-type"], "application/pdf");
    assert.ok(r.rawPayload.subarray(0, 5).equals(Buffer.from("%PDF-")));
    assert.ok(r.rawPayload.length > 50000);
  }
});

test("Optional AI adapter sends lesson context and rejects invalid provider replies", async () => {
  const { aiAnswer } = await import("../apps/api/src/classroom/tutor.js");
  let mode = "ok",
    received: any;
  const provider = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    received = {
      url: req.url,
      authorization: req.headers.authorization,
      body: JSON.parse(body),
    };
    res.setHeader("Content-Type", "application/json");
    if (mode === "invalid") {
      res.end("invalid-json");
      return;
    }
    res.end(
      JSON.stringify({
        choices: [
          { message: { content: "Phản hồi AI mô phỏng để kiểm tra kết nối." } },
        ],
      }),
    );
  });
  await new Promise<void>((resolve) =>
    provider.listen(0, "127.0.0.1", resolve),
  );
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  const keys = [
    "EP_CLASSROOM_AI_BASE_URL",
    "EP_CLASSROOM_AI_KEY",
    "EP_CLASSROOM_AI_MODEL",
  ] as const;
  const saved = keys.map((k) => process.env[k]);
  try {
    process.env.EP_CLASSROOM_AI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
    process.env.EP_CLASSROOM_AI_KEY = "local-fixture-key";
    process.env.EP_CLASSROOM_AI_MODEL = "local-fixture-model";
    const answer = await aiAnswer(
      courses.embedded.lessons[0],
      "Giải thích mục tiêu",
      [],
    );
    assert.ok(answer.includes("mô phỏng"));
    assert.equal(received.url, "/v1/chat/completions");
    assert.equal(received.authorization, "Bearer local-fixture-key");
    assert.equal(received.body.model, "local-fixture-model");
    assert.ok(
      received.body.messages[0].content.includes(
        courses.embedded.lessons[0].title,
      ),
    );
    assert.ok(!received.body.messages[0].content.includes("local-fixture-key"));
    assert.ok(!received.body.messages[0].content.includes('"quiz"'));
    mode = "invalid";
    await assert.rejects(
      aiAnswer(courses.embedded.lessons[0], "Mục tiêu", []),
      /không trả về nội dung văn bản/,
    );
  } finally {
    keys.forEach((k, i) => {
      if (saved[i] === undefined) delete process.env[k];
      else process.env[k] = saved[i];
    });
    await new Promise<void>((resolve, reject) =>
      provider.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test("Unified subject index and account progress use the current curriculum and respect access", async () => {
  const index = await call("GET", "/api/classroom");
  assert.equal(index.statusCode, 200);
  assert.deepEqual(
    index.json().map((c: any) => c.lessonCount),
    [32, 44, 24],
  );
  assert.equal(index.json().flatMap((c: any) => c.previews).length, 6);
  assert.ok(
    !index.body.includes('"concepts"') && !index.body.includes('"note"'),
  );
  assert.equal((await call("GET", "/api/classroom/progress")).statusCode, 401);
  const progress = (
    await call("GET", "/api/classroom/progress", undefined, member)
  ).json();
  assert.ok(
    progress.some(
      (p: any) => p.href === "/nhung-c/lop-hoc/cb01" && p.completed,
    ),
  );
  assert.ok(
    progress.every((p: any) => p.href.includes("/lop-hoc/") && !p.note),
  );
  assert.deepEqual(
    (await call("GET", "/api/classroom/progress", undefined, other)).json(),
    [],
  );
  try {
    await pool.query(
      "UPDATE courses SET status='draft' WHERE category='embedded'",
    );
    assert.equal(
      (await call("GET", "/api/classroom"))
        .json()
        .some((c: any) => c.track === "embedded"),
      false,
    );
    assert.equal(
      (await call("GET", "/api/classroom/progress", undefined, member))
        .json()
        .some((p: any) => p.track === "embedded"),
      false,
    );
  } finally {
    await pool.query(
      "UPDATE courses SET status='published' WHERE category='embedded'",
    );
  }
});
