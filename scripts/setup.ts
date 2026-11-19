import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { input } from "@inquirer/prompts";
import { z } from "zod";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = path.join(root, ".env");
if (!(await fs.stat(env).catch(() => null))) {
  const email = z.string().email();
  const admin1 = email.parse(
    process.env.ADMIN_1_EMAIL ||
      (await input({
        message: "Email người chủ trì 1:",
        validate: (value) => email.safeParse(value).success || "Nhập email hợp lệ.",
      })),
  ).toLowerCase();
  const admin2 = email.parse(
    process.env.ADMIN_2_EMAIL ||
      (await input({
        message: "Email người chủ trì 2:",
        validate: (value) =>
          (email.safeParse(value).success && value.toLowerCase() !== admin1) ||
          "Nhập email hợp lệ và khác email thứ nhất.",
      })),
  ).toLowerCase();
  if (admin1 === admin2) throw new Error("Cần hai email quản trị khác nhau.");
  const dbPassword = randomBytes(24).toString("hex"),
    secret = randomBytes(32).toString("hex");
  await fs.writeFile(
    env,
    `NODE_ENV=development\nAPP_URL=http://127.0.0.1:3100\nAPI_HOST=127.0.0.1\nAPI_PORT=4100\nDATABASE_URL=postgresql://eplab:${dbPassword}@127.0.0.1:55432/eplab\nSECRET_KEY=${secret}\nDATA_DIR=./data\nMAIL_MODE=local\nPUBLIC_MODE=false\nTRUST_PROXY=false\nLOCAL_POSTGRES=true\nLOCAL_PG_PASSWORD=${randomBytes(32).toString("hex")}\nADMIN_1_EMAIL=${admin1}\nADMIN_2_EMAIL=${admin2}\n`,
    { mode: 0o600, flag: "wx" },
  );
  console.log("Đã tạo .env riêng. Không chia sẻ hoặc đưa file này vào Git.");
}
const { startDatabase } = await import("./database.js");
process.env.NEXT_TELEMETRY_DISABLED = "1";
const pg = await startDatabase();
const { migrate } = await import("../apps/api/src/migrate.js");
await migrate();
const { seed } = await import("../apps/api/src/seed.js");
await seed();
const { reserveAdmins } = await import("./admin.js");
await reserveAdmins([process.env.ADMIN_1_EMAIL!, process.env.ADMIN_2_EMAIL!]);
const { pool } = await import("../apps/api/src/db.js");
await pool.end();
if (pg) await pg.stop();
console.log(
  "Đã tạo dữ liệu học và giữ hai vị trí admin. Chạy npm run dev; dùng npm run admin:setup trong terminal thứ hai để đặt mật khẩu.",
);
