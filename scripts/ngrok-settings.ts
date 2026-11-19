import { publicOrigin } from "../apps/api/src/public-config.js";

export function ngrokOrigin(value: string) {
  const origin = publicOrigin(
    value.trim().startsWith("https://")
      ? value.trim()
      : `https://${value.trim()}`,
  );
  if (!/^[a-z0-9-]+\.ngrok-free\.(app|dev)$/.test(new URL(origin).hostname))
    throw new Error(
      "Dùng đúng tên miền miễn phí được cấp trong dashboard ngrok (ngrok-free.app hoặc ngrok-free.dev).",
    );
  return origin;
}

export function ngrokConfig(authToken: string) {
  if (!/^[A-Za-z0-9_.-]{20,250}$/.test(authToken))
    throw new Error(
      "Authtoken không đúng định dạng; lấy từ dashboard chính thức.",
    );
  return `version: "3"\nagent:\n  authtoken: ${JSON.stringify(authToken)}\n  web_addr: "127.0.0.1:4041"\n  console_ui: false\n  remote_management: false\n  log: false\n`;
}
