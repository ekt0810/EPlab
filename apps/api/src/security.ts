import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "node:crypto";
import type { FastifyRequest } from "fastify";
import { config } from "./config.js";
import { one, sql, db } from "./db.js";
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
export const token = () => randomBytes(32).toString("hex");
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const equal = (a: string, b: string) => {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
export function encrypt(value: string) {
  const iv = randomBytes(12);
  const c = createCipheriv(
    "aes-256-gcm",
    Buffer.from(config.secret, "hex"),
    iv,
  );
  const body = Buffer.concat([c.update(value, "utf8"), c.final()]);
  return [
    iv.toString("hex"),
    body.toString("hex"),
    c.getAuthTag().toString("hex"),
  ].join(".");
}
export function decrypt(value: string) {
  const [iv, body, tag] = value.split(".");
  const d = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(config.secret, "hex"),
    Buffer.from(iv, "hex"),
  );
  d.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([
    d.update(Buffer.from(body, "hex")),
    d.final(),
  ]).toString("utf8");
}
export type Actor = {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  role: string;
  verified: boolean;
  blocked: boolean;
  mfa_enabled: boolean;
  active: boolean;
  session_id: string;
  csrf: string;
  mfa_verified: boolean;
  reauth_at: string | null;
};
declare module "fastify" {
  interface FastifyRequest {
    actor: Actor | null;
  }
}
export async function loadActor(req: FastifyRequest) {
  req.actor = null;
  const sid = req.cookies.ep_session;
  if (!sid || !/^[a-f0-9]{64}$/.test(sid)) return;
  const user = await one(
    sql`SELECT u.id,u.email,u.phone,u.name,u.role,u.verified,u.blocked,(u.mfa_secret IS NOT NULL) AS mfa_enabled,COALESCE(e.active,false) AS active,s.id AS session_id,s.csrf,s.mfa_verified,s.reauth_at FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN learning_access e ON e.user_id=u.id WHERE s.id=${hash(sid)} AND s.expires_at>now() AND NOT u.blocked`,
  );
  if (user) req.actor = user as Actor;
}
// Optional authentication on public pages must never attach private data
// before the account's second factor has been completed.
export function personalActor(req: FastifyRequest) {
  const u = req.actor;
  return u && u.verified && !u.blocked && (!u.mfa_enabled || u.mfa_verified)
    ? u
    : null;
}
export function auth(req: FastifyRequest, allowMfaPending = false) {
  if (!req.actor) throw new ApiError(401, "Bạn cần đăng nhập.");
  if (!allowMfaPending && req.actor.mfa_enabled && !req.actor.mfa_verified)
    throw new ApiError(403, "Bạn cần xác thực hai bước.");
  return req.actor;
}
export function admin(req: FastifyRequest) {
  const u = auth(req);
  if (!hasAdminAccess(u))
    throw new ApiError(403, "Bạn không có quyền quản trị.");
  return u;
}
export function recentAuth(req: FastifyRequest) {
  const u = admin(req);
  if (!u.reauth_at || Date.now() - new Date(u.reauth_at).getTime() > 5 * 60_000)
    throw new ApiError(
      403,
      "Vui lòng xác thực lại mật khẩu trước thao tác này.",
    );
  return u;
}
export function canLearn(
  u: Actor | null,
  lesson: {
    status: string;
    preview: boolean;
    course_status?: string;
    audience?: string;
  },
) {
  const mfaOk = !u?.mfa_enabled || u.mfa_verified;
  return u?.role === "admin"
    ? hasAdminAccess(u)
    : lesson.audience !== "host" &&
        lesson.status === "published" &&
        (!lesson.course_status || lesson.course_status === "published") &&
        (lesson.preview || Boolean(u?.verified && u.active && mfaOk));
}
export function hasAdminAccess(u: Actor | null) {
  return Boolean(
    u?.role === "admin" &&
    u.verified &&
    !u.blocked &&
    (!u.mfa_enabled || u.mfa_verified),
  );
}
export function publicUser(u: Actor) {
  return {
    id: u.id,
    email: u.email,
    phone: u.phone,
    name: u.name,
    role: u.role,
    verified: u.verified,
    active: u.role === "admin" || u.active,
    mfaEnabled: u.mfa_enabled,
    mfaVerified: u.mfa_verified,
  };
}
export async function countLogin(email: string) {
  const k = hash(email.toLowerCase());
  const item = await one(
    sql`INSERT INTO login_limits(key,attempts) VALUES(${k},1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN login_limits.window_start < now()-interval '15 minutes' THEN 1 ELSE login_limits.attempts+1 END, window_start=CASE WHEN login_limits.window_start < now()-interval '15 minutes' THEN now() ELSE login_limits.window_start END RETURNING attempts`,
  );
  if (item!.attempts > 10) throw new ApiError(429, "Thử lại sau 15 phút.");
}
export async function clearLogin(email: string) {
  await db.execute(sql`DELETE FROM login_limits WHERE key=${hash(email)}`);
}
// Separate from login lockout: email abuse must not lock the victim out.
export async function reserveAccountEmail(email: string) {
  const key = hash("account-email:" + email.toLowerCase().trim());
  const item =
    await one(sql`INSERT INTO login_limits(key,attempts) VALUES(${key},1)
    ON CONFLICT(key) DO UPDATE SET
      attempts=CASE WHEN login_limits.window_start < now()-interval '15 minutes' THEN 1 ELSE LEAST(login_limits.attempts+1,4) END,
      window_start=CASE WHEN login_limits.window_start < now()-interval '15 minutes' THEN now() ELSE login_limits.window_start END
    RETURNING attempts`);
  return item!.attempts <= 3;
}
