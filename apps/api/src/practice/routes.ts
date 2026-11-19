import { withSelfChecks, parseSelfChecks } from "./self-checks.js";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import { conversationRoutes } from "./conversations.js";
import {
  inspectAttachments,
  tracks,
  type Track,
  type SubmittedFile,
} from "./attachments.js";
import { createHash } from "node:crypto";
import { pool, tx } from "../db.js";
import {
  ApiError,
  admin,
  auth,
  canLearn,
  hasAdminAccess,
  personalActor,
} from "../security.js";
import { curriculum, library, publicStudy, type Exercise } from "./content.js";
import {
  normalizeImages,
  summarizeReport,
  validateReview,
} from "./validation.js";
const idOf = (req: FastifyRequest) =>
  z
    .string()
    .uuid()
    .parse((req.params as any).id);
const resultOf = (s: any) => ({
  ...s,
  images: undefined,
  attachments: (s.attachments || []).map(
    ({ data, ...meta }: SubmittedFile) => meta,
  ),
  image_hash: undefined,
  fingerprint: undefined,
  result: s.result ? JSON.parse(s.result) : null,
  report: s.report ? JSON.parse(s.report) : null,
});
async function exerciseFor(
  req: FastifyRequest,
  id: string,
  track: Track,
  detail = true,
) {
  const e = (
    await pool.query(
      "SELECT e.*,c.status AS course_status FROM exercises e JOIN courses c ON c.id=e.course_id WHERE e.id=$1 AND c.category=$2",
      [id, track],
    )
  ).rows[0];
  if (!e) throw new ApiError(404, "Không tìm thấy bài tập.");
  if (
    detail &&
    !canLearn(req.actor, {
      status: e.published ? "published" : "draft",
      preview: false,
      course_status: e.course_status,
    })
  )
    throw new ApiError(
      403,
      "Tham gia Lab và được admin duyệt để vào phòng thực hành.",
    );
  e.body = withSelfChecks(e.body);
  return e;
}
async function ownedSubmission(req: FastifyRequest, track: Track) {
  const u = auth(req),
    id = idOf(req);
  const s = (
    await pool.query(
      "SELECT s.*,u.name AS student_name,u.email AS student_email FROM submissions s JOIN users u ON u.id=s.user_id JOIN exercises e ON e.id=s.exercise_id JOIN courses c ON c.id=e.course_id WHERE s.id=$1 AND c.category=$2",
      [id, track],
    )
  ).rows[0];
  if (!s || (s.user_id !== u.id && !hasAdminAccess(u)))
    throw new ApiError(404, "Không tìm thấy bài nộp.");
  return s;
}
let uploads = 0;
export async function practiceRoutes(app: FastifyInstance) {
  for (const track of tracks) await registerTrack(app, track);
  await conversationRoutes(app);
}
async function registerTrack(app: FastifyInstance, track: Track) {
  const prefix = `/api/${track}`,
    adminPrefix = `/api/admin/${track}`;
  if (track === "kicad") {
    app.get(`${prefix}/catalog`, async (req) => {
      const rows = (
        await pool.query(
          `SELECT l.id,l.slug,l.title,l.summary,l.status,l.preview,l.audience,k.module,k.source_id,c.status AS course_status,
    COALESCE(q.passed,false) AS quiz_passed,COALESCE(p.completed,false) AS completed
    FROM kicad_lessons k JOIN lessons l ON l.id=k.lesson_id JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id
    LEFT JOIN quiz_results q ON q.lesson_id=l.id AND q.user_id=$1 LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=$1
    WHERE (l.status='published' AND c.status='published' AND l.audience='student') OR $2 ORDER BY k.module,l.position`,
          [personalActor(req)?.id || null, hasAdminAccess(req.actor)],
        )
      ).rows;
      return {
        modules: curriculum.modules,
        lessons: rows.map((l) => ({
          ...l,
          accessible: canLearn(req.actor, l),
        })),
      };
    });
    app.get(`${prefix}/library`, async () => library);
    app.get(`${prefix}/lessons/:slug`, async (req) => {
      const l = (
        await pool.query(
          `SELECT l.*,k.body,c.status AS course_status FROM lessons l JOIN kicad_lessons k ON k.lesson_id=l.id JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE l.slug=$1`,
          [(req.params as any).slug],
        )
      ).rows[0];
      if (!l) throw new ApiError(404, "Không tìm thấy giáo trình.");
      if (!canLearn(req.actor, l))
        throw new ApiError(
          403,
          "Tham gia Lab và được admin duyệt để đọc giáo trình.",
        );
      return publicStudy(l.body);
    });
    app.post(`${prefix}/lessons/:slug/quiz`, async (req) => {
      const u = auth(req),
        b = z
          .object({ answer: z.number().int().min(0).max(3) })
          .strict()
          .parse(req.body);
      const l = (
        await pool.query(
          `SELECT l.*,k.body,c.status AS course_status FROM lessons l JOIN kicad_lessons k ON k.lesson_id=l.id JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE l.slug=$1`,
          [(req.params as any).slug],
        )
      ).rows[0];
      if (!l || !canLearn(u, l))
        throw new ApiError(403, "Bạn chưa có quyền học bài này.");
      const correct = b.answer === l.body.quiz.answer;
      await tx(async (c) => {
        await c.query(
          `INSERT INTO quiz_results(user_id,lesson_id,passed,last_answer) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,lesson_id) DO UPDATE SET attempts=quiz_results.attempts+1,passed=quiz_results.passed OR EXCLUDED.passed,last_answer=EXCLUDED.last_answer,updated_at=now()`,
          [u.id, l.id, correct, b.answer],
        );
        if (correct)
          await c.query(
            `INSERT INTO progress(user_id,lesson_id,completed) VALUES($1,$2,true) ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed=true,updated_at=now()`,
            [u.id, l.id],
          );
      });
      return { correct, explanation: l.body.quiz.explanation };
    });
  }
  app.get(`${prefix}/exercises`, async (req) => {
    const rows = (
      await pool.query(
        `SELECT e.*,c.status AS course_status,
         (SELECT count(*)::int FROM submissions s WHERE s.exercise_id=e.id AND s.user_id=$3) AS submitted,
         EXISTS(SELECT 1 FROM submissions s WHERE s.exercise_id=e.id AND s.user_id=$3 AND s.status='visual_pass') AS passed,
         (SELECT jsonb_build_object('id',s.id,'status',s.status) FROM submissions s WHERE s.exercise_id=e.id AND s.user_id=$3 ORDER BY s.created_at DESC,s.id DESC LIMIT 1) AS latest
         FROM exercises e JOIN courses c ON c.id=e.course_id WHERE ((e.published AND c.status='published') OR $1) AND c.category=$2 ORDER BY e.id`,
        [hasAdminAccess(req.actor), track, personalActor(req)?.id || null],
      )
    ).rows;
    return rows.map((e) => ({
      id: e.id,
      module: e.body.module,
      title: e.body.title,
      difficulty: e.body.difficulty,
      level: e.body.level,
      order: e.body.order,
      prerequisites: e.body.prerequisites || [],
      submitted: e.submitted,
      passed: e.passed,
      latest: e.latest,
      minutes: e.body.minutes,
      brief: e.body.brief,
      accessible: canLearn(req.actor, {
        status: e.published ? "published" : "draft",
        preview: false,
        course_status: e.course_status,
      }),
    }));
  });
  app.get(
    `${prefix}/exercises/:exercise`,
    async (req) =>
      (
        await exerciseFor(
          req,
          z
            .string()
            .regex(/^[ecs]\d{2}$/)
            .parse((req.params as any).exercise),
          track,
        )
      ).body,
  );
  app.post(
    `${prefix}/submissions`,
    { bodyLimit: (track === "kicad" ? 11 : 26) * 1024 * 1024 },
    async (req, reply) => {
      const u = auth(req);
      if (!canLearn(u, { status: "published", preview: false }))
        throw new ApiError(403, "Bạn chưa có quyền nộp bài.");
      if (uploads >= 2)
        throw new ApiError(
          429,
          "Đang xử lý nhiều ảnh. Vui lòng gửi lại sau ít giây.",
        );
      uploads++;
      try {
        const fields: Record<string, string> = Object.create(null),
          files: Buffer[] = [],
          attachmentsRaw: { name: string; bytes: Buffer }[] = [];
        for await (const p of req.parts({
          limits: {
            fileSize: 5 * 1024 * 1024,
            files: track === "kicad" ? 2 : 8,
            fields: 5,
            fieldSize: 100_000,
            parts: track === "kicad" ? 7 : 13,
          },
        })) {
          if (p.type === "file") {
            if (
              p.fieldname !== "images" &&
              (p.fieldname !== "attachments" || track === "kicad")
            )
              throw new ApiError(400, "Trường tệp không hợp lệ.");
            const bytes = await p.toBuffer();
            if (p.file.truncated)
              throw new ApiError(413, "Mỗi ảnh tối đa 5 MB.");
            if (p.fieldname === "images") files.push(bytes);
            else attachmentsRaw.push({ name: p.filename, bytes });
          } else {
            if (p.fieldname in fields || p.valueTruncated)
              throw new ApiError(400, "Trường nhập bị trùng hoặc quá dài.");
            fields[p.fieldname] = String(p.value);
          }
        }
        const b = z
          .object({
            exerciseId: z.string().regex(/^[ecs]\d{2}$/),
            notes: z.string().trim().min(15).max(1500),
            report: z.string().max(100000).default(""),
            assignmentId: z.string().uuid().optional(),
            selfChecks: z.string().max(16000).default("[]"),
          })
          .strict()
          .parse(fields);
        const e = await exerciseFor(req, b.exerciseId, track),
          selfChecks = parseSelfChecks(b.selfChecks, e.body),
          images = await normalizeImages(files),
          report = track === "kicad" ? summarizeReport(b.report) : null,
          attachments = inspectAttachments(attachmentsRaw, track);
        if (track !== "kicad" && b.report.trim())
          throw new ApiError(400, "Báo cáo ERC/DRC chỉ dùng cho KiCad.");
        if (
          track === "embedded" &&
          !attachments.some((f) => f.name.toLowerCase().endsWith(".c"))
        )
          throw new ApiError(400, "Bài C cần ít nhất một tệp mã nguồn .c.");
        if (
          track === "solidworks" &&
          !attachments.some((f) =>
            /\.(sldprt|sldasm|slddrw|step|stp)$/i.test(f.name),
          )
        )
          throw new ApiError(
            400,
            "Cần nộp tệp thiết kế SOLIDWORKS hoặc STEP theo đề bài.",
          );
        const imageHash = createHash("sha256")
          .update(JSON.stringify(images))
          .digest("hex");
        const fingerprint = createHash("sha256")
          .update(
            JSON.stringify({
              exercise: e.id,
              rubric: e.body,
              assignment: b.assignmentId || null,
              imageHash,
              attachments: attachments.map(({ data, ...meta }) => meta),
              notes: b.notes,
              selfChecks,
              report,
            }),
          )
          .digest("hex");
        const saved = await tx(async (c) => {
          await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [u.id]);
          if (b.assignmentId) {
            const a = (
              await c.query("SELECT * FROM assignments WHERE id=$1 FOR SHARE", [
                b.assignmentId,
              ])
            ).rows[0];
            if (
              !a ||
              a.exercise_id !== e.id ||
              (a.student_id && a.student_id !== u.id && !hasAdminAccess(u))
            )
              throw new ApiError(404, "Không tìm thấy bài được giao.");
            if (a.closed)
              throw new ApiError(409, "Bài được giao đã đóng nhận bài.");
          }
          const previous = (
            await c.query(
              "SELECT * FROM submissions WHERE user_id=$1 AND fingerprint=$2",
              [u.id, fingerprint],
            )
          ).rows[0];
          if (previous) return { ...previous, duplicate: true };
          const count = (
            await c.query(
              "SELECT count(*)::int AS total,count(*) FILTER(WHERE created_at>now()-interval '1 hour')::int AS recent,COALESCE(sum(octet_length(attachments::text)+octet_length(images::text)),0) AS attachment_bytes FROM submissions WHERE user_id=$1",
              [u.id],
            )
          ).rows[0];
          if (
            Number(count.attachment_bytes) +
              Buffer.byteLength(JSON.stringify(attachments)) +
              Buffer.byteLength(JSON.stringify(images)) >
            100 * 1024 * 1024
          )
            throw new ApiError(
              413,
              "Tổng tệp và ảnh bài nộp của tài khoản đã đạt giới hạn 100 MB.",
            );
          if (count.total >= 100 || count.recent >= 20)
            throw new ApiError(
              429,
              "Đã đạt giới hạn lưu bài (100 bài/tài khoản, 20 bài/giờ).",
            );
          return (
            await c.query(
              `INSERT INTO submissions(user_id,exercise_id,assignment_id,status,notes,report,images,image_count,image_hash,fingerprint,rubric,attachments,self_checks)
      VALUES($1,$2,$3,'pending_manual',$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
              [
                u.id,
                e.id,
                b.assignmentId || null,
                b.notes,
                report ? JSON.stringify(report) : null,
                JSON.stringify(images),
                images.length,
                imageHash,
                fingerprint,
                JSON.stringify(e.body),
                JSON.stringify(attachments),
                JSON.stringify(selfChecks),
              ],
            )
          ).rows[0];
        });
        reply.code(saved.duplicate ? 200 : 201);
        return resultOf(saved);
      } finally {
        uploads--;
      }
    },
  );
  app.get(`${prefix}/submissions`, async (req) => {
    const u = auth(req);
    return (
      await pool.query(
        "SELECT id,exercise_id,status,notes,report,image_count,result,revision,created_at,updated_at,assignment_id FROM submissions WHERE user_id=$1 AND exercise_id IN (SELECT e.id FROM exercises e JOIN courses c ON c.id=e.course_id WHERE c.category=$2) ORDER BY created_at DESC LIMIT 100",
        [u.id, track],
      )
    ).rows.map(resultOf);
  });
  app.get(`${prefix}/submissions/:id`, async (req) => {
    const s = await ownedSubmission(req, track);
    const reviews = (
      await pool.query(
        "SELECT r.result,r.created_at,u.name AS reviewer FROM submission_reviews r JOIN users u ON u.id=r.reviewer_id WHERE r.submission_id=$1 ORDER BY r.created_at DESC",
        [s.id],
      )
    ).rows;
    return { ...resultOf(s), reviews };
  });
  app.get(`${prefix}/submissions/:id/images/:index`, async (req, reply) => {
    const s = await ownedSubmission(req, track),
      i = z.coerce
        .number()
        .int()
        .min(0)
        .max(1)
        .parse((req.params as any).index),
      image = JSON.parse(s.images)[i];
    if (!image) throw new ApiError(404, "Không tìm thấy ảnh.");
    return reply
      .type("image/webp")
      .header("Content-Disposition", 'inline; filename="bai-lam.webp"')
      .header("X-Content-Type-Options", "nosniff")
      .send(Buffer.from(image.split(",")[1], "base64"));
  });
  app.get(`${prefix}/submissions/:id/files/:index`, async (req, reply) => {
    const s = await ownedSubmission(req, track);
    const i = z.coerce
      .number()
      .int()
      .min(0)
      .max(5)
      .parse((req.params as any).index);
    const file: SubmittedFile | undefined = s.attachments[i];
    if (!file) throw new ApiError(404, "Không tìm thấy tệp bài nộp.");
    return reply
      .type("application/octet-stream")
      .header(
        "Content-Disposition",
        `attachment; filename="submission-file"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      )
      .header("X-Content-Type-Options", "nosniff")
      .header("Content-Security-Policy", "sandbox; default-src 'none'")
      .send(Buffer.from(file.data, "base64"));
  });
  app.get(`${adminPrefix}/submissions`, async (req) => {
    admin(req);
    const page = z.coerce
      .number()
      .int()
      .min(0)
      .max(10000)
      .default(0)
      .parse((req.query as any).page);
    return (
      await pool.query(
        `SELECT s.id,s.exercise_id,s.status,s.result,s.image_count,s.revision,s.created_at,s.updated_at,s.assignment_id,u.name AS student_name,u.email AS student_email
   FROM submissions s JOIN users u ON u.id=s.user_id JOIN exercises e ON e.id=s.exercise_id JOIN courses c ON c.id=e.course_id WHERE c.category=$2 ORDER BY s.created_at DESC LIMIT 30 OFFSET $1`,
        [page * 30, track],
      )
    ).rows.map(resultOf);
  });
  app.post(`${adminPrefix}/submissions/:id/review`, async (req) => {
    const u = admin(req),
      id = idOf(req);
    return tx(async (c) => {
      const s = (
        await c.query(
          "SELECT * FROM submissions WHERE id=$1 AND exercise_id IN (SELECT e.id FROM exercises e JOIN courses c ON c.id=e.course_id WHERE c.category=$2) FOR UPDATE",
          [id, track],
        )
      ).rows[0];
      if (!s) throw new ApiError(404, "Không tìm thấy bài nộp.");
      const result = validateReview(req.body, s.rubric as Exercise);
      if (result.revision !== s.revision)
        throw new ApiError(
          409,
          "Bài đã được người khác chấm. Tải lại để xem nhận xét mới.",
        );
      await c.query(
        "UPDATE submissions SET result=$1,status=$2,revision=revision+1,updated_at=now() WHERE id=$3",
        [JSON.stringify(result), result.status, id],
      );
      await c.query(
        "INSERT INTO submission_reviews(submission_id,reviewer_id,result) VALUES($1,$2,$3)",
        [id, u.id, JSON.stringify(result)],
      );
      await c.query(
        "INSERT INTO audit_logs(actor_id,action,target,metadata) VALUES($1,'submission.review',$2,$3)",
        [
          u.id,
          id,
          JSON.stringify({ score: result.score, status: result.status }),
        ],
      );
      return { ok: true, result };
    });
  });
  app.get(`${prefix}/assignments`, async (req) => {
    const u = auth(req);
    return (
      await pool.query(
        `SELECT a.*,e.body->>'title' AS title,(SELECT count(*)::int FROM submissions s WHERE s.assignment_id=a.id AND s.user_id=$1) AS submitted
    FROM assignments a JOIN exercises e ON e.id=a.exercise_id JOIN courses c ON c.id=e.course_id WHERE (a.student_id=$1 OR a.student_id IS NULL) AND c.category=$2 ORDER BY a.created_at DESC LIMIT 100`,
        [u.id, track],
      )
    ).rows;
  });
  app.get(`${adminPrefix}/assignments`, async (req) => {
    admin(req);
    return (
      await pool.query(
        `SELECT a.*,e.body->>'title' AS title,u.email AS student_email,(SELECT count(*)::int FROM submissions s WHERE s.assignment_id=a.id) AS submitted FROM assignments a JOIN exercises e ON e.id=a.exercise_id LEFT JOIN users u ON u.id=a.student_id JOIN courses c ON c.id=e.course_id WHERE c.category=$1 ORDER BY a.created_at DESC LIMIT 100`,
        [track],
      )
    ).rows;
  });
  app.post(`${adminPrefix}/assignments`, async (req) => {
    const u = admin(req),
      b = z
        .object({
          exerciseId: z.string().regex(/^[ecs]\d{2}$/),
          studentId: z.string().uuid().nullable(),
          instructions: z.string().trim().max(3000),
          dueAt: z.iso.datetime({ offset: true }).nullable(),
        })
        .strict()
        .parse(req.body);
    await exerciseFor(req, b.exerciseId, track);
    if (
      b.studentId &&
      !(
        await pool.query(
          "SELECT 1 FROM users WHERE id=$1 AND role='student' AND NOT blocked",
          [b.studentId],
        )
      ).rowCount
    )
      throw new ApiError(400, "Chọn người tham gia hợp lệ.");
    if (b.dueAt && new Date(b.dueAt) <= new Date())
      throw new ApiError(400, "Hạn nộp phải ở tương lai.");
    return tx(async (c) => {
      const a = (
        await c.query(
          "INSERT INTO assignments(exercise_id,student_id,created_by,instructions,due_at) VALUES($1,$2,$3,$4,$5) RETURNING *",
          [b.exerciseId, b.studentId, u.id, b.instructions, b.dueAt],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO audit_logs(actor_id,action,target) VALUES($1,'assignment.created',$2)",
        [u.id, a.id],
      );
      return a;
    });
  });
  app.patch(`${adminPrefix}/assignments/:id`, async (req) => {
    const u = admin(req),
      id = idOf(req),
      b = z.object({ closed: z.boolean() }).strict().parse(req.body);
    return tx(async (c) => {
      const r = await c.query(
        "UPDATE assignments SET closed=$1 WHERE id=$2 AND exercise_id IN (SELECT e.id FROM exercises e JOIN courses c ON c.id=e.course_id WHERE c.category=$3) RETURNING id",
        [b.closed, id, track],
      );
      if (!r.rowCount) throw new ApiError(404, "Không tìm thấy bài được giao.");
      await c.query(
        "INSERT INTO audit_logs(actor_id,action,target,metadata) VALUES($1,'assignment.status',$2,$3)",
        [u.id, id, JSON.stringify(b)],
      );
      return { ok: true };
    });
  });
}
