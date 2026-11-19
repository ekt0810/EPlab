import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import fs from "node:fs";
import path from "node:path";
import { pool } from "../db.js";
import { config } from "../config.js";
import {
  auth,
  admin,
  canLearn,
  hasAdminAccess,
  ApiError,
  personalActor,
} from "../security.js";
import {
  courses,
  findLesson,
  publicLesson,
  lessonSources,
  sceneCount,
  sourceAudit,
} from "./catalog.js";
import { aiStatus } from "./tutor.js";
import { handbookAnswer } from "./answers.js";
import { classroomNavigation } from "./navigation.js";
import type { Track, ClassroomLesson } from "./model.js";

const params = z.object({
  track: z.enum(["embedded", "kicad", "solidworks"]),
  id: z
    .string()
    .regex(/^[a-z]{1,3}\d{2}$/)
    .optional(),
});
const filenames: Record<Track, string> = {
  embedded: "EP-LAB-Giao-trinh-C-nhung-v6.pdf",
  kicad: "EP-LAB-Giao-trinh-KiCad-v6.pdf",
  solidworks: "EP-LAB-Giao-trinh-SOLIDWORKS-v6.pdf",
};
async function courseStatus(track: Track) {
  const row = (
    await pool.query("SELECT status FROM courses WHERE category=$1", [track])
  ).rows[0];
  return row?.status || "draft";
}
async function accessible(
  req: FastifyRequest,
  track: Track,
  lesson?: ClassroomLesson,
) {
  return canLearn(req.actor, {
    status: "published",
    course_status: await courseStatus(track),
    preview: lesson?.preview || false,
  });
}
async function requestedLesson(req: FastifyRequest) {
  const { track, id } = params.parse(req.params),
    lesson = id && findLesson(track, id);
  if (!lesson) throw new ApiError(404, "Không tìm thấy bài trong lớp học.");
  if (!(await accessible(req, track, lesson)))
    throw new ApiError(403, "Tham gia Lab và được duyệt để học nội dung này.");
  return { track, lesson };
}
async function readableLessons(req: FastifyRequest, track: Track) {
  const status = await courseStatus(track);
  return courses[track].lessons.filter((candidate) =>
    canLearn(req.actor, {
      status: "published",
      course_status: status,
      preview: candidate.preview,
    }),
  );
}
export async function classroomRoutes(app: FastifyInstance) {
  await classroomNavigation(app);
  app.get("/api/classroom/:track", async (req) => {
    const { track } = params.parse(req.params),
      course = courses[track],
      status = await courseStatus(track);
    if (status !== "published" && !hasAdminAccess(req.actor))
      throw new ApiError(404, "Môn học chưa được mở.");
    const progress = personalActor(req)
      ? (
          await pool.query(
            "SELECT lesson_id,scene,quiz_passed,completed,updated_at FROM classroom_progress WHERE user_id=$1 AND track=$2",
            [personalActor(req)!.id, track],
          )
        ).rows
      : [];
    return {
      ...course,
      lessons: course.lessons.map((l) => ({
        id: l.id,
        module: l.module,
        title: l.title,
        summary: l.summary,
        minutes: l.minutes,
        level: l.level,
        preview: l.preview,
        objectives: l.objectives,
        accessible: canLearn(req.actor, {
          status: "published",
          course_status: status,
          preview: l.preview,
        }),
        progress: progress.find((p) => p.lesson_id === l.id) || null,
      })),
      ai: aiStatus(),
      checkedAt: sourceAudit.checkedAt,
      handbook: {
        url: `/api/classroom/${track}/handbook`,
        accessible: canLearn(req.actor, {
          status: "published",
          course_status: status,
          preview: false,
        }),
      },
    };
  });
  app.get("/api/classroom/:track/sources", async (req) => {
    const { track } = params.parse(req.params);
    const videos = sourceAudit.sources.filter((v) => v.track === track);
    return {
      checkedAt: sourceAudit.checkedAt,
      method: sourceAudit.method,
      videos,
      documents: [...new Set(courses[track].lessons.flatMap((l) => l.sources))],
      counts: {
        total: videos.length,
        selected: videos.filter(
          (v) => !["excluded", "unavailable"].includes(v.kind),
        ).length,
        unavailable: videos.filter((v) => v.kind === "unavailable").length,
        excluded: videos.filter((v) => v.kind === "excluded").length,
      },
    };
  });
  app.get("/api/classroom/:track/handbook", async (req, reply) => {
    const { track } = params.parse(req.params);
    if (!(await accessible(req, track)))
      throw new ApiError(
        403,
        "Giáo trình PDF đầy đủ dành cho thành viên đã được duyệt.",
      );
    const file = path.join(
      config.root,
      "apps/api/assets/classroom-handbooks",
      filenames[track],
    );
    if (!fs.existsSync(file))
      throw new ApiError(404, "Bản PDF chưa được cài vào máy chủ này.");
    return reply
      .type("application/pdf")
      .header(
        "Content-Disposition",
        `attachment; filename="${filenames[track]}"`,
      )
      .send(fs.createReadStream(file));
  });
  app.get("/api/classroom/:track/report", async (req) => {
    const u = auth(req),
      { track } = params.parse(req.params);
    return {
      course: courses[track].title,
      version: courses[track].version,
      progress: (
        await pool.query(
          "SELECT lesson_id,scene,note,checklist,quiz_passed,completed,updated_at FROM classroom_progress WHERE user_id=$1 AND track=$2 ORDER BY updated_at DESC",
          [u.id, track],
        )
      ).rows,
    };
  });
  app.get("/api/classroom/:track/lessons/:id", async (req) => {
    const { track, lesson } = await requestedLesson(req);
    const readableIds = new Set(
      (await readableLessons(req, track)).map((l) => l.id),
    );
    const progress = personalActor(req)
      ? (
          await pool.query(
            "SELECT lesson_id,scene,note,checklist,quiz_passed,completed,updated_at FROM classroom_progress WHERE user_id=$1 AND track=$2 AND lesson_id=$3",
            [personalActor(req)!.id, track, lesson.id],
          )
        ).rows[0]
      : null;
    const messages = personalActor(req)
      ? (
          await pool.query(
            "SELECT id,question,answer,mode,evidence,created_at FROM classroom_messages WHERE user_id=$1 AND track=$2 AND lesson_id=$3 ORDER BY id DESC LIMIT 20",
            [personalActor(req)!.id, track, lesson.id],
          )
        ).rows
          .reverse()
          .filter((message) =>
            (message.evidence?.references || []).every(
              (reference: { lessonId: string }) =>
                readableIds.has(reference.lessonId),
            ),
          )
      : [];
    return {
      lesson: publicLesson(lesson),
      sources: lessonSources(track, lesson),
      progress: progress || null,
      messages,
      scenes: sceneCount(lesson),
      ai: aiStatus(),
    };
  });
  app.put("/api/classroom/:track/lessons/:id/progress", async (req) => {
    const u = auth(req),
      { track, lesson } = await requestedLesson(req);
    const b = z
      .object({
        scene: z
          .number()
          .int()
          .min(0)
          .max(sceneCount(lesson) - 1),
        note: z.string().max(10000),
        checklist: z
          .array(
            z
              .number()
              .int()
              .min(0)
              .max(lesson.steps.length - 1),
          )
          .max(lesson.steps.length),
        completed: z.boolean().default(false),
      })
      .strict()
      .parse(req.body);
    const checklist = [...new Set(b.checklist)];
    if (b.completed) {
      const p = (
        await pool.query(
          "SELECT quiz_passed FROM classroom_progress WHERE user_id=$1 AND track=$2 AND lesson_id=$3",
          [u.id, track, lesson.id],
        )
      ).rows[0];
      if (!p?.quiz_passed || checklist.length !== lesson.steps.length)
        throw new ApiError(
          409,
          "Hoàn thành tự kiểm và xác nhận đủ bước thực hành trước khi hoàn tất bài.",
        );
    }
    const result = await pool.query(
      `INSERT INTO classroom_progress(user_id,track,lesson_id,scene,note,checklist,completed) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)
      ON CONFLICT(user_id,track,lesson_id) DO UPDATE SET scene=EXCLUDED.scene,note=EXCLUDED.note,checklist=EXCLUDED.checklist,completed=EXCLUDED.completed,updated_at=now()
      RETURNING lesson_id,scene,note,checklist,quiz_passed,completed,updated_at`,
      [
        u.id,
        track,
        lesson.id,
        b.scene,
        b.note,
        JSON.stringify(checklist),
        b.completed,
      ],
    );
    return result.rows[0];
  });
  app.post("/api/classroom/:track/lessons/:id/quiz", async (req) => {
    const u = auth(req),
      { track, lesson } = await requestedLesson(req);
    const { answer } = z
      .object({
        answer: z
          .number()
          .int()
          .min(0)
          .max(lesson.quiz.options.length - 1),
      })
      .strict()
      .parse(req.body);
    const passed = answer === lesson.quiz.answer;
    const p = await pool.query(
      `INSERT INTO classroom_progress(user_id,track,lesson_id,quiz_passed,quiz_attempts) VALUES($1,$2,$3,$4,1)
      ON CONFLICT(user_id,track,lesson_id) DO UPDATE SET quiz_passed=classroom_progress.quiz_passed OR EXCLUDED.quiz_passed,quiz_attempts=classroom_progress.quiz_attempts+1,updated_at=now() RETURNING quiz_passed`,
      [u.id, track, lesson.id, passed],
    );
    return {
      correct: passed,
      explanation: lesson.quiz.explanation,
      passed: p.rows[0].quiz_passed,
    };
  });
  app.post(
    "/api/classroom/:track/lessons/:id/chat",
    { config: { rateLimit: { max: 12, timeWindow: "1 minute" } } },
    async (req) => {
      const u = auth(req),
        { track, lesson } = await requestedLesson(req);
      const b = z
        .object({
          question: z.string().trim().min(3).max(2000),
        })
        .strict()
        .parse(req.body);
      const allowed = await readableLessons(req, track);
      const { answer, evidence } = handbookAnswer(
        track,
        lesson,
        b.question,
        allowed,
      );
      const result = await pool.query(
        "INSERT INTO classroom_messages(user_id,track,lesson_id,role,question,answer,mode,evidence) VALUES($1,$2,$3,'teacher',$4,$5,'guide',$6::jsonb) RETURNING id,question,answer,mode,evidence,created_at",
        [u.id, track, lesson.id, b.question, answer, JSON.stringify(evidence)],
      );
      return result.rows[0];
    },
  );
  app.get("/api/admin/classroom/progress", async (req) => {
    admin(req);
    return (
      await pool.query(
        "SELECT p.user_id,u.name,p.track,count(*)::int AS started,count(*) FILTER(WHERE completed)::int AS completed,max(updated_at) AS updated_at FROM classroom_progress p JOIN users u ON u.id=p.user_id GROUP BY p.user_id,u.name,p.track ORDER BY updated_at DESC",
      )
    ).rows;
  });
}
