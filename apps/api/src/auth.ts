import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PoolClient } from "pg";
import argon2 from "argon2";
import { z } from "zod";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { config } from "./config.js";
import { db, one, rows, sql, tx, audit, auditTx } from "./db.js";
import {
  ApiError,
  auth,
  token,
  hash,
  encrypt,
  decrypt,
  publicUser,
  countLogin,
  clearLogin,
  reserveAccountEmail,
} from "./security.js";
import { sendToken } from "./mail.js";
import { phoneNumber } from "./phone.js";
const email = z
  .string()
  .email()
  .max(254)
  .transform((s) => s.toLowerCase().trim());
const password = z.string().min(8, "Mật khẩu cần ít nhất 8 ký tự.").max(128);
const hashPassword = (v: string) =>
  argon2.hash(v, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
export { hashPassword };
async function consumeToken(
  c: PoolClient,
  raw: string,
  purpose: "verify" | "reset",
) {
  const t = (
    await c.query(
      "SELECT user_id FROM tokens WHERE hash=$1 AND purpose=$2 AND expires_at>now()",
      [hash(raw), purpose],
    )
  ).rows[0];
  if (!t) throw new ApiError(400, "Liên kết không hợp lệ hoặc đã hết hạn.");
  await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [t.user_id]);
  const consumed = (
    await c.query(
      "DELETE FROM tokens WHERE hash=$1 AND purpose=$2 AND expires_at>now() RETURNING user_id",
      [hash(raw), purpose],
    )
  ).rows[0];
  if (!consumed)
    throw new ApiError(400, "Liên kết không hợp lệ hoặc đã hết hạn.");
  return consumed;
}
export async function createSession(
  id: string,
  req: FastifyRequest,
  reply: FastifyReply,
  mfa = false,
  client?: PoolClient,
) {
  const raw = token(),
    csrf = token();
  const insert = async (c: PoolClient) => {
    await c.query(
      "INSERT INTO sessions(id,user_id,csrf,mfa_verified,user_agent,expires_at) VALUES($1,$2,$3,$4,$5,now()+interval '7 days')",
      [
        hash(raw),
        id,
        csrf,
        mfa,
        (req.headers["user-agent"] || "").slice(0, 300),
      ],
    );
    // Bound sessions per account while keeping separate devices signed in.
    await c.query(
      "DELETE FROM sessions WHERE user_id=$1 AND (expires_at<=now() OR id IN (SELECT id FROM sessions WHERE user_id=$1 ORDER BY created_at DESC,id DESC OFFSET 10))",
      [id],
    );
  };
  if (client) await insert(client);
  else await tx(insert);
  reply.setCookie("ep_session", raw, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: config.url.startsWith("https://"),
    maxAge: 604800,
  });
  return csrf;
}
function totp(secret: string, email: string) {
  return new OTPAuth.TOTP({
    issuer: "EP LAB",
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}
async function verifyMfa(userId: string, code: string, client?: PoolClient) {
  const verify = async (c: PoolClient) => {
    const u = (
      await c.query("SELECT * FROM users WHERE id=$1 FOR UPDATE", [userId])
    ).rows[0];
    if (!u?.mfa_secret) return false;
    const delta = totp(decrypt(u.mfa_secret), u.email).validate({
      token: code,
      window: 1,
    });
    if (delta !== null) {
      const step = Math.floor(Date.now() / 30000) + delta;
      if (u.mfa_last_step && step <= Number(u.mfa_last_step)) return false;
      await c.query("UPDATE users SET mfa_last_step=$2 WHERE id=$1", [
        userId,
        step,
      ]);
      return true;
    }
    const hashes: string[] = u.recovery_hashes;
    if (hashes.includes(hash(code))) {
      await c.query("UPDATE users SET recovery_hashes=$2 WHERE id=$1", [
        userId,
        JSON.stringify(hashes.filter((x) => x !== hash(code))),
      ]);
      return true;
    }
    return false;
  };
  return client ? verify(client) : tx(verify);
}
async function renewSession(
  c: PoolClient,
  req: FastifyRequest,
  reply: FastifyReply,
  mfa: boolean,
  reauth = false,
) {
  const u = req.actor!;
  const current = (
    await c.query(
      "SELECT u.blocked FROM users u JOIN sessions s ON s.user_id=u.id WHERE u.id=$1 AND s.id=$2 AND s.expires_at>now() FOR UPDATE OF u",
      [u.id, u.session_id],
    )
  ).rows[0];
  if (!current || current.blocked)
    throw new ApiError(401, "Phiên đăng nhập đã hết hiệu lực.");
  await c.query("DELETE FROM sessions WHERE id=$1", [u.session_id]);
  const csrf = await createSession(u.id, req, reply, mfa, c);
  if (reauth)
    await c.query(
      "UPDATE sessions SET reauth_at=now() WHERE user_id=$1 AND csrf=$2",
      [u.id, csrf],
    );
  await auditTx(c, u.id, "session.renewed", u.id, {
    reason: reauth ? "reauthentication" : "mfa",
  });
  return csrf;
}
export async function authRoutes(app: FastifyInstance) {
  const dummy = await hashPassword(token());
  app.get("/api/auth/me", async (req) => ({
    user: req.actor ? publicUser(req.actor) : null,
    csrf: req.actor?.csrf || null,
    mailMode: config.public ? "smtp" : config.mailMode,
    publicMode: config.public,
  }));
  app.post(
    "/api/auth/register",
    { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } },
    async (req) => {
      const b = z
        .object({
          name: z.string().trim().min(2).max(80),
          email,
          password,
          phone: phoneNumber,
        })
        .strict()
        .parse(req.body);
      const h = await hashPassword(b.password);
      const u = await tx(async (c) => {
        const created = (
          await c.query(
            "INSERT INTO users(email,name,password_hash,phone) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING RETURNING id",
            [b.email, b.name, h, b.phone],
          )
        ).rows[0];
        if (created)
          await auditTx(c, created.id, "user.registered", created.id);
        return created;
      });
      if (u && (await reserveAccountEmail(b.email))) {
        try {
          await sendToken(u.id, b.email, "verify");
        } catch {
          await audit(null, "user.email_failed", u.id, { purpose: "verify" });
        }
      }
      return {
        message:
          "Nếu email đủ điều kiện, hướng dẫn xác minh đã được gửi. Kiểm tra hộp thư trước khi đăng nhập.",
      };
    },
  );
  app.post(
    "/api/auth/login",
    { config: { rateLimit: { max: 20, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const b = z
        .object({ email, password: z.string().max(128) })
        .strict()
        .parse(req.body);
      await countLogin(b.email);
      const u = await one(sql`SELECT * FROM users WHERE email=${b.email}`);
      const ok = await argon2.verify(u?.password_hash || dummy, b.password);
      if (!u || !ok || u.blocked) {
        if (u)
          await audit(null, "login.failed", u.id, {
            reason: u.blocked ? "blocked" : "credentials",
          });
        throw new ApiError(401, "Email hoặc mật khẩu chưa đúng.");
      }
      if (u.role === "student" && u.setup_pending)
        throw new ApiError(
          403,
          "Mở thư mời để nhận tài khoản và đặt mật khẩu trước khi đăng nhập.",
        );
      if (!u.verified)
        throw new ApiError(403, "Bạn cần xác minh email trước khi đăng nhập.");
      await clearLogin(b.email);
      const result = await tx(async (c) => {
        const current = (
          await c.query(
            "SELECT password_hash,blocked,verified,setup_pending,role,mfa_secret FROM users WHERE id=$1 FOR UPDATE",
            [u.id],
          )
        ).rows[0];
        if (
          !current ||
          current.blocked ||
          !current.verified ||
          current.password_hash !== u.password_hash ||
          (current.role === "student" && current.setup_pending)
        )
          throw new ApiError(
            401,
            "Thông tin tài khoản đã thay đổi. Vui lòng đăng nhập lại.",
          );
        const csrf = await createSession(u.id, req, reply, false, c);
        await c.query("UPDATE users SET last_login_at=now() WHERE id=$1", [
          u.id,
        ]);
        await auditTx(c, u.id, "login", u.id, {
          device: (req.headers["user-agent"] || "").slice(0, 300),
        });
        return { csrf, mfaRequired: !!current.mfa_secret };
      });
      return result;
    },
  );
  app.post("/api/auth/logout", async (req, reply) => {
    if (req.actor) {
      await db.execute(
        sql`DELETE FROM sessions WHERE id=${req.actor.session_id}`,
      );
      await audit(req.actor.id, "logout", req.actor.id);
    }
    reply.clearCookie("ep_session", { path: "/" });
    return { ok: true };
  });
  app.post("/api/auth/verify", async (req) => {
    const b = z
      .object({ token: z.string().length(64) })
      .strict()
      .parse(req.body);
    await tx(async (c) => {
      const t = await consumeToken(c, b.token, "verify");
      await c.query("UPDATE users SET verified=true WHERE id=$1", [t.user_id]);
      await auditTx(c, t.user_id, "user.verified", t.user_id);
    });
    return { message: "Email đã xác minh. Bạn có thể đăng nhập." };
  });
  for (const action of ["forgot", "resend"] as const)
    app.post(
      `/api/auth/${action}`,
      { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } },
      async (req) => {
        const b = z.object({ email }).strict().parse(req.body);
        const u = await one(
          sql`SELECT id,verified,blocked,role,setup_pending FROM users WHERE email=${b.email}`,
        );
        const allowed = await reserveAccountEmail(b.email);
        if (
          allowed &&
          u &&
          !u.blocked &&
          (action === "forgot" || !u.verified)
        ) {
          try {
            await sendToken(
              u.id,
              b.email,
              u.role === "student" && u.setup_pending
                ? "invite"
                : action === "forgot"
                  ? "reset"
                  : "verify",
            );
          } catch {
            await audit(null, "user.email_failed", u.id, { purpose: action });
            return {
              message:
                "Nếu tài khoản phù hợp, hướng dẫn đã được gửi tới email.",
            };
          }
          await audit(
            req.actor?.id || null,
            action === "forgot"
              ? "user.recovery_requested"
              : "user.verification_requested",
            u.id,
          );
        }
        return {
          message: "Nếu tài khoản phù hợp, hướng dẫn đã được gửi tới email.",
        };
      },
    );
  app.post(
    "/api/auth/reset",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (req) => {
      const b = z
        .object({ token: z.string().length(64), password })
        .strict()
        .parse(req.body);
      const h = await hashPassword(b.password);
      await tx(async (c) => {
        const t = await consumeToken(c, b.token, "reset");
        await c.query("UPDATE users SET password_hash=$2 WHERE id=$1", [
          t.user_id,
          h,
        ]);
        await c.query("DELETE FROM sessions WHERE user_id=$1", [t.user_id]);
        await c.query("DELETE FROM tokens WHERE user_id=$1", [t.user_id]);
        await auditTx(c, t.user_id, "user.password_reset", t.user_id);
      });
      return { message: "Đã đổi mật khẩu. Vui lòng đăng nhập lại." };
    },
  );
  app.post(
    "/api/auth/accept-invitation",
    { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } },
    async (req) => {
      const b = z
        .object({
          token: z
            .string()
            .length(64)
            .regex(/^[a-f0-9]+$/),
          password,
          acceptedTerms: z.literal(true),
        })
        .strict()
        .parse(req.body);
      const h = await hashPassword(b.password);
      await tx(async (c) => {
        // Lock the account before consuming the one-use token, like token issuance.
        const t = (
          await c.query(
            "SELECT user_id FROM tokens WHERE hash=$1 AND purpose='invite' AND expires_at>now()",
            [hash(b.token)],
          )
        ).rows[0];
        if (!t)
          throw new ApiError(
            400,
            "Thư mời không hợp lệ hoặc đã hết hạn. Hãy yêu cầu người chủ trì gửi lại.",
          );
        const u = (
          await c.query(
            "SELECT role,blocked,setup_pending FROM users WHERE id=$1 FOR UPDATE",
            [t.user_id],
          )
        ).rows[0];
        if (!u || u.role !== "student" || u.blocked || !u.setup_pending)
          throw new ApiError(400, "Không thể nhận tài khoản bằng thư mời này.");
        const consumed = await c.query(
          "DELETE FROM tokens WHERE hash=$1 AND purpose='invite' AND expires_at>now() RETURNING user_id",
          [hash(b.token)],
        );
        if (!consumed.rowCount)
          throw new ApiError(400, "Thư mời đã được dùng hoặc hết hạn.");
        await c.query(
          "UPDATE users SET password_hash=$2,verified=true,setup_pending=false WHERE id=$1",
          [t.user_id, h],
        );
        await c.query("DELETE FROM sessions WHERE user_id=$1", [t.user_id]);
        await c.query("DELETE FROM tokens WHERE user_id=$1", [t.user_id]);
        await auditTx(c, t.user_id, "user.invitation_accepted", t.user_id, {
          acceptedTerms: true,
        });
      });
      return {
        message:
          "Đã nhận tài khoản và xác minh email. Bạn có thể đăng nhập và gửi yêu cầu tham gia Lab để được cấp quyền học đầy đủ.",
      };
    },
  );
  app.post("/api/auth/reauth", async (req, reply) => {
    const u = auth(req),
      b = z
        .object({
          password: z.string().max(128),
          code: z.string().max(100).optional(),
        })
        .strict()
        .parse(req.body);
    await countLogin(u.email);
    const row = await one(
      sql`SELECT password_hash,mfa_secret FROM users WHERE id=${u.id}`,
    );
    if (!(await argon2.verify(row!.password_hash, b.password)))
      throw new ApiError(401, "Thông tin xác thực chưa đúng.");
    const csrf = await tx(async (c) => {
      const current = (
        await c.query(
          "SELECT password_hash,mfa_secret,blocked FROM users WHERE id=$1 FOR UPDATE",
          [u.id],
        )
      ).rows[0];
      if (
        !current ||
        current.blocked ||
        current.password_hash !== row!.password_hash ||
        current.mfa_secret !== row!.mfa_secret ||
        (current.mfa_secret && !(await verifyMfa(u.id, b.code || "", c)))
      )
        throw new ApiError(
          401,
          "Thông tin xác thực đã thay đổi hoặc chưa đúng.",
        );
      return renewSession(c, req, reply, !!current.mfa_secret, true);
    });
    await clearLogin(u.email);
    return { ok: true, csrf };
  });
  app.post("/api/auth/password", async (req) => {
    const u = auth(req);
    const b = z
      .object({ current: z.string().max(128), password })
      .strict()
      .parse(req.body);
    await countLogin(u.email);
    const row = await one(
      sql`SELECT password_hash FROM users WHERE id=${u.id}`,
    );
    if (!(await argon2.verify(row!.password_hash, b.current)))
      throw new ApiError(400, "Mật khẩu hiện tại chưa đúng.");
    await clearLogin(u.email);
    const h = await hashPassword(b.password);
    await tx(async (c) => {
      const current = (
        await c.query(
          "SELECT password_hash,blocked FROM users WHERE id=$1 FOR UPDATE",
          [u.id],
        )
      ).rows[0];
      if (
        !current ||
        current.blocked ||
        current.password_hash !== row!.password_hash
      )
        throw new ApiError(
          409,
          "Thông tin tài khoản đã thay đổi. Vui lòng đăng nhập lại.",
        );
      await c.query("UPDATE users SET password_hash=$2 WHERE id=$1", [u.id, h]);
      await c.query("DELETE FROM sessions WHERE user_id=$1", [u.id]);
      await c.query("DELETE FROM tokens WHERE user_id=$1", [u.id]);
      await auditTx(c, u.id, "user.password_changed", u.id);
    });
    return {
      message: "Đã đổi mật khẩu và thu hồi các phiên. Hãy đăng nhập lại.",
    };
  });
  app.patch("/api/auth/profile", async (req) => {
    const u = auth(req);
    const b = z
      .object({
        name: z.string().trim().min(2).max(80),
        phone: phoneNumber.optional(),
      })
      .strict()
      .parse(req.body);
    await tx(async (c) => {
      const old = (
        await c.query("SELECT name,phone FROM users WHERE id=$1 FOR UPDATE", [
          u.id,
        ])
      ).rows[0];
      await c.query("UPDATE users SET name=$2 WHERE id=$1", [u.id, b.name]);
      if (b.phone !== undefined && old.phone !== b.phone) {
        await c.query("UPDATE users SET phone=$2 WHERE id=$1", [u.id, b.phone]);
        await auditTx(c, u.id, "user.phone_updated", u.id);
      }
      if (old.name !== b.name)
        await auditTx(c, u.id, "user.profile_updated", u.id, {
          previousName: old.name,
          name: b.name,
        });
    });
    return { ok: true };
  });
  app.get("/api/auth/sessions", async (req) => {
    const u = auth(req);
    const list = await rows(
      sql`SELECT id,user_agent,created_at,expires_at FROM sessions WHERE user_id=${u.id} AND expires_at>now() ORDER BY created_at DESC`,
    );
    return list.map((s) => ({ ...s, current: s.id === u.session_id }));
  });
  app.delete("/api/auth/sessions/:id", async (req) => {
    const u = auth(req);
    const id = z
      .string()
      .length(64)
      .parse((req.params as any).id);
    await tx(async (c) => {
      const deleted = await c.query(
        "DELETE FROM sessions WHERE id=$1 AND user_id=$2",
        [id, u.id],
      );
      if (deleted.rowCount) await auditTx(c, u.id, "session.revoked", u.id);
    });
    return { ok: true };
  });
  app.post("/api/auth/mfa/setup", async (req) => {
    const u = auth(req);
    const b = z
      .object({ password: z.string().max(128) })
      .strict()
      .parse(req.body);
    await countLogin(u.email);
    const row = await one(
      sql`SELECT password_hash,mfa_secret FROM users WHERE id=${u.id}`,
    );
    if (row!.mfa_secret) throw new ApiError(409, "MFA đã được bật.");
    if (!(await argon2.verify(row!.password_hash, b.password)))
      throw new ApiError(401, "Mật khẩu chưa đúng.");
    await clearLogin(u.email);
    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    await db.execute(
      sql`UPDATE users SET mfa_pending=${encrypt(secret)} WHERE id=${u.id}`,
    );
    return {
      secret,
      qr: await QRCode.toDataURL(totp(secret, u.email).toString()),
    };
  });
  app.post(
    "/api/auth/mfa/enable",
    { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const u = auth(req);
      const b = z
        .object({ code: z.string().length(6) })
        .strict()
        .parse(req.body);
      const codes = Array.from({ length: 8 }, () => token().slice(0, 16));
      const csrf = await tx(async (c) => {
        const row = (
          await c.query(
            "SELECT mfa_pending,mfa_secret FROM users WHERE id=$1 FOR UPDATE",
            [u.id],
          )
        ).rows[0];
        const delta =
          row.mfa_pending && !row.mfa_secret
            ? totp(decrypt(row.mfa_pending), u.email).validate({
                token: b.code,
                window: 1,
              })
            : null;
        if (delta === null) throw new ApiError(400, "Mã xác thực không đúng.");
        await c.query(
          "UPDATE users SET mfa_secret=mfa_pending,mfa_pending=NULL,recovery_hashes=$2,mfa_last_step=$3 WHERE id=$1",
          [
            u.id,
            JSON.stringify(codes.map(hash)),
            Math.floor(Date.now() / 30000) + delta,
          ],
        );
        await c.query("DELETE FROM sessions WHERE user_id=$1 AND id!=$2", [
          u.id,
          u.session_id,
        ]);
        return renewSession(c, req, reply, true);
      });
      await audit(u.id, "mfa.enabled");
      return { recoveryCodes: codes, csrf };
    },
  );
  app.post(
    "/api/auth/mfa/verify",
    { config: { rateLimit: { max: 8, timeWindow: "15 minutes" } } },
    async (req, reply) => {
      const u = auth(req, true);
      const b = z
        .object({ code: z.string().min(6).max(100) })
        .strict()
        .parse(req.body);
      await countLogin(u.email);
      const csrf = await tx(async (c) => {
        if (!(await verifyMfa(u.id, b.code, c)))
          throw new ApiError(401, "Mã xác thực không đúng hoặc đã dùng.");
        return renewSession(c, req, reply, true);
      });
      await clearLogin(u.email);
      return { ok: true, csrf };
    },
  );
}
