import { input, password } from "@inquirer/prompts";
import { z } from "zod";
import { pool, tx } from "../apps/api/src/db.js";
import { hashPassword } from "../apps/api/src/auth.js";
import { token } from "../apps/api/src/security.js";
export async function reserveAdmins(emails: string[]) {
  if (
    emails.length !== 2 ||
    new Set(emails.map((s) => s.toLowerCase())).size !== 2
  )
    throw new Error("Cần đúng hai email khác nhau.");
  for (const e of emails) z.string().email().parse(e);
  const hashes = await Promise.all(emails.map(() => hashPassword(token())));
  await tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(8493022)");
    for (let i = 0; i < 2; i++) {
      const existing = (
        await c.query("SELECT email FROM users WHERE admin_slot=$1", [i + 1])
      ).rows[0];
      if (existing) {
        if (existing.email !== emails[i].toLowerCase())
          throw new Error(
            `Admin ${i + 1} đã thuộc email khác. Không tự ghi đè.`,
          );
        continue;
      }
      await c.query(
        "INSERT INTO users(email,name,password_hash,role,admin_slot,verified,setup_pending) VALUES($1,$2,$3,'admin',$4,false,true)",
        [emails[i].toLowerCase(), `Quản trị viên ${i + 1}`, hashes[i], i + 1],
      );
    }
  });
}
async function main() {
  const emails = [
    process.env.ADMIN_1_EMAIL || (await input({ message: "Email admin 1:" })),
    process.env.ADMIN_2_EMAIL || (await input({ message: "Email admin 2:" })),
  ];
  await reserveAdmins(emails);
  for (const email of emails) {
    const u = (
      await pool.query("SELECT id,setup_pending FROM users WHERE email=$1", [
        email.toLowerCase(),
      ])
    ).rows[0];
    if (!u.setup_pending) {
      console.log(`${email}: đã thiết lập; giữ nguyên mật khẩu.`);
      continue;
    }
    const value = await password({
      message: `Đặt mật khẩu cho ${email} (ít nhất 8 ký tự):`,
      mask: "*",
      validate: (v) => (v.length >= 8 && v.length <= 128) || "Cần 8–128 ký tự.",
    });
    const confirm = await password({
      message: "Nhập lại mật khẩu:",
      mask: "*",
    });
    if (value !== confirm) throw new Error("Hai mật khẩu không khớp.");
    await pool.query(
      "UPDATE users SET password_hash=$2,verified=true,setup_pending=false WHERE id=$1 AND setup_pending",
      [u.id, await hashPassword(value)],
    );
    console.log(`${email}: sẵn sàng đăng nhập. Bật MFA trong trang tài khoản.`);
  }
  await pool.end();
}
if (process.argv[1]?.endsWith("admin.ts")) await main();
