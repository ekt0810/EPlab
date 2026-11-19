import { isIP } from "node:net";
import { smtpSettings } from "./smtp.js";

export function publicOrigin(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("APP_URL phải là địa chỉ HTTPS đầy đủ.");
  }
  if (
    value !== value.trim() ||
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    (url.port && url.port !== "443") ||
    !url.hostname.includes(".") ||
    isIP(url.hostname.replace(/^\[|\]$/g, "")) ||
    /(^|\.)(localhost|local|internal|test|invalid)$/.test(url.hostname) ||
    /(^|\.)example\.(com|org|net)$/.test(url.hostname)
  )
    throw new Error(
      "APP_URL phải là gốc HTTPS của tên miền công khai, không kèm đường dẫn, tài khoản hoặc tham số.",
    );
  return url.origin;
}

export function validatePublicSettings(env: NodeJS.ProcessEnv) {
  const origin = publicOrigin(env.APP_URL || "");
  if (env.APP_URL !== origin)
    throw new Error("APP_URL không được có dấu / ở cuối; dùng đúng gốc HTTPS.");
  if (env.MAIL_MODE !== "smtp")
    throw new Error("Public mode yêu cầu SMTP thật.");
  smtpSettings(env);
  return origin;
}
