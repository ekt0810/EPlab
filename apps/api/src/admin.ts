import type { FastifyInstance } from "fastify";
import { phoneNumber } from "./phone.js";
import { z } from "zod";
import { db, one, rows, sql, tx, audit, setting } from "./db.js";
import { admin, recentAuth, ApiError } from "./security.js";
import { parseVietQR } from "./qr.js";
import { isLabMode } from "./payments.js";
const slug = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9-]+$/);
const course = z
  .object({
    slug,
    category: z.enum(["embedded", "kicad", "solidworks"]),
    title: z.string().min(3).max(180),
    description: z.string().min(5).max(3000),
    level: z.string().max(50),
    status: z.enum(["draft", "published"]),
    position: z.number().int().min(0).max(9999),
  })
  .strict();
const chapter = z
  .object({
    course_id: z.string().uuid(),
    title: z.string().min(3).max(180),
    position: z.number().int().min(0).max(9999),
  })
  .strict();
const safeURL = z
  .string()
  .url()
  .max(2048)
  .refine((s) => {
    const u = new URL(s);
    return u.protocol === "https:" && !u.username && !u.password;
  }, "URL phải dùng HTTPS.");
const lesson = z
  .object({
    chapter_id: z.string().uuid(),
    slug,
    title: z.string().min(3).max(180),
    summary: z.string().max(3000),
    objectives: z.string().max(5000),
    prerequisites: z.string().max(3000),
    level: z
      .enum(["basic", "intermediate", "advanced", "all"])
      .default("basic"),
    listed: z.boolean().default(false),
    audience: z.enum(["student", "host"]).default("student"),
    content: z.string().max(100000),
    exercise: z.string().max(20000),
    answer: z.string().max(20000),
    status: z.enum(["draft", "published"]),
    preview: z.boolean(),
    position: z.number().int().min(0).max(9999),
    duration_minutes: z.number().int().positive().nullable(),
    software_version: z.string().max(200),
    video_url: safeURL.nullable(),
    video_type: z.enum(["youtube", "reference", "none"]),
    author: z.string().min(2).max(180),
    language: z.string().max(80),
    source_url: safeURL.nullable(),
    rights: z.enum(["public_reference", "owned", "licensed", "unverified"]),
    embed_verified: z.boolean(),
  })
  .strict();
const schemas = { courses: course, chapters: chapter, lessons: lesson };
export async function adminRoutes(app: FastifyInstance) {
  app.get("/api/admin/overview", async (req) => {
    admin(req);
    return {
      counts: await one(
        sql`SELECT (SELECT count(*) FROM users WHERE role='student')::int AS students,(SELECT count(*) FROM users WHERE role='admin')::int AS admins,(SELECT count(*) FROM lab_memberships WHERE status='pending')::int AS pending,(SELECT count(*) FROM lessons WHERE status='published')::int AS published,(SELECT count(*) FROM lab_memberships WHERE status='approved')::int AS lab_members`,
      ),
      settings: await setting("billing"),
      maintenance: await setting("maintenance"),
    };
  });
  app.get("/api/admin/users", async (req) => {
    admin(req);
    return rows(
      sql`SELECT u.id,u.email,u.name,u.role,u.admin_slot,u.verified,u.blocked,u.created_at,(u.mfa_secret IS NOT NULL) AS mfa_enabled,COALESCE(e.active,false) AS active FROM users u LEFT JOIN learning_access e ON e.user_id=u.id ORDER BY u.created_at DESC LIMIT 500`,
    );
  });
  app.get("/api/admin/orders", async (req) => {
    admin(req);
    await db.execute(
      sql`UPDATE orders SET status='expired' WHERE status='pending' AND expires_at<now()`,
    );
    return rows(
      sql`SELECT o.*,u.email,u.name FROM orders o JOIN users u ON u.id=o.user_id ORDER BY o.created_at DESC LIMIT 300`,
    );
  });
  app.get("/api/admin/audit", async (req) => {
    admin(req);
    return rows(
      sql`SELECT a.id,a.action,a.target,a.metadata,a.created_at,u.email AS actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 200`,
    );
  });
  app.put("/api/admin/settings", async (req) => {
    const u = recentAuth(req);
    if (await isLabMode())
      throw new ApiError(
        410,
        "Chế độ Lab miễn phí không sử dụng cấu hình thu phí.",
      );
    const b = z
      .object({
        price: z.number().int().min(1000).max(100000000),
        bankName: z.string().max(100),
        accountNumber: z
          .string()
          .max(40)
          .regex(/^[0-9]*$/),
        accountHolder: z.string().max(150),
        enabled: z.boolean(),
        supportEmail: z.union([z.literal(""), z.string().email()]),
        supportPhone: z.union([z.literal(""), phoneNumber]).optional(),
        qrPayload: z.string().max(1000).default(""),
      })
      .strict()
      .parse(req.body);
    if (b.qrPayload) {
      try {
        const qr = parseVietQR(b.qrPayload);
        if (qr.accountNumber !== b.accountNumber || qr.amount)
          throw new Error();
      } catch {
        throw new ApiError(
          400,
          "QR phải hợp lệ, đúng tài khoản và không cố định số tiền.",
        );
      }
    }
    if (b.enabled && (!b.bankName || !b.accountNumber || !b.accountHolder))
      throw new ApiError(400, "Cần đủ thông tin tài khoản nhận tiền.");
    if (b.enabled) {
      const n = await one(
        sql`SELECT count(*)::int AS count FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE l.status='published' AND c.status='published' AND NOT l.preview AND l.rights IN('owned','licensed')`,
      );
      if (!n!.count)
        throw new ApiError(
          400,
          "Cần xuất bản nội dung trả phí thực tế trước khi thu tiền.",
        );
    }
    await db.execute(
      sql`UPDATE settings SET value=value || ${JSON.stringify(b)}::jsonb WHERE key='billing'`,
    );
    await audit(u.id, "settings.billing", null, {
      price: b.price,
      enabled: b.enabled,
      bankChanged: true,
    });
    return { ok: true };
  });
  for (const kind of ["courses", "chapters", "lessons"] as const) {
    app.get(`/api/admin/${kind}`, async (req) => {
      admin(req);
      return rows(
        sql`SELECT * FROM ${sql.identifier(kind)} ORDER BY position,id`,
      );
    });
    const write = async (req: any, create: boolean) => {
      const u = admin(req);
      const body = schemas[kind].parse(req.body) as Record<string, any>;
      if (kind === "lessons") {
        const parent = await one(
          sql`SELECT c.category FROM chapters ch JOIN courses c ON c.id=ch.course_id WHERE ch.id=${body.chapter_id}`,
        );
        if (
          parent?.category === "solidworks" &&
          (body.video_url || body.video_type !== "none")
        )
          throw new ApiError(
            400,
            "SOLIDWORKS học theo giáo trình và giảng viên hướng dẫn, không dùng video.",
          );
        if (
          body.status === "published" &&
          (body.rights === "unverified" || !body.content.trim())
        )
          throw new ApiError(
            400,
            "Cần nội dung thật và quyền sử dụng trước khi xuất bản.",
          );
        if (
          !body.preview &&
          body.video_url &&
          ["youtube", "reference"].includes(body.video_type)
        )
          throw new ApiError(
            400,
            "Video công khai chỉ dùng trong bài học thử/tham khảo.",
          );
        if (body.video_type === "youtube" && body.video_url) {
          const u = new URL(body.video_url);
          if (
            !["www.youtube.com", "youtube.com", "youtu.be"].includes(u.hostname)
          )
            throw new ApiError(400, "Nguồn YouTube không hợp lệ.");
          if (!body.embed_verified)
            throw new ApiError(
              400,
              "Hãy kiểm tra nhúng video trước khi xuất bản dạng trình phát.",
            );
        }
      }
      const entries = Object.entries(body);
      const id = create ? null : z.string().uuid().parse(req.params.id);
      const q = create
        ? sql`INSERT INTO ${sql.identifier(kind)} (${sql.join(
            entries.map(([k]) => sql.identifier(k)),
            sql`,`,
          )}) VALUES (${sql.join(
            entries.map(([, v]) => sql`${v}`),
            sql`,`,
          )}) RETURNING id`
        : sql`UPDATE ${sql.identifier(kind)} SET ${sql.join(
            entries.map(([k, v]) => sql`${sql.identifier(k)}=${v}`),
            sql`,`,
          )} WHERE id=${id} RETURNING id`;
      const result = await one(q);
      if (!result) throw new ApiError(404, "Không tìm thấy nội dung.");
      await audit(u.id, `${kind}.${create ? "created" : "updated"}`, result.id);
      return result;
    };
    app.post(`/api/admin/${kind}`, async (req) => write(req, true));
    app.put(`/api/admin/${kind}/:id`, async (req) => write(req, false));
    app.delete(`/api/admin/${kind}/:id`, async (req) => {
      const u = admin(req),
        id = z
          .string()
          .uuid()
          .parse((req.params as any).id);
      if (kind === "chapters") {
        const n = await one(
          sql`SELECT count(*)::int AS n FROM lessons WHERE chapter_id=${id}`,
        );
        if (n!.n)
          throw new ApiError(
            409,
            "Chương còn bài học. Chuyển hoặc xóa bài trước.",
          );
      }
      if (kind === "courses") {
        const n = await one(
          sql`SELECT count(*)::int AS n FROM chapters WHERE course_id=${id}`,
        );
        if (n!.n)
          throw new ApiError(
            409,
            "Khóa còn chương. Chuyển hoặc xóa chương trước.",
          );
      }
      if (kind === "lessons") {
        const n = await one(
          sql`SELECT count(*)::int AS n FROM resources WHERE lesson_id=${id}`,
        );
        if (n!.n)
          throw new ApiError(409, "Bài còn tài liệu. Xóa tài liệu trước.");
      }
      await db.execute(sql`DELETE FROM ${sql.identifier(kind)} WHERE id=${id}`);
      await audit(u.id, `${kind}.deleted`, id);
      return { ok: true };
    });
  }
}
