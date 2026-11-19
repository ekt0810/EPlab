import fs from "node:fs/promises";
import path from "node:path";
import { smtpTransport, smtpFailure } from "./smtp.js";
import { config } from "./config.js";
import { token, hash } from "./security.js";
import { db, sql, tx } from "./db.js";
export async function sendToken(
  id: string,
  email: string,
  purpose: "verify" | "reset" | "invite",
) {
  const raw = token();
  await tx(async (c) => {
    await c.query("SELECT id FROM users WHERE id=$1 FOR UPDATE", [id]);
    await c.query("DELETE FROM tokens WHERE user_id=$1 AND purpose=$2", [
      id,
      purpose,
    ]);
    await c.query(
      "INSERT INTO tokens(hash,user_id,purpose,expires_at) VALUES($1,$2,$3,now()+interval '30 minutes')",
      [hash(raw), id, purpose],
    );
  });
  const url = `${config.url}/${purpose === "invite" ? "nhan-tai-khoan" : purpose === "verify" ? "xac-minh" : "dat-lai-mat-khau"}#token=${raw}`;
  const message = {
    to: email,
    subject:
      purpose === "invite"
        ? "EP LAB — Nhận tài khoản và đặt mật khẩu"
        : purpose === "verify"
          ? "EP LAB — Xác minh email"
          : "EP LAB — Đặt lại mật khẩu",
    text: `Mở liên kết sau trong 30 phút. Liên kết chỉ dùng một lần.\n${url}\nNếu không yêu cầu, bạn có thể bỏ qua email này.`,
  };
  try {
    if (config.mailMode === "local" && !config.public) {
      await fs.mkdir(path.join(config.data, "mail"), { recursive: true });
      await fs.writeFile(
        path.join(
          config.data,
          "mail",
          `${Date.now()}-${token().slice(0, 8)}.json`,
        ),
        JSON.stringify(message, null, 2),
        { mode: 0o600 },
      );
      return;
    }
    if (config.mailMode !== "smtp")
      throw new Error("Email chưa được cấu hình.");
    const { transport, from } = smtpTransport();
    try {
      await transport.sendMail({ ...message, from });
    } catch (error) {
      await db.execute(sql`DELETE FROM tokens WHERE hash=${hash(raw)}`);
      throw new Error(smtpFailure(error));
    } finally {
      transport.close();
    }
  } catch (error) {
    await db.execute(sql`DELETE FROM tokens WHERE hash=${hash(raw)}`);
    throw error;
  }
}
