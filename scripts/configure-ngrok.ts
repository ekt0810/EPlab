import { input, password } from "@inquirer/prompts";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { ROOT } from "../apps/api/src/config.js";
import { privateOperations } from "./env-file.js";
import { ngrokOrigin, ngrokConfig } from "./ngrok-settings.js";

const exec = promisify(execFile);
let stage = "";
try {
  console.log("EP LAB — cấu hình ngrok miễn phí. Không gửi token qua chat.");
  console.log("Đăng nhập/đăng ký: https://dashboard.ngrok.com/signup");
  console.log("Tên miền được cấp: https://dashboard.ngrok.com/domains");
  console.log(
    "Authtoken: https://dashboard.ngrok.com/get-started/your-authtoken",
  );
  const origin = ngrokOrigin(
    await input({ message: "Tên miền ngrok miễn phí của bạn:" }),
  );
  const token = (
    await password({
      message: "Dán authtoken ngrok (ký tự được che):",
      mask: "*",
    })
  ).trim();
  const content = ngrokConfig(token);
  const binary = path.join(
    process.env.LOCALAPPDATA || "",
    "Microsoft/WindowsApps/ngrok.exe",
  );
  await exec(binary, ["version"], { windowsHide: true, timeout: 10000 });
  const dir = await privateOperations(ROOT);
  stage = path.join(dir, `ngrok-${randomUUID()}.tmp.yml`);
  await fs.writeFile(stage, content, { mode: 0o600, flag: "wx" });
  try {
    await exec(binary, ["config", "check", "--config", stage], {
      windowsHide: true,
      timeout: 10000,
    });
  } catch {
    throw new Error("Ngrok từ chối cấu trúc cấu hình; chưa lưu token mới.");
  }
  await fs.rename(stage, path.join(dir, "ngrok.yml"));
  stage = "";
  await fs.writeFile(
    path.join(dir, "ngrok.json"),
    JSON.stringify(
      { origin, binary, configuredAt: new Date().toISOString() },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    `Đã lưu riêng cấu hình cho ${origin}. Chưa bật tunnel hoặc thay đổi web.`,
  );
  console.log(
    "Kiểm tra cấu trúc chưa xác thực token với ngrok. SMTP và MFA admin vẫn cần hoàn tất trước khi mở Internet.",
  );
} catch (error) {
  if ((error as Error).name === "ExitPromptError")
    console.error("Đã hủy cấu hình ngrok.");
  else if (
    (error as Error).message.startsWith("Dùng đúng") ||
    (error as Error).message.startsWith("Authtoken") ||
    (error as Error).message.startsWith("Ngrok từ chối")
  )
    console.error((error as Error).message);
  else
    console.error(
      "Chưa lưu xong cấu hình ngrok. Kiểm tra tên miền và ngrok đã được cài qua Microsoft Store.",
    );
  process.exitCode = 1;
} finally {
  if (stage) await fs.rm(stage, { force: true });
}
