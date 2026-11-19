import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PoolClient } from "pg";
import { z } from "zod";
import { pool, tx } from "../db.js";
import {
  ApiError,
  auth,
  admin,
  hasAdminAccess,
  canLearn,
} from "../security.js";
import { tracks, type Track } from "./attachments.js";
const messageSchema = z
  .object({
    body: z.string().trim().min(1).max(3000),
    clientId: z.string().uuid(),
  })
  .strict();
const idOf = (req: FastifyRequest) =>
  z
    .string()
    .uuid()
    .parse((req.params as any).id);
function actor(req: FastifyRequest) {
  const u = auth(req);
  if (u.role === "admin" && !hasAdminAccess(u))
    throw new ApiError(403, "Hoàn tất xác thực của người chủ trì.");
  return u;
}
async function threadFor(
  req: FastifyRequest,
  track: Track,
  c: Pick<PoolClient, "query"> = pool,
  lock = false,
) {
  const u = actor(req);
  const t = (
    await c.query(
      `SELECT t.*,e.published,c.status AS course_status,e.body->>'title' AS exercise_title,
 u.name AS participant_name FROM practice_threads t JOIN exercises e ON e.id=t.exercise_id JOIN courses c ON c.id=e.course_id
 JOIN users u ON u.id=t.participant_id WHERE t.id=$1 AND c.category=$2 ${lock ? "FOR UPDATE OF t" : ""}`,
      [idOf(req), track],
    )
  ).rows[0];
  if (!t || (t.participant_id !== u.id && !hasAdminAccess(u)))
    throw new ApiError(404, "Không tìm thấy cuộc trao đổi.");
  return t;
}
function canWrite(req: FastifyRequest, t: any) {
  if (
    !canLearn(req.actor, {
      status: t.published ? "published" : "draft",
      preview: false,
      course_status: t.course_status,
    })
  )
    throw new ApiError(403, "Cần quyền học để gửi trao đổi về bài này.");
}
async function append(
  c: PoolClient,
  u: any,
  t: any,
  b: z.infer<typeof messageSchema>,
) {
  const old = (
    await c.query(
      "SELECT id,thread_id,body FROM practice_messages WHERE author_id=$1 AND client_id=$2",
      [u.id, b.clientId],
    )
  ).rows[0];
  if (old) {
    if (old.thread_id !== t.id || old.body !== b.body)
      throw new ApiError(409, "Mã lần gửi đã được dùng cho nội dung khác.");
    return { id: old.id, duplicate: true };
  }
  if (t.resolved)
    throw new ApiError(
      409,
      "Cuộc trao đổi đã được giải đáp. Chọn Tiếp tục trao đổi để mở lại.",
    );
  if (
    (
      await c.query(
        "SELECT count(*)::int AS n FROM practice_messages WHERE thread_id=$1",
        [t.id],
      )
    ).rows[0].n >= 1000
  )
    throw new ApiError(409, "Cuộc trao đổi đã đạt giới hạn 1000 tin nhắn.");
  const saved = (
    await c.query(
      "INSERT INTO practice_messages(thread_id,author_id,client_id,body) VALUES($1,$2,$3,$4) RETURNING id",
      [t.id, u.id, b.clientId, b.body],
    )
  ).rows[0];
  await c.query("UPDATE practice_threads SET updated_at=now() WHERE id=$1", [
    t.id,
  ]);
  return { ...saved, duplicate: false };
}
export async function conversationRoutes(app: FastifyInstance) {
  for (const track of tracks) {
    const prefix = `/api/${track}/conversations`;
    app.get(prefix, async (req) => {
      const u = actor(req),
        host = hasAdminAccess(u);
      const page = z.coerce
        .number()
        .int()
        .min(0)
        .max(10000)
        .default(0)
        .parse((req.query as any).page);
      const rows = (
        await pool.query(
          `SELECT t.id,t.exercise_id,t.subject,t.resolved,t.updated_at,u.name AS participant_name,
    e.body->>'title' AS exercise_title,m.body AS last_message,m.role AS last_role,
    CASE WHEN t.resolved THEN 'none' WHEN m.role='admin' THEN 'participant' ELSE 'host' END AS waiting_for
    FROM practice_threads t JOIN exercises e ON e.id=t.exercise_id JOIN courses c ON c.id=e.course_id JOIN users u ON u.id=t.participant_id
    LEFT JOIN LATERAL (SELECT left(pm.body,180) AS body,au.role FROM practice_messages pm JOIN users au ON au.id=pm.author_id WHERE pm.thread_id=t.id ORDER BY pm.id DESC LIMIT 1) m ON true
    WHERE c.category=$1 AND (t.participant_id=$2 OR $3) ORDER BY t.updated_at DESC,t.id DESC LIMIT 31 OFFSET $4`,
          [track, u.id, host, page * 30],
        )
      ).rows;
      return { items: rows.slice(0, 30), hasMore: rows.length > 30 };
    });
    app.post(
      prefix,
      { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
      async (req, reply) => {
        const u = actor(req),
          b = messageSchema
            .extend({
              exerciseId: z.string().regex(/^[ecs]\d{2}$/),
              subject: z.string().trim().min(3).max(160),
            })
            .strict()
            .parse(req.body);
        const result = await tx(async (c) => {
          // Serializes same-user creation and clientId retries across different exercise threads.
          await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [u.id]);
          const exercise = (
            await c.query(
              "SELECT e.*,c.status AS course_status FROM exercises e JOIN courses c ON c.id=e.course_id WHERE e.id=$1 AND c.category=$2",
              [b.exerciseId, track],
            )
          ).rows[0];
          if (!exercise) throw new ApiError(404, "Không tìm thấy bài tập.");
          canWrite(req, exercise);
          const added = await c.query(
            "INSERT INTO practice_threads(exercise_id,participant_id,subject) VALUES($1,$2,$3) ON CONFLICT(exercise_id,participant_id) DO NOTHING RETURNING *",
            [b.exerciseId, u.id, b.subject],
          );
          const t =
            added.rows[0] ||
            (
              await c.query(
                "SELECT * FROM practice_threads WHERE exercise_id=$1 AND participant_id=$2 FOR UPDATE",
                [b.exerciseId, u.id],
              )
            ).rows[0];
          const message = await append(c, u, t, b);
          return {
            id: t.id,
            created: !!added.rowCount,
            duplicate: message.duplicate,
            messageId: message.id,
          };
        });
        reply.code(result.created ? 201 : 200);
        return result;
      },
    );
    app.get(prefix + "/:id", async (req) => {
      const t = await threadFor(req, track);
      const before = z
        .string()
        .regex(/^\d{1,18}$/)
        .optional()
        .parse((req.query as any).before);
      const rows = (
        await pool.query(
          `SELECT m.id,m.body,m.created_at,u.name AS author_name,
    CASE WHEN u.role='admin' THEN 'Người chủ trì' ELSE 'Người tham gia' END AS author_role
    FROM practice_messages m JOIN users u ON u.id=m.author_id WHERE m.thread_id=$1 AND ($2::bigint IS NULL OR m.id<$2) ORDER BY m.id DESC LIMIT 51`,
          [t.id, before || null],
        )
      ).rows;
      const messages = rows.slice(0, 50);
      return {
        thread: {
          id: t.id,
          exercise_id: t.exercise_id,
          exercise_title: t.exercise_title,
          participant_name: t.participant_name,
          subject: t.subject,
          resolved: t.resolved,
        },
        messages: messages.reverse(),
        hasOlder: rows.length > 50,
        nextBefore: messages[0]?.id || null,
      };
    });
    app.post(
      prefix + "/:id/messages",
      { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
      async (req, reply) => {
        const u = actor(req),
          b = messageSchema.parse(req.body);
        const saved = await tx(async (c) => {
          await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [u.id]);
          const t = await threadFor(req, track, c, true);
          canWrite(req, t);
          return append(c, u, t, b);
        });
        reply.code(saved.duplicate ? 200 : 201);
        return saved;
      },
    );
    app.patch(prefix + "/:id", async (req) => {
      const u = actor(req),
        b = z.object({ resolved: z.boolean() }).strict().parse(req.body);
      if (b.resolved) admin(req);
      return tx(async (c) => {
        const t = await threadFor(req, track, c, true);
        canWrite(req, t);
        await c.query(
          "UPDATE practice_threads SET resolved=$2,updated_at=now() WHERE id=$1",
          [t.id, b.resolved],
        );
        await c.query(
          "INSERT INTO audit_logs(actor_id,action,target,metadata) VALUES($1,'conversation.status',$2,$3)",
          [u.id, t.id, JSON.stringify(b)],
        );
        return { ok: true };
      });
    });
  }
}
