import fs from "node:fs/promises";
import path from "node:path";
import { ROOT, config } from "../apps/api/src/config.js";
import { publicOrigin } from "../apps/api/src/public-config.js";
import {
  smtpSettings,
  smtpTransport,
  smtpFailure,
} from "../apps/api/src/smtp.js";
import { pool } from "../apps/api/src/db.js";

type Check = { name: string; ok: boolean; detail: string; required: boolean };
const checks: Check[] = [];
function add(name: string, ok: boolean, detail: string, required = true) {
  checks.push({ name, ok, detail, required });
}
const argument = process.argv.indexOf("--url");
const candidate = argument < 0 ? config.url : process.argv[argument + 1] || "";
let url: string | null = null;
try {
  url = publicOrigin(candidate);
  add("https", true, url);
} catch (error) {
  add("https", false, (error as Error).message);
}
try {
  smtpSettings();
  const { transport } = smtpTransport();
  try {
    await transport.verify();
    add("smtp", true, "TLS/xác thực SMTP đạt; chưa kiểm tra thư đến hộp thư.");
  } catch (error) {
    add("smtp", false, smtpFailure(error));
  } finally {
    transport.close();
  }
} catch (error) {
  add("smtp", false, (error as Error).message);
}
try {
  const admins = (
    await pool.query(
      "SELECT admin_slot,verified,blocked,setup_pending,(mfa_secret IS NOT NULL) AS mfa_enabled FROM users WHERE role='admin' ORDER BY admin_slot",
    )
  ).rows;
  add(
    "admin_slots",
    admins.length === 2 &&
      admins[0]?.admin_slot === 1 &&
      admins[1]?.admin_slot === 2,
    "Cần đúng hai vị trí người chủ trì.",
  );
  for (const admin of admins) {
    add(
      `admin_${admin.admin_slot}`,
      admin.verified && !admin.blocked && !admin.setup_pending,
      !admin.verified || admin.blocked || admin.setup_pending
        ? "Tài khoản chưa hoàn tất thiết lập, chưa xác minh hoặc đang bị khóa."
        : "Tài khoản đã thiết lập và xác minh.",
    );
    add(
      `admin_${admin.admin_slot}_mfa`,
      true,
      admin.mfa_enabled
        ? "Đã bật xác thực hai bước."
        : "Xác thực hai bước là tùy chọn. Admin đăng nhập bằng email và mật khẩu để quản trị và truy cập toàn bộ học liệu.",
      false,
    );
  }
} catch {
  add("database", false, "Chưa truy vấn được cơ sở dữ liệu.");
} finally {
  await pool.end();
}
for (const [name, address] of [
  ["frontend", "http://127.0.0.1:3100"],
  ["backend", "http://127.0.0.1:4100/api/health"],
]) {
  try {
    const response = await fetch(address, {
      signal: AbortSignal.timeout(5000),
    });
    const healthy =
      response.ok &&
      (name !== "backend" || (await response.json()).status === "ok");
    if (name === "frontend") await response.arrayBuffer();
    add(name, healthy, `HTTP ${response.status}`);
  } catch {
    add(name, false, "Không phản hồi tại cổng local.");
  }
}
add(
  "loopback",
  config.host === "127.0.0.1" &&
    new URL(config.database).hostname === "127.0.0.1",
  "Backend và PostgreSQL phải chỉ nghe trên máy này.",
);
try {
  const state = JSON.parse(
    (
      await fs.readFile(
        path.join(ROOT, "data/operations/backup-status.json"),
        "utf8",
      )
    ).replace(/^\uFEFF/, ""),
  );
  const age = Date.now() - Date.parse(state.completedAt);
  const archive =
    typeof state.file === "string"
      ? await fs.stat(state.file).catch(() => null)
      : null;
  add(
    "backup",
    state.ok === true &&
      age >= 0 &&
      age < 48 * 3600000 &&
      !!archive?.isFile() &&
      archive.size > 0,
    "Yêu cầu sao lưu tự động thành công trong 48 giờ và tệp vẫn tồn tại.",
  );
} catch {
  add("backup", false, "Chưa tìm thấy bản sao lưu tự động hợp lệ.");
}
const report = {
  checkedAt: new Date().toISOString(),
  purpose: "preflight-only; does not publish or change configuration",
  readyForConfiguration: checks.every((x) => x.ok || !x.required),
  publicEnabled: config.public,
  targetOrigin: url,
  checks,
};
await fs.mkdir(path.join(ROOT, "docs/reports"), { recursive: true });
await fs.writeFile(
  path.join(ROOT, "docs/reports/internet-readiness.json"),
  JSON.stringify(report, null, 2),
);
for (const check of checks)
  console.log(
    `${check.ok ? "ĐẠT" : check.required ? "CHƯA" : "LƯU Ý"} ${check.name}: ${check.detail}`,
  );
console.log(
  report.readyForConfiguration
    ? "Sẵn sàng cấu hình HTTPS; vẫn cần kiểm thử qua địa chỉ Internet sau khi kết nối."
    : "Chưa đủ điều kiện bật Internet. Server local được giữ nguyên.",
);
process.exitCode = report.readyForConfiguration ? 0 : 1;
