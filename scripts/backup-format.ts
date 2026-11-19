import {
  randomBytes,
  scryptSync,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
export const TABLES = [
  "users",
  "sessions",
  "tokens",
  "courses",
  "chapters",
  "lessons",
  "resources",
  "progress",
  "orders",
  "payment_transactions",
  "entitlements",
  "lab_memberships",
  "settings",
  "audit_logs",
  "login_limits",
  "kicad_lessons",
  "exercises",
  "quiz_results",
  "assignments",
  "submissions",
  "submission_reviews",
  "practice_threads",
  "practice_messages",
  "classroom_progress",
  "classroom_messages",
] as const;
export const digest = (b: Buffer | string) =>
  createHash("sha256").update(b).digest("hex");
const MAGIC = Buffer.from("EPLAB1");
function key(password: string, salt: Buffer) {
  if (password.length < 16)
    throw new Error("Mật khẩu backup tối thiểu 16 ký tự.");
  return scryptSync(password, salt, 32, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 128 * 1024 * 1024,
  });
}
export function seal(data: unknown, password: string) {
  const salt = randomBytes(16),
    iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(password, salt), iv);
  cipher.setAAD(MAGIC);
  const serialized = Buffer.from(JSON.stringify(data));
  if (serialized.length > 512 * 1024 * 1024)
    throw new Error(
      "Snapshot vượt 512 MB; dùng pg_dump và sao lưu file theo hướng dẫn vận hành.",
    );
  const plain = gzipSync(serialized);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), encrypted]);
}
export function unseal(bytes: Buffer, password: string) {
  if (!bytes.subarray(0, 6).equals(MAGIC))
    throw new Error("Không đúng định dạng backup EP LAB.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(password, bytes.subarray(6, 22)),
    bytes.subarray(22, 34),
  );
  decipher.setAAD(MAGIC);
  decipher.setAuthTag(bytes.subarray(34, 50));
  const decrypted = Buffer.concat([
    decipher.update(bytes.subarray(50)),
    decipher.final(),
  ]);
  const decoded = gunzipSync(decrypted, { maxOutputLength: 512 * 1024 * 1024 });
  return JSON.parse(decoded.toString("utf8"));
}
