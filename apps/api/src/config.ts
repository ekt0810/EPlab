import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validatePublicSettings } from "./public-config.js";
export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
dotenv.config({ path: path.join(ROOT, ".env"), quiet: true });
export const config = {
  root: ROOT,
  url: process.env.APP_URL || "http://127.0.0.1:3100",
  port: Number(process.env.API_PORT || 4100),
  host: process.env.API_HOST || "127.0.0.1",
  database: process.env.DATABASE_URL || "",
  secret: process.env.SECRET_KEY || "",
  data: path.resolve(ROOT, process.env.DATA_DIR || "data"),
  public: process.env.PUBLIC_MODE === "true",
  mailMode: process.env.MAIL_MODE || "local",
  trustProxy:
    process.env.TRUST_PROXY === "true"
      ? ["127.0.0.1", "::1"]
      : process.env.TRUST_PROXY && process.env.TRUST_PROXY !== "false"
        ? process.env.TRUST_PROXY.split(",")
            .map((x) => x.trim())
            .filter(Boolean)
        : (false as false | string[]),
};
export function validateConfig() {
  if (!config.database || !/^[a-f0-9]{64}$/i.test(config.secret))
    throw new Error(
      "Chạy npm run setup để cấu hình DATABASE_URL và SECRET_KEY.",
    );
  if (config.public)
    validatePublicSettings({
      ...process.env,
      APP_URL: config.url,
      MAIL_MODE: config.mailMode,
    });
}
