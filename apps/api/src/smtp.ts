import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import { z } from "zod";

export function smtpSettings(env: NodeJS.ProcessEnv = process.env) {
  const host = (env.SMTP_HOST || "").trim();
  const port = Number(env.SMTP_PORT || 587);
  const user = env.SMTP_USER || "";
  const pass = env.SMTP_PASSWORD || "";
  const from = (env.SMTP_FROM || "").trim();
  if (!host) throw new Error("Chưa cấu hình SMTP_HOST.");
  if (/[\s/@:#?]/.test(host))
    throw new Error("SMTP_HOST phải là tên máy chủ, không phải URL.");
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("SMTP_PORT không hợp lệ.");
  if (!user || !pass || /[\r\n\0]/.test(user + pass))
    throw new Error("Thiếu SMTP_USER/SMTP_PASSWORD hoặc có ký tự xuống dòng.");
  if (!z.email().safeParse(from).success)
    throw new Error("SMTP_FROM phải là một địa chỉ email hợp lệ.");
  const options: SMTPTransport.Options = {
    host,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user, pass },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    dnsTimeout: 10000,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true,
  };
  return { options, from: { name: "EP LAB", address: from } };
}

export function smtpTransport(env: NodeJS.ProcessEnv = process.env) {
  const settings = smtpSettings(env);
  return {
    transport: nodemailer.createTransport(settings.options),
    from: settings.from,
  };
}

// Do not print SMTP errors verbatim: providers may echo account details.
export function smtpFailure(error: unknown) {
  const code = (error as { code?: string })?.code;
  if (code === "EAUTH")
    return "Đăng nhập SMTP bị từ chối. Kiểm tra tài khoản và mật khẩu ứng dụng.";
  if (code === "ETIMEDOUT" || code === "ECONNECTION")
    return "Không kết nối được SMTP trong thời gian cho phép. Kiểm tra mạng, host và cổng.";
  return "Kiểm tra SMTP thất bại. Kiểm tra cấu hình TLS, tài khoản và quyền gửi email.";
}
