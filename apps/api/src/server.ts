import { practiceRoutes } from "./practice/routes.js";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit, { normalizeIP } from "@fastify/rate-limit";
import { ZodError } from "zod";
import { config, validateConfig } from "./config.js";
import { one, sql, setting } from "./db.js";
import { ApiError, loadActor, equal } from "./security.js";
import { authRoutes } from "./auth.js";
import { courseRoutes } from "./courses.js";
import { paymentRoutes } from "./payments.js";
import { adminRoutes } from "./admin.js";
import { accountRoutes } from "./accounts.js";
import { competitionRoutes } from "./competitions/routes.js";
import { labRoutes } from "./lab.js";
import { fileRoutes } from "./files.js";
import { classroomRoutes } from "./classroom/routes.js";
export async function buildApp() {
  validateConfig();
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "warn",
      redact: [
        "req.headers.cookie",
        "req.headers.authorization",
        "req.body",
        "res.headers.set-cookie",
      ],
    },
    bodyLimit: 150_000,
    requestTimeout: 30000,
    connectionTimeout: 30000,
    keepAliveTimeout: 5000,
    trustProxy: config.trustProxy,
  });
  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
    },
  });
  await app.register(rateLimit, {
    max: 180,
    timeWindow: "1 minute",
    hook: "preHandler",
    // Authenticated learners sharing a classroom connection have separate quotas.
    // Login/register/recovery retain IP-based route limits and database account limits.
    keyGenerator: (req) =>
      req.actor && !(req.method === "POST" && req.url.startsWith("/api/auth/"))
        ? `user:${req.actor.id}`
        : `ip:${normalizeIP(req.ip, 64)}`,
  });
  await app.register(multipart, {
    limits: { fileSize: 25 * 1024 * 1024, files: 1, fields: 2 },
  });
  app.decorateRequest("actor", null);
  app.addHook("onRequest", async (req, reply) => {
    reply.header("Cache-Control", "private, no-store").header("Vary", "Cookie");
    await loadActor(req);
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.url !== "/api/payments/webhook") {
        if (req.headers.origin !== new URL(config.url).origin)
          throw new ApiError(403, "Nguồn yêu cầu không hợp lệ.");
        if (
          req.actor &&
          (!/^[a-f0-9]{64}$/.test(String(req.headers["x-csrf-token"] || "")) ||
            !equal(req.actor.csrf, String(req.headers["x-csrf-token"] || "")))
        )
          throw new ApiError(403, "Phiên xác thực đã thay đổi. Tải lại trang.");
      }
      if (await setting("maintenance"))
        throw new ApiError(
          503,
          "Hệ thống đang bảo trì. Vui lòng quay lại sau.",
        );
    }
  });
  app.setErrorHandler((e, req, reply) => {
    const err = e as any;
    if (e instanceof ZodError)
      return reply.code(400).send({
        error: e.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
      });
    if (err.code === "23505")
      return reply
        .code(409)
        .send({ error: "Dữ liệu trùng lặp; kiểm tra lại thông tin." });
    if (["23503", "23514", "22P02"].includes(err.code))
      return reply
        .code(400)
        .send({ error: "Dữ liệu không hợp lệ hoặc còn được tham chiếu." });
    const status =
      err.statusCode && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500;
    if (status === 500) req.log.error({ err }, "Unhandled API error");
    return reply.code(status).send({
      error: status === 500 ? "Có lỗi xử lý. Vui lòng thử lại." : err.message,
    });
  });
  app.get("/api/health", { config: { rateLimit: false } }, async () => {
    await one(sql`SELECT 1`);
    return { status: "ok", maintenance: await setting("maintenance") };
  });
  await authRoutes(app);
  await courseRoutes(app);
  await paymentRoutes(app);
  await adminRoutes(app);
  await accountRoutes(app);
  await competitionRoutes(app);
  await labRoutes(app);
  await fileRoutes(app);
  await practiceRoutes(app);
  await classroomRoutes(app);
  return app;
}
if (
  process.argv[1]?.endsWith("server.ts") ||
  process.argv[1]?.endsWith("server.js")
) {
  const app = await buildApp();
  await app.listen({ host: config.host, port: config.port });
  console.log(`EP LAB API: http://${config.host}:${config.port}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, async () => {
      await app.close();
      process.exit(0);
    });
}
