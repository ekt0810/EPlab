import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { participantHandbooks } from "../apps/api/src/content/participant-handbooks.js";
import { hostHandbooks } from "../apps/api/src/content/host-handbooks.js";
export async function hubCases(t: any, { call, admin, student, other, pool, login }: any) {
  await t.test("version 4 handbook links resolve to current content without bypassing access", async () => {
    for (const b of participantHandbooks) {
      const legacy = b.lessonSlug.replace(/-v5$/, "-v4");
      const intro = await call("GET", `/api/lessons/${legacy}/intro`);
      assert.equal(intro.statusCode, 200);
      assert.equal(intro.json().slug, b.lessonSlug);
      assert.equal((await call("GET", `/api/lessons/${legacy}`)).statusCode, 403);
      assert.equal((await call("GET", `/api/lessons/${legacy}`, undefined, admin)).statusCode, 200);
    }
  });
  const prohibited = ["content","exercise","answer","video_url","source_url","document_resource_id","storage_key","resources","note","study"];
  function safe(item: any) { for (const field of prohibited) assert.ok(!(field in item), "Private field exposed: " + field); }
  await t.test("public lesson intros show goals and access state without premium content or file identifiers", async () => {
    for (const b of participantHandbooks) {
      for (const session of [undefined, other]) {
        const response = await call("GET", `/api/lessons/${b.lessonSlug}/intro`, undefined, session);
        assert.equal(response.statusCode, 200, response.body);
        const data = response.json(); safe(data);
        assert.ok(data.title && data.objectives && data.chapter_title);
        assert.equal(data.accessible, false);
        assert.equal(data.publication, "published");
        assert.equal(data.format, "document");
        assert.equal((await call("GET", `/api/lessons/${b.lessonSlug}`, undefined, session)).statusCode, 403);
        const resources = (await call("GET", `/api/courses/${b.courseSlug}/resources`, undefined, session)).json();
        assert.equal(resources.length, 1);
        assert.ok(resources.every((r: any) => r.resourceId === null && r.size > 0 && r.audience === "student"));
      }
      const catalog = (await call("GET", `/api/courses/${b.courseSlug}`)).json();
      for (const ch of catalog.chapters) for (const l of ch.lessons) { safe(l); assert.equal(l.status, "published"); }
    }
  });
  await t.test("drafts stay private; explicit upcoming opt-in exposes only the introduction", async () => {
    const chapter = (await pool.query("SELECT id FROM chapters LIMIT 1")).rows[0].id;
    const l = (await pool.query(`INSERT INTO lessons(chapter_id,slug,title,summary,objectives,content,answer,rights)
      VALUES($1,'hub-private-draft','Private draft','Public summary','Concrete learning goal','SECRET PREMIUM BODY','SECRET ANSWER','owned') RETURNING *`,[chapter])).rows[0];
    try {
      assert.equal((await call("GET", `/api/lessons/${l.slug}/intro`)).statusCode,404);
      await pool.query("UPDATE lessons SET listed=true WHERE id=$1",[l.id]);
      const r = await call("GET", `/api/lessons/${l.slug}/intro`);
      assert.equal(r.statusCode,200); safe(r.json());
      assert.equal(r.json().publication,"upcoming"); assert.equal(r.json().accessible,false);
      for (const session of [undefined,other,student]) assert.equal((await call("GET", `/api/lessons/${l.slug}`,undefined,session)).statusCode,403);
      const course = (await pool.query("SELECT c.slug FROM chapters ch JOIN courses c ON c.id=ch.course_id WHERE ch.id=$1",[chapter])).rows[0].slug;
      const list = await call("GET",`/api/courses/${course}`);
      assert.ok(list.json().chapters.flatMap((ch:any)=>ch.lessons).some((x:any)=>x.slug===l.slug && x.publication==="upcoming"));
      assert.ok(!list.body.includes("SECRET"));
      await pool.query("UPDATE lessons SET audience='host' WHERE id=$1",[l.id]);
      assert.equal((await call("GET", `/api/lessons/${l.slug}/intro`,undefined,student)).statusCode,404);
    } finally { await pool.query("DELETE FROM lessons WHERE id=$1",[l.id]); }
  });
  await t.test("host PDFs are invisible to learners and both admins can read the exact source files", async () => {
    const second = await login("two@example.test");
    for (const book of hostHandbooks) {
      const slug = `eplab-host-${book.category}-v31`;
      const l = (await pool.query("SELECT document_resource_id FROM lessons WHERE slug=$1",[slug])).rows[0];
      for (const session of [undefined,other,student]) {
        assert.equal((await call("GET",`/api/lessons/${slug}/intro`,undefined,session)).statusCode,404);
        assert.equal((await call("GET",`/api/lessons/${slug}`,undefined,session)).statusCode,403);
        for (const suffix of ["","/view"]) assert.equal((await call("GET",`/api/files/${l.document_resource_id}${suffix}`,undefined,session)).statusCode,403);
      }
      for (const session of [admin,second]) {
        assert.equal((await call("GET",`/api/lessons/${slug}`,undefined,session)).statusCode,200);
        const pdf = await call("GET",`/api/files/${l.document_resource_id}/view`,undefined,session);
        assert.equal(pdf.statusCode,200); assert.equal(createHash("sha256").update(pdf.rawPayload).digest("hex"),book.sha256);
      }
    }
  });
  await t.test("catalog progress belongs to the current account and private notes never enter metadata", async () => {
    const free = (await call("GET","/api/previews")).json()[0];
    const saved = await call("PUT",`/api/progress/${free.slug}`,{completed:false,note:"PRIVATE HUB NOTE"},student);
    assert.equal(saved.statusCode,200);
    const own = (await call("GET",`/api/lessons/${free.slug}/intro`,undefined,student)).json();
    assert.equal(own.progress.completed,false); assert.ok(!JSON.stringify(own).includes("PRIVATE HUB NOTE"));
    for (const session of [undefined,other]) assert.equal((await call("GET",`/api/lessons/${free.slug}/intro`,undefined,session)).json().progress,null);
    assert.equal((await call("GET",`/api/lessons/${free.slug}`)).statusCode,200);
  });
}
