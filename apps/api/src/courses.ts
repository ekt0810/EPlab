import { publicStudy } from "./practice/content.js";
import { participantHandbooks } from "./content/participant-handbooks.js";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, rows, one, sql } from "./db.js";
import {
  ApiError,
  auth,
  canLearn,
  hasAdminAccess,
  personalActor,
} from "./security.js";
import { canSeeSummary, lessonSummary } from "./lesson-catalog.js";
export async function getLesson(slug: string) {
  // Keep saved handbook links working after the version 5 content upgrade.
  if (/^eplab-giao-trinh-(embedded|kicad|solidworks)-v4$/.test(slug))
    slug = slug.replace(/-v4$/, "-v5");
  return one(
    sql`SELECT l.*,ch.course_id,ch.title AS chapter_title,c.title AS course_title,c.slug AS course_slug,c.category,c.status AS course_status FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE l.slug=${slug}`,
  );
}
export async function courseRoutes(app: FastifyInstance) {
  app.get("/api/handbooks", async (req) => {
    const books = await Promise.all(
      participantHandbooks.map(async (book) => {
        const lesson = await getLesson(book.lessonSlug);
        if (!lesson || !canSeeSummary(lesson, req.actor)) return null;
        const accessible = canLearn(req.actor, lesson as any);
        const file = await one(
          sql`SELECT size,name FROM resources WHERE id=${lesson.document_resource_id}`,
        );
        return {
          category: book.category,
          title: book.title,
          courseSlug: book.courseSlug,
          practiceBase: book.practiceBase,
          lessonSlug: book.lessonSlug,
          pages: book.pages,
          version: book.version,
          chapters: book.chapters,
          accessible,
          resourceId: accessible ? lesson.document_resource_id : null,
          size: file?.size ? Number(file.size) : null,
          fileName: file?.name || null,
        };
      }),
    );
    return books.filter(Boolean);
  });
  app.get("/api/courses", async (req) =>
    rows(
      sql`SELECT c.*,count(l.id) FILTER(WHERE l.status='published' AND l.audience='student')::int AS lesson_count,count(l.id) FILTER(WHERE l.status='published' AND l.preview AND l.audience='student')::int AS preview_count,count(l.id) FILTER(WHERE l.status='draft' AND l.listed AND l.audience='student')::int AS upcoming_count FROM courses c LEFT JOIN chapters ch ON ch.course_id=c.id LEFT JOIN lessons l ON l.chapter_id=ch.id WHERE (c.status='published' OR ${hasAdminAccess(req.actor)}) GROUP BY c.id ORDER BY c.position,c.title`,
    ),
  );
  app.get("/api/previews", async () =>
    rows(
      sql`SELECT l.id,l.slug,l.title,l.summary,l.language,l.author,l.position,l.duration_minutes,l.video_type,l.embed_verified,c.slug AS course_slug,c.title AS course_title,c.category FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE l.preview AND l.status='published' AND c.status='published' AND l.audience='student' ORDER BY c.position,l.position`,
    ),
  );
  app.get("/api/courses/:slug", async (req) => {
    const slug = z
      .string()
      .max(120)
      .parse((req.params as any).slug);
    const c = await one(
      sql`SELECT * FROM courses WHERE slug=${slug} AND (status='published' OR ${hasAdminAccess(req.actor)})`,
    );
    if (!c) throw new ApiError(404, "Không tìm thấy khóa học.");
    const chapters = await rows(
      sql`SELECT * FROM chapters WHERE course_id=${c.id} ORDER BY position`,
    );
    const lessons = await rows(
      sql`SELECT l.*,ch.title AS chapter_title,p.completed,p.updated_at AS progress_updated_at FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=${personalActor(req)?.id || null} WHERE ch.course_id=${c.id} AND ((l.audience='student' AND (l.status='published' OR l.listed)) OR ${hasAdminAccess(req.actor)}) ORDER BY ch.position,l.position`,
    );
    return {
      ...c,
      chapters: chapters
        .map((ch) => ({
          ...ch,
          lessons: lessons
            .filter((l) => l.chapter_id === ch.id)
            .map((l) =>
              lessonSummary(
                {
                  ...l,
                  course_status: c.status,
                  course_slug: c.slug,
                  course_title: c.title,
                  category: c.category,
                },
                req.actor,
              ),
            ),
        }))
        .filter((ch) => ch.lessons.length > 0),
    };
  });
  app.get("/api/lessons/:slug/intro", async (req) => {
    const l = await getLesson(
      z
        .string()
        .max(120)
        .parse((req.params as any).slug),
    );
    if (!l || !canSeeSummary(l, req.actor))
      throw new ApiError(404, "Không tìm thấy bài học.");
    const p = personalActor(req)
      ? await one(
          sql`SELECT completed,updated_at AS progress_updated_at FROM progress WHERE user_id=${personalActor(req)!.id} AND lesson_id=${l.id}`,
        )
      : null;
    return lessonSummary({ ...l, ...p }, req.actor);
  });
  app.get("/api/courses/:slug/resources", async (req) => {
    const slug = z
      .string()
      .max(120)
      .parse((req.params as any).slug);
    const files = await rows(
      sql`SELECT r.id AS resource_id,r.name,r.size,r.content_type,r.sha256 AS file_hash,l.*,c.status AS course_status FROM resources r JOIN lessons l ON l.id=r.lesson_id JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE c.slug=${slug} ORDER BY CASE WHEN l.slug LIKE 'eplab-giao-trinh-%' THEN 0 ELSE 1 END,ch.position,l.position,r.name`,
    );
    const seen = new Set<string>();
    return files
      .filter((l) => canSeeSummary(l, req.actor))
      .filter((l) => {
        const key = l.file_hash + ":" + l.audience;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((l) => ({
        name: l.name,
        size: Number(l.size),
        type: l.content_type,
        lessonSlug: l.slug,
        title: l.title,
        description: l.summary,
        audience: l.audience,
        version:
          participantHandbooks.find((b) => b.lessonSlug === l.slug)?.version ||
          l.software_version,
        accessible: canLearn(req.actor, l as any),
        resourceId: canLearn(req.actor, l as any) ? l.resource_id : null,
      }));
  });
  app.get("/api/lessons/:slug", async (req) => {
    const l = await getLesson(
      z
        .string()
        .max(120)
        .parse((req.params as any).slug),
    );
    if (!l || (l.course_status !== "published" && !hasAdminAccess(req.actor)))
      throw new ApiError(404, "Không tìm thấy bài.");
    if (!canLearn(req.actor, l as any))
      throw new ApiError(
        403,
        l.status === "draft"
          ? "Bài đang được biên soạn."
          : "Tham gia Lab và được admin duyệt để xem bài học này.",
      );
    const resources = await rows(
      sql`SELECT id,name,size,content_type FROM resources WHERE lesson_id=${l.id} OR (id=${l.document_resource_id} AND ${!l.preview})`,
    );
    const progress = personalActor(req)
      ? await one(
          sql`SELECT completed,note,updated_at FROM progress WHERE user_id=${personalActor(req)!.id} AND lesson_id=${l.id}`,
        )
      : null;
    const study = await one(
      sql`SELECT body FROM kicad_lessons WHERE lesson_id=${l.id}`,
    );
    return {
      ...l,
      answer: undefined,
      resources,
      progress,
      study: study ? publicStudy(study.body) : null,
      handbook: participantHandbooks.find((book) => book.lessonSlug === l.slug),
    };
  });
  app.get("/api/lessons/:slug/answer", async (req) => {
    const u = auth(req);
    const l = await getLesson(
      z
        .string()
        .max(120)
        .parse((req.params as any).slug),
    );
    if (!l || !canLearn(u, l as any))
      throw new ApiError(403, "Bạn chưa có quyền xem đáp án.");
    return { answer: l.answer };
  });
  app.put("/api/progress/:slug", async (req) => {
    const u = auth(req);
    const l = await getLesson(
      z
        .string()
        .max(120)
        .parse((req.params as any).slug),
    );
    if (!l || !canLearn(u, l as any))
      throw new ApiError(403, "Bạn chưa có quyền học bài này.");
    const b = z
      .object({ completed: z.boolean(), note: z.string().max(10000) })
      .strict()
      .parse(req.body);
    await db.execute(
      sql`INSERT INTO progress(user_id,lesson_id,completed,note) VALUES(${u.id},${l.id},${b.completed},${b.note}) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed=EXCLUDED.completed,note=EXCLUDED.note,updated_at=now()`,
    );
    return { ok: true };
  });
  app.get("/api/progress", async (req) => {
    const u = auth(req);
    return rows(
      sql`SELECT p.completed,p.note,p.updated_at,l.slug,l.title,c.title AS course_title,c.category FROM progress p JOIN lessons l ON l.id=p.lesson_id JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE p.user_id=${u.id} ORDER BY p.updated_at DESC`,
    );
  });
}
