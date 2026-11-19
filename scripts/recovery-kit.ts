import fs from "node:fs/promises";
import path from "node:path";
import { password } from "@inquirer/prompts";
import { config } from "../apps/api/src/config.js";
import { seal, unseal } from "./backup-format.js";

// Interactive only: never put a recovery password in process arguments or logs.
const pass = await password({
  message: "Mật khẩu riêng cho bộ khóa khôi phục (ít nhất 16 ký tự):",
  mask: "*",
  validate: (v) => v.length >= 16 || "Cần ít nhất 16 ký tự.",
});
if (process.argv[2] === "--restore") {
  const source = process.argv[3],
    destination = process.argv[4];
  if (!source || !destination)
    throw new Error("Cần file .eplabkeys và thư mục đích mới, riêng tư.");
  const data = unseal(await fs.readFile(path.resolve(source)), pass);
  if (data.kind !== "ep-lab-recovery-v1") throw new Error("Sai loại bộ khóa.");
  const target = path.resolve(destination);
  await fs.mkdir(target, { recursive: false }); // Refuse an existing destination.
  await fs.writeFile(path.join(target, ".env.source"), data.environment, {
    flag: "wx",
    mode: 0o600,
  });
  await fs.writeFile(
    path.join(target, "backup-password.txt"),
    data.backupPassword,
    { flag: "wx", mode: 0o600 },
  );
  console.log(
    "Đã giải mã vào thư mục đích. Giữ kín hai file; chỉnh đường dẫn/kết nối cho máy mới và giữ SECRET_KEY để dùng lại MFA.",
  );
} else {
  if (!process.env.BACKUP_PASSWORD)
    throw new Error(
      "Chạy server-control.ps1 -Action ExportRecovery trên tài khoản Windows đang vận hành.",
    );
  const confirm = await password({
    message: "Nhập lại mật khẩu bộ khóa:",
    mask: "*",
  });
  if (pass !== confirm) throw new Error("Hai mật khẩu không khớp.");
  const output = path.join(
    config.root,
    "backups",
    `ep-lab-recovery-${Date.now()}.eplabkeys`,
  );
  const data = {
    kind: "ep-lab-recovery-v1",
    createdAt: new Date().toISOString(),
    environment: await fs.readFile(path.join(config.root, ".env"), "utf8"),
    backupPassword: process.env.BACKUP_PASSWORD,
  };
  await fs.writeFile(output, seal(data, pass), { flag: "wx", mode: 0o600 });
  console.log(
    `Bộ khóa đã mã hóa: ${output}\nLưu bộ khóa và bản backup trên ổ riêng; giữ mật khẩu ở nơi khác. Không gửi bộ khóa công khai.`,
  );
}
