import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { one, rows, sql, tx, audit, auditTx } from "./db.js";
import { admin, ApiError, token } from "./security.js";
import { hashPassword } from "./auth.js";
import { sendToken } from "./mail.js";
import { createOrder } from "./payments.js";
import { phoneNumber } from "./phone.js";

const userId = (req: any) => z.string().uuid().parse(req.params.id);
const reason = z
  .string()
  .trim()
  .min(5, "Ghi rõ lý do (ít nhất 5 ký tự).")
  .max(1000);
const paging = {
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
};
const visibleUser = sql`u.id,u.email,u.phone,u.name,u.role,u.admin_slot,u.verified,u.blocked,u.setup_pending,u.created_at,u.last_login_at,u.invited_at,(u.mfa_secret IS NOT NULL) AS mfa_enabled,COALESCE(e.active,false) AS active,e.granted_at`;
async function student(id: string) {
  const u = await one(
    sql`SELECT id,email,role,blocked,verified,setup_pending FROM users WHERE id=${id}`,
  );
  if (!u) throw new ApiError(404, "Không tìm thấy tài khoản.");
  if (u.role !== "student")
    throw new ApiError(
      403,
      "Hai tài khoản chủ trì được quản lý riêng; không thay đổi tại đây.",
    );
  return u;
}
async function deliver(
  id: string,
  email: string,
  purpose: "invite" | "verify" | "reset",
  actor: string,
) {
  try {
    await sendToken(id, email, purpose);
  } catch {
    await audit(actor, "user.email_failed", id, { purpose });
    return false;
  }
  await tx(async (c) => {
    if (purpose === "invite")
      await c.query("UPDATE users SET invited_at=now() WHERE id=$1", [id]);
    await auditTx(c, actor, `user.${purpose}_sent`, id);
  });
  return true;
}
export async function accountRoutes(app: FastifyInstance) {
  app.get("/api/admin/accounts", async (req) => {
    admin(req);
    const q = z
      .object({
        ...paging,
        q: z.string().trim().max(200).default(""),
        role: z.enum(["all", "student", "admin"]).default("all"),
        state: z
          .enum(["all", "invited", "unverified", "unpaid", "active", "blocked"])
          .default("all"),
      })
      .strict()
      .parse(req.query);
    const states = {
      all: sql`true`,
      invited: sql`u.setup_pending AND u.role='student' AND NOT u.blocked`,
      unverified: sql`NOT u.verified AND NOT u.setup_pending AND NOT u.blocked`,
      unpaid: sql`u.role='student' AND NOT COALESCE(e.active,false) AND NOT u.blocked`,
      active: sql`NOT u.blocked AND u.verified AND (u.role='admin' OR COALESCE(e.active,false))`,
      blocked: sql`u.blocked`,
    };
    const searchedPhone = phoneNumber.safeParse(q.q);
    const where = sql`(${q.q}='' OR position(lower(${q.q}) in lower(u.email || ' ' || u.name || ' ' || COALESCE(u.phone,'')))>0 OR u.phone=${searchedPhone.success ? searchedPhone.data : null}) AND (${q.role}='all' OR u.role=${q.role}) AND ${states[q.state]}`;
    const total = await one(
      sql`SELECT count(*)::int AS total FROM users u LEFT JOIN learning_access e ON e.user_id=u.id WHERE ${where}`,
    );
    const items = await rows(
      sql`SELECT ${visibleUser} FROM users u LEFT JOIN learning_access e ON e.user_id=u.id WHERE ${where} ORDER BY u.created_at DESC,u.id LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    );
    return { items, total: total!.total, page: q.page, limit: q.limit };
  });
  app.post(
    "/api/admin/accounts",
    { config: { rateLimit: { max: 15, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const actor = admin(req);
      const b = z
        .object({
          name: z.string().trim().min(2).max(80),
          email: z
            .string()
            .trim()
            .email()
            .max(254)
            .transform((s) => s.toLowerCase()),
          note: reason,
          phone: phoneNumber,
        })
        .strict()
        .parse(req.body);
      const passwordHash = await hashPassword(token());
      const u = await tx(async (c) => {
        const created = (
          await c.query(
            "INSERT INTO users(email,name,password_hash,setup_pending,phone) VALUES($1,$2,$3,true,$4) ON CONFLICT(email) DO NOTHING RETURNING id,email",
            [b.email, b.name, passwordHash, b.phone],
          )
        ).rows[0];
        if (!created)
          throw new ApiError(
            409,
            "Email đã có tài khoản. Tìm tài khoản hiện có để tiếp tục quản lý.",
          );
        await auditTx(c, actor.id, "user.created", created.id, {
          note: b.note,
        });
        return created;
      });
      const sent = await deliver(u.id, u.email, "invite", actor.id);
      return reply.code(201).send({
        id: u.id,
        invitationSent: sent,
        message: sent
          ? "Đã tạo hồ sơ và gửi thư mời. Người tham gia tự đặt mật khẩu rồi gửi yêu cầu tham gia Lab để được xét duyệt quyền học đầy đủ."
          : "Đã tạo hồ sơ nhưng chưa gửi được thư mời. Dùng nút gửi lại trong hồ sơ tài khoản.",
      });
    },
  );
  app.get("/api/admin/accounts/:id", async (req) => {
    admin(req);
    const id = userId(req);
    const u = await one(
      sql`SELECT ${visibleUser} FROM users u LEFT JOIN learning_access e ON e.user_id=u.id WHERE u.id=${id}`,
    );
    if (!u) throw new ApiError(404, "Không tìm thấy tài khoản.");
    const [orders, progress, sessions, submissions, creator] =
      await Promise.all([
        rows(
          sql`SELECT o.*,p.reference,p.verified_by,p.note AS verification_note,p.refunded_at FROM orders o LEFT JOIN payment_transactions p ON p.order_id=o.id WHERE o.user_id=${id} ORDER BY o.created_at DESC LIMIT 100`,
        ),
        rows(
          sql`SELECT c.id,c.title,c.category,count(p.lesson_id)::int AS started,count(p.lesson_id) FILTER(WHERE p.completed)::int AS completed,max(p.updated_at) AS last_activity FROM courses c LEFT JOIN chapters ch ON ch.course_id=c.id LEFT JOIN lessons l ON l.chapter_id=ch.id LEFT JOIN progress p ON p.lesson_id=l.id AND p.user_id=${id} GROUP BY c.id ORDER BY c.position`,
        ),
        rows(
          sql`SELECT user_agent,created_at,expires_at FROM sessions WHERE user_id=${id} AND expires_at>now() ORDER BY created_at DESC`,
        ),
        one(
          sql`SELECT count(*)::int AS total,count(*) FILTER(WHERE status IN('pending_manual','needs_review'))::int AS pending FROM submissions WHERE user_id=${id}`,
        ),
        one(
          sql`SELECT u.name,u.email FROM audit_logs a JOIN users u ON u.id=a.actor_id WHERE a.action='user.created' AND a.target=${id} ORDER BY a.id LIMIT 1`,
        ),
      ]);
    return {
      user: u,
      orders,
      progress,
      sessions,
      submissions,
      creator: creator || null,
    };
  });
  app.get("/api/admin/accounts/:id/history", async (req) => {
    admin(req);
    const id = userId(req);
    if (!(await one(sql`SELECT id FROM users WHERE id=${id}`)))
      throw new ApiError(404, "Không tìm thấy tài khoản.");
    const q = z
      .object({
        ...paging,
        kind: z
          .enum(["all", "account", "login", "payment", "lab"])
          .default("all"),
      })
      .strict()
      .parse(req.query);
    const filter = {
      all: sql`true`,
      account: sql`a.action LIKE 'user.%' OR a.action LIKE 'mfa.%'`,
      login: sql`a.action IN('login','login.failed','logout','sessions.revoked','session.revoked','session.renewed')`,
      payment: sql`a.action LIKE 'payment.%' OR a.action LIKE 'order.%'`,
      lab: sql`a.action LIKE 'lab.%'`,
    }[q.kind];
    const related = sql`(a.actor_id=${id} OR a.target=${id} OR a.target IN(SELECT id::text FROM orders WHERE user_id=${id})) AND (${filter})`;
    const total = await one(
      sql`SELECT count(*)::int AS n FROM audit_logs a WHERE ${related}`,
    );
    const items = await rows(
      sql`SELECT a.id,a.action,a.target,a.metadata,a.created_at,u.name AS actor_name,u.email AS actor_email FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id WHERE ${related} ORDER BY a.id DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
    );
    return { items, total: total!.n, page: q.page, limit: q.limit };
  });
  app.post(
    "/api/admin/accounts/:id/email",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (req) => {
      const actor = admin(req),
        id = userId(req),
        b = z
          .object({ purpose: z.enum(["invite", "verify", "reset"]) })
          .strict()
          .parse(req.body),
        u = await student(id);
      if (u.blocked)
        throw new ApiError(409, "Mở khóa tài khoản trước khi gửi thư.");
      if (
        (b.purpose === "invite" && !u.setup_pending) ||
        (b.purpose !== "invite" && u.setup_pending) ||
        (b.purpose === "verify" && u.verified)
      )
        throw new ApiError(
          409,
          "Trạng thái tài khoản đã thay đổi. Tải lại hồ sơ và chọn thao tác phù hợp.",
        );
      if (!(await deliver(id, u.email, b.purpose, actor.id)))
        throw new ApiError(
          503,
          "Chưa gửi được email. Kiểm tra cấu hình gửi thư rồi thử lại.",
        );
      return {
        message: "Đã gửi email. Liên kết dùng một lần và hết hạn sau 30 phút.",
      };
    },
  );
  app.patch("/api/admin/users/:id", async (req) => {
    const actor = admin(req),
      id = userId(req),
      b = z
        .object({
          blocked: z.boolean(),
          reason: reason.default("Cập nhật trạng thái từ trang quản trị."),
        })
        .strict()
        .parse(req.body);
    await tx(async (c) => {
      const u = (
        await c.query("SELECT role,blocked FROM users WHERE id=$1 FOR UPDATE", [
          id,
        ])
      ).rows[0];
      if (!u) throw new ApiError(404, "Không tìm thấy tài khoản.");
      if (u.role === "admin")
        throw new ApiError(
          403,
          "Không thể khóa người chủ trì qua danh sách người tham gia.",
        );
      if (u.blocked === b.blocked) return;
      await c.query("UPDATE users SET blocked=$2 WHERE id=$1", [id, b.blocked]);
      const sessions = await c.query("DELETE FROM sessions WHERE user_id=$1", [
        id,
      ]);
      await auditTx(
        c,
        actor.id,
        b.blocked ? "user.blocked" : "user.unblocked",
        id,
        { reason: b.reason, sessions: sessions.rowCount },
      );
    });
    return {
      message: "Đã cập nhật trạng thái tài khoản và thu hồi các phiên cũ.",
    };
  });
  app.post("/api/admin/accounts/:id/revoke-sessions", async (req) => {
    const actor = admin(req),
      id = userId(req),
      b = z.object({ reason }).strict().parse(req.body);
    await student(id);
    await tx(async (c) => {
      await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [id]);
      const deleted = await c.query("DELETE FROM sessions WHERE user_id=$1", [
        id,
      ]);
      await auditTx(c, actor.id, "sessions.revoked", id, {
        reason: b.reason,
        count: deleted.rowCount,
      });
    });
    return { message: "Đã đăng xuất tài khoản khỏi các phiên hiện có." };
  });
  app.post("/api/admin/accounts/:id/notes", async (req) => {
    const actor = admin(req),
      id = userId(req),
      b = z.object({ note: reason }).strict().parse(req.body);
    if (!(await one(sql`SELECT id FROM users WHERE id=${id}`)))
      throw new ApiError(404, "Không tìm thấy tài khoản.");
    await audit(actor.id, "user.note", id, { note: b.note });
    return { message: "Đã lưu ghi chú vào lịch sử tài khoản." };
  });
  app.post("/api/admin/accounts/:id/orders", async (req) => {
    const actor = admin(req),
      id = userId(req);
    z.object({})
      .strict()
      .parse(req.body || {});
    await student(id);
    return createOrder(id, actor.id);
  });
}
