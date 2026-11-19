import { input, password, select } from "@inquirer/prompts";
import { ROOT } from "../apps/api/src/config.js";
import { smtpTransport, smtpFailure } from "../apps/api/src/smtp.js";
import { updateEnvFile } from "./env-file.js";

try {
  console.log(
    "EP LAB — cấu hình email trên máy này. Không gửi mật khẩu qua chat.",
  );
  const gmailQuick = process.argv.includes("--gmail");
  const provider = gmailQuick
    ? "gmail"
    : await select({
        message: "Dịch vụ gửi thư:",
        choices: [
          {
            name: "Gmail — dùng mật khẩu ứng dụng, không dùng mật khẩu đăng nhập",
            value: "gmail",
          },
          { name: "SMTP của nhà cung cấp khác", value: "smtp" },
        ],
      });
  if (provider === "gmail")
    console.log(
      "Bật xác minh 2 bước của Google, rồi tạo mật khẩu ứng dụng EP LAB tại https://myaccount.google.com/apppasswords",
    );
  const host =
    provider === "gmail"
      ? "smtp.gmail.com"
      : await input({ message: "Máy chủ SMTP:" });
  const port =
    provider === "gmail"
      ? "587"
      : await input({
          message: "Cổng SMTP (587 STARTTLS / 465 TLS):",
          default: "587",
        });
  const user = gmailQuick
    ? process.env.ADMIN_1_EMAIL || ""
    : await input({
        message: "Tài khoản SMTP / địa chỉ Gmail:",
        default: process.env.SMTP_USER || process.env.ADMIN_1_EMAIL,
      });
  const from = gmailQuick
    ? user
    : await input({
        message: "Địa chỉ email gửi (đã được nhà cung cấp cho phép):",
        default: user,
      });
  if (!user)
    throw new Error(
      "Chưa cấu hình địa chỉ email người chủ trì. Chạy lại không có --gmail để nhập địa chỉ.",
    );
  if (gmailQuick)
    console.log(
      `Đã chọn Gmail: ${user}. Máy chủ smtp.gmail.com, cổng 587. Chỉ nhập mật khẩu ứng dụng vào ô được che bên dưới.`,
    );
  const entered = await password({
    message:
      provider === "gmail"
        ? "Mật khẩu ứng dụng Gmail (16 ký tự):"
        : "Mật khẩu SMTP / API key SMTP:",
    mask: "*",
  });
  const settings = {
    SMTP_HOST: host.trim(),
    SMTP_PORT: port.trim(),
    SMTP_USER: user.trim(),
    SMTP_FROM: from.trim(),
    SMTP_PASSWORD: provider === "gmail" ? entered.replace(/\s/g, "") : entered,
    MAIL_MODE: "smtp",
  };
  const { transport } = smtpTransport(settings);
  console.log("Đang kiểm tra kết nối TLS và xác thực; bước này không gửi thư.");
  try {
    await transport.verify();
  } catch (e) {
    throw new Error(smtpFailure(e));
  } finally {
    transport.close();
  }
  await updateEnvFile(ROOT, settings);
  console.log(
    "Đã lưu email trong .env riêng. Chưa bật Internet. Khởi động lại server để áp dụng; verify() chưa chứng minh thư đã tới hộp thư.",
  );
} catch (error) {
  if ((error as Error).name === "ExitPromptError")
    console.error("Đã hủy; không lưu mật khẩu.");
  else if ((error as Error).name === "Error")
    console.error((error as Error).message);
  else console.error("Cấu hình email chưa hoàn tất; không lưu mật khẩu.");
  process.exitCode = 1;
}
