import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { one, rows, sql, tx, auditTx } from "./db.js";
import { auth, admin, ApiError } from "./security.js";
const requestSchema = z
  .object({
    tracks: z
      .array(z.enum(["embedded", "kicad", "solidworks"]))
      .min(1)
      .max(3)
      .refine((a) => new Set(a).size === a.length),
    message: z
      .string()
      .trim()
      .min(10, "Hãy chia sẻ mục tiêu học tập ít nhất 10 ký tự.")
      .max(1000),
  })
  .strict();
export async function labRoutes(app: FastifyInstance) {
  app.get("/api/lab/membership", async (req) => {
    const u = auth(req);
    return {
      active: u.role === "admin" || u.active,
      request:
        (await one(
          sql`SELECT status,tracks,message,decision_note,revision,created_at,updated_at,reviewed_at FROM lab_memberships WHERE user_id=${u.id}`,
        )) || null,
    };
  });
  app.post(
    "/api/lab/membership",
    { config: { rateLimit: { max: 8, timeWindow: "1 hour" } } },
    async (req) => {
      const actor = auth(req),
        b = requestSchema.parse(req.body);
      return tx(async (c) => {
        const u = (
          await c.query(
            "SELECT role,verified,blocked,phone FROM users WHERE id=$1 FOR UPDATE",
            [actor.id],
          )
        ).rows[0];
        if (!u || u.blocked || !u.verified)
          throw new ApiError(403, "Xác minh email trước khi gửi yêu cầu.");
        if (!u.phone)
          throw new ApiError(
            400,
            "Thêm số điện thoại trong Tài khoản để người chủ trì liên hệ.",
          );
        if (
          u.role === "admin" ||
          (
            await c.query(
              "SELECT active FROM learning_access WHERE user_id=$1",
              [actor.id],
            )
          ).rows[0]?.active
        )
          throw new ApiError(409, "Bạn đã có quyền học đầy đủ.");
        const current = (
          await c.query("SELECT status FROM lab_memberships WHERE user_id=$1", [
            actor.id,
          ])
        ).rows[0];
        if (current?.status === "pending") return { ok: true, duplicate: true };
        await c.query(
          `INSERT INTO lab_memberships(user_id,status,tracks,message) VALUES($1,'pending',$2,$3)
        ON CONFLICT(user_id) DO UPDATE SET status='pending',tracks=EXCLUDED.tracks,message=EXCLUDED.message,decision_note='',reviewed_by=NULL,reviewed_at=NULL,updated_at=now(),revision=lab_memberships.revision+1`,
          [actor.id, b.tracks, b.message],
        );
        await auditTx(c, actor.id, "lab.requested", actor.id, {
          tracks: b.tracks,
        });
        return { ok: true, duplicate: false };
      });
    },
  );
  app.get("/api/admin/lab-memberships", async (req) => {
    admin(req);
    const q = z
      .object({
        status: z
          .enum(["all", "pending", "approved", "rejected", "revoked"])
          .default("pending"),
        page: z.coerce.number().int().min(1).max(10000).default(1),
        query: z.string().trim().max(150).default(""),
      })
      .strict()
      .parse(req.query);
    const match = sql`(${q.status}='all' OR m.status=${q.status}) AND (${q.query}='' OR u.name ILIKE ${"%" + q.query + "%"} OR u.email ILIKE ${"%" + q.query + "%"} OR u.phone ILIKE ${"%" + q.query + "%"})`;
    return {
      items: await rows(
        sql`SELECT m.*,u.name,u.email,u.phone,u.verified,u.blocked FROM lab_memberships m JOIN users u ON u.id=m.user_id WHERE ${match} ORDER BY m.updated_at DESC,m.user_id LIMIT 30 OFFSET ${(q.page - 1) * 30}`,
      ),
      total: (await one(
        sql`SELECT count(*)::int AS n FROM lab_memberships m JOIN users u ON u.id=m.user_id WHERE ${match}`,
      ))!.n,
      page: q.page,
    };
  });
  app.patch("/api/admin/lab-memberships/:id", async (req) => {
    const actor = admin(req),
      id = z
        .string()
        .uuid()
        .parse((req.params as any).id);
    const b = z
      .object({
        status: z.enum(["approved", "rejected", "revoked"]),
        revision: z.number().int().positive(),
        note: z.string().trim().min(3).max(1000),
      })
      .strict()
      .parse(req.body);
    return tx(async (c) => {
      const u = (
        await c.query(
          "SELECT role,verified,blocked FROM users WHERE id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      const m = (
        await c.query(
          "SELECT status,revision FROM lab_memberships WHERE user_id=$1 FOR UPDATE",
          [id],
        )
      ).rows[0];
      if (!u || !m)
        throw new ApiError(404, "Không tìm thấy yêu cầu tham gia Lab.");
      if (u.role !== "student")
        throw new ApiError(403, "Không thay đổi quyền của người chủ trì.");
      if (
        m.revision !== b.revision ||
        (b.status === "revoked"
          ? m.status !== "approved"
          : m.status !== "pending")
      )
        throw new ApiError(409, "Yêu cầu đã thay đổi. Tải lại danh sách.");
      if (b.status === "approved" && (!u.verified || u.blocked))
        throw new ApiError(
          409,
          "Chỉ duyệt tài khoản đã xác minh và không bị khóa.",
        );
      await c.query(
        "UPDATE lab_memberships SET status=$2,decision_note=$3,reviewed_by=$4,reviewed_at=now(),updated_at=now(),revision=revision+1 WHERE user_id=$1",
        [id, b.status, b.note, actor.id],
      );
      await auditTx(c, actor.id, "lab." + b.status, id, {
        previousStatus: m.status,
          note: b.note,
        revision: b.revision + 1,
      });
      return { ok: true };
    });
  });
}
