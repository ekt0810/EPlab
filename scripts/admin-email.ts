import { input, password } from "@inquirer/prompts";
import argon2 from "argon2";
import * as OTPAuth from "otpauth";
import { z } from "zod";
import { pool, tx } from "../apps/api/src/db.js";
import { decrypt } from "../apps/api/src/security.js";
const slot = Number(process.argv[2]);
if (![1, 2].includes(slot))
  throw new Error("Dùng: npm run admin:email -- 1 hoặc 2");
try {
  const user = (
    await pool.query("SELECT * FROM users WHERE admin_slot=$1", [slot])
  ).rows[0];
  if (!user) throw new Error("Chưa có admin ở vị trí này.");
  const pw = await password({ message: "Mật khẩu admin hiện tại:", mask: "*" });
  if (!(await argon2.verify(user.password_hash, pw)))
    throw new Error("Mật khẩu không đúng.");
  if (user.mfa_secret) {
    const code = await input({ message: "Mã MFA hiện tại:" });
    const otp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(decrypt(user.mfa_secret)),
    });
    if (otp.validate({ token: code, window: 1 }) === null)
      throw new Error("Mã MFA không đúng.");
  }
  const email = z
    .string()
    .email()
    .parse(await input({ message: "Email admin mới do bạn kiểm soát:" }))
    .toLowerCase();
  await tx(async (c) => {
    await c.query("UPDATE users SET email=$1 WHERE id=$2", [email, user.id]);
    await c.query("DELETE FROM sessions WHERE user_id=$1", [user.id]);
    await c.query("DELETE FROM tokens WHERE user_id=$1", [user.id]);
    await c.query(
      "INSERT INTO audit_logs(actor_id,action,target) VALUES($1,'admin.email_changed',$1)",
      [user.id],
    );
  });
  console.log(
    `Đã đổi email cho vị trí ${slot}. Cập nhật ADMIN_${slot}_EMAIL trong .env cho khớp trước lần chạy setup kế tiếp. Các phiên cũ đã bị thu hồi.`,
  );
} finally {
  await pool.end();
}
