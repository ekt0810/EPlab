import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { db, rows, one, sql, tx, audit, auditTx, setting } from "./db.js";
import { ApiError, auth, admin, recentAuth } from "./security.js";
import { qrImage } from "./qr.js";
export interface VerifiedPayment {
  reference: string;
  orderCode: string;
  amount: number;
  accountNumber: string;
  direction: "credit";
}
export interface PaymentAdapter {
  name: string;
  verify(
    rawBody: Buffer,
    headers: Record<string, string>,
  ): Promise<VerifiedPayment>;
}
export async function isLabMode() {
  return (await setting("access_mode")) !== "paid";
}
export async function billing() {
  const b = await setting("billing");
  const count = await one(
    sql`SELECT count(*)::int AS count FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE l.status='published' AND c.status='published' AND NOT l.preview AND l.rights IN('owned','licensed')`,
  );
  const lab = await isLabMode();
  const ready =
    !lab &&
    !!(
      b.enabled &&
      b.bankName &&
      b.accountNumber &&
      b.accountHolder &&
      count!.count > 0
    );
  return {
    ...b,
    price: lab ? 0 : b.price,
    mode: lab ? "lab" : "paid",
    ready,
    premiumCount: count!.count,
  };
}
export async function approvePayment(
  orderId: string,
  p: Omit<VerifiedPayment, "orderCode" | "direction">,
  actor: string,
  note: string,
) {
  if (await isLabMode())
    throw new ApiError(
      410,
      "EP LAB đã chuyển sang duyệt tham gia Lab miễn phí.",
    );
  return tx(async (c) => {
    const o = (
      await c.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [orderId])
    ).rows[0];
    if (!o) throw new ApiError(404, "Không tìm thấy đơn.");
    const existing = (
      await c.query("SELECT * FROM payment_transactions WHERE reference=$1", [
        p.reference,
      ])
    ).rows[0];
    if (existing) {
      if (existing.order_id === o.id && existing.amount === p.amount)
        return { ok: true, duplicate: true };
      throw new ApiError(409, "Mã giao dịch đã được dùng cho đơn khác.");
    }
    if (o.status !== "pending" || new Date(o.expires_at).getTime() < Date.now())
      throw new ApiError(
        409,
        "Đơn không còn hiệu lực. Cần đối soát thủ công, không tự kích hoạt.",
      );
    if (
      o.amount !== p.amount ||
      o.bank_snapshot.accountNumber !== p.accountNumber
    )
      throw new ApiError(
        409,
        "Số tiền hoặc tài khoản nhận không khớp. Giữ đơn để đối soát.",
      );
    const u = (
      await c.query("SELECT blocked FROM users WHERE id=$1 FOR UPDATE", [
        o.user_id,
      ])
    ).rows[0];
    if (u.blocked) throw new ApiError(409, "Tài khoản đang bị khóa.");
    await c.query(
      "INSERT INTO payment_transactions(order_id,reference,amount,verified_by,source,note) VALUES($1,$2,$3,$4,'manual',$5)",
      [o.id, p.reference, p.amount, actor, note],
    );
    await c.query("UPDATE orders SET status='paid',paid_at=now() WHERE id=$1", [
      o.id,
    ]);
    await c.query(
      "INSERT INTO entitlements(user_id,order_id) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET active=true,order_id=EXCLUDED.order_id,granted_at=now()",
      [o.user_id, o.id],
    );
    await c.query(
      "INSERT INTO audit_logs(actor_id,action,target,metadata) VALUES($1,'payment.approved',$2,$3)",
      [
        actor,
        o.id,
        JSON.stringify({ reference: p.reference, amount: p.amount }),
      ],
    );
    return { ok: true, duplicate: false };
  });
}
export async function createOrder(userId: string, actorId: string) {
  if (await isLabMode())
    throw new ApiError(
      410,
      "Không còn thu phí. Gửi yêu cầu tham gia Lab để được cấp quyền học.",
    );
  const b = await billing();
  if (!b.ready)
    throw new ApiError(
      503,
      "Chưa cấu hình thanh toán. Hiện có thể học thử miễn phí.",
    );
  return tx(async (c) => {
    const u = (
      await c.query("SELECT role,blocked FROM users WHERE id=$1 FOR UPDATE", [
        userId,
      ])
    ).rows[0];
    if (!u) throw new ApiError(404, "Không tìm thấy tài khoản.");
    if (u.blocked) throw new ApiError(409, "Tài khoản đang bị khóa.");
    if (
      u.role === "admin" ||
      (
        await c.query("SELECT active FROM entitlements WHERE user_id=$1", [
          userId,
        ])
      ).rows[0]?.active
    )
      throw new ApiError(
        409,
        "Tài khoản đã có quyền học, không cần thanh toán.",
      );
    await c.query(
      "UPDATE orders SET status='expired' WHERE user_id=$1 AND status='pending' AND expires_at<now()",
      [userId],
    );
    const pending = (
      await c.query(
        "SELECT * FROM orders WHERE user_id=$1 AND status='pending'",
        [userId],
      )
    ).rows[0];
    if (pending) return pending;
    const order = (
      await c.query(
        "INSERT INTO orders(user_id,code,amount,bank_snapshot,expires_at) VALUES($1,$2,$3,$4,now()+interval '24 hours') RETURNING *",
        [
          userId,
          "EP" + randomBytes(7).toString("hex").toUpperCase(),
          b.price,
          JSON.stringify({
            bankName: b.bankName,
            accountNumber: b.accountNumber,
            accountHolder: b.accountHolder,
            qrPayload: b.qrPayload || "",
          }),
        ],
      )
    ).rows[0];
    await auditTx(c, actorId, "order.created", order.id, {
      amount: order.amount,
      code: order.code,
    });
    return order;
  });
}
export async function paymentRoutes(app: FastifyInstance) {
  app.get("/api/billing", async () => {
    const b = await billing();
    return {
      price: b.price,
      mode: b.mode,
      ready: b.ready,
      supportEmail: b.supportEmail,
      supportPhone: b.supportPhone || "",
      premiumCount: b.premiumCount,
    };
  });
  app.post(
    "/api/orders",
    { config: { rateLimit: { max: 6, timeWindow: "15 minutes" } } },
    async (req) => {
      z.object({})
        .strict()
        .parse(req.body || {});
      const u = auth(req);
      if (!u.verified) throw new ApiError(403, "Cần xác minh email.");
      if (u.role === "admin" || u.active)
        throw new ApiError(
          409,
          "Tài khoản đã có quyền học, không cần thanh toán.",
        );
      return createOrder(u.id, u.id);
    },
  );
  app.get("/api/orders", async (req) => {
    const u = auth(req);
    await db.execute(
      sql`UPDATE orders SET status='expired' WHERE user_id=${u.id} AND status='pending' AND expires_at<now()`,
    );
    return rows(
      sql`SELECT * FROM orders WHERE user_id=${u.id} ORDER BY created_at DESC LIMIT 100`,
    );
  });
  app.get("/api/orders/:id", async (req) => {
    const u = auth(req),
      id = z
        .string()
        .uuid()
        .parse((req.params as any).id);
    const o = await one(
      sql`SELECT * FROM orders WHERE id=${id} AND user_id=${u.id}`,
    );
    if (!o) throw new ApiError(404, "Không tìm thấy đơn.");
    return o;
  });
  app.get("/api/orders/:id/qr", async (req) => {
    auth(req);
    if (await isLabMode())
      throw new ApiError(410, "Đã ngừng thu phí tham gia Lab.");
    const u = auth(req),
      id = z
        .string()
        .uuid()
        .parse((req.params as any).id);
    const o = await one(
      sql`SELECT bank_snapshot FROM orders WHERE id=${id} AND user_id=${u.id}`,
    );
    if (!o?.bank_snapshot.qrPayload)
      throw new ApiError(404, "QR chưa được cấu hình.");
    return {
      image: await qrImage(
        o.bank_snapshot.qrPayload,
        o.bank_snapshot.accountNumber,
      ),
      static: true,
    };
  });
  app.post("/api/orders/:id/report", async (req) => {
    auth(req);
    if (await isLabMode())
      throw new ApiError(410, "Đã ngừng thu phí tham gia Lab.");
    const u = auth(req),
      id = z
        .string()
        .uuid()
        .parse((req.params as any).id);
    const o = await one(
      sql`UPDATE orders SET reported_at=now() WHERE id=${id} AND user_id=${u.id} AND status='pending' RETURNING id`,
    );
    if (!o) throw new ApiError(404, "Không tìm thấy đơn đang chờ.");
    await audit(u.id, "order.reported", id);
    return {
      message:
        "Đã gửi yêu cầu đối soát. Quyền học chỉ mở sau khi xác minh tiền thực nhận.",
    };
  });
  app.post("/api/orders/:id/cancel", async (req) => {
    const u = auth(req),
      id = z
        .string()
        .uuid()
        .parse((req.params as any).id);
    const o = await one(
      sql`UPDATE orders SET status='cancelled' WHERE id=${id} AND user_id=${u.id} AND status='pending' AND reported_at IS NULL RETURNING id`,
    );
    if (!o)
      throw new ApiError(
        409,
        "Đơn đã chuyển trạng thái hoặc đang được đối soát.",
      );
    await audit(u.id, "order.cancelled", id);
    return { ok: true };
  });
  // No provider selected: never accept an unauthenticated or simulated bank event.
  app.post("/api/payments/webhook", async () => {
    throw new ApiError(503, "Chưa cấu hình nhà cung cấp đối soát.");
  });
  app.post("/api/admin/orders/:id/approve", async (req) => {
    const u = admin(req),
      id = z
        .string()
        .uuid()
        .parse((req.params as any).id);
    const b = z
      .object({
        reference: z.string().trim().min(5).max(100),
        amount: z.number().int().positive(),
        accountNumber: z.string().min(3).max(40),
        note: z.string().min(5).max(1000),
        confirmed: z.literal(true),
      })
      .strict()
      .parse(req.body);
    return approvePayment(id, b, u.id, b.note);
  });
  app.post("/api/admin/orders/:id/refund", async (req) => {
    const u = recentAuth(req),
      id = z
        .string()
        .uuid()
        .parse((req.params as any).id);
    const b = z
      .object({
        reference: z.string().min(5).max(100),
        note: z.string().min(5).max(1000),
        confirmed: z.literal(true),
      })
      .strict()
      .parse(req.body);
    await tx(async (c) => {
      const o = (
        await c.query("SELECT * FROM orders WHERE id=$1 FOR UPDATE", [id])
      ).rows[0];
      if (!o || o.status !== "paid")
        throw new ApiError(
          409,
          "Chỉ ghi nhận hoàn tiền cho đơn đã thanh toán.",
        );
      await c.query(
        "UPDATE payment_transactions SET refunded_at=now(),refund_reference=$2 WHERE order_id=$1",
        [id, b.reference],
      );
      await c.query("UPDATE orders SET status='refunded' WHERE id=$1", [id]);
      await c.query("UPDATE entitlements SET active=false WHERE order_id=$1", [
        id,
      ]);
      await c.query("DELETE FROM sessions WHERE user_id=$1", [o.user_id]);
      await c.query(
        "INSERT INTO audit_logs(actor_id,action,target,metadata) VALUES($1,'payment.refunded',$2,$3)",
        [u.id, id, JSON.stringify(b)],
      );
    });
    return { ok: true };
  });
}
