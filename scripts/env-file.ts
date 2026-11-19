import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import dotenv from "dotenv";

const exec = promisify(execFile);
export function patchEnv(source: string, changes: Record<string, string>) {
  const keys = new Set(Object.keys(changes));
  const lines = source
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => {
      const key = line.match(
        /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/,
      )?.[1];
      return !key || !keys.has(key);
    });
  for (const [key, value] of Object.entries(changes)) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || /[\r\n\0]/.test(value))
      throw new Error("Giá trị cấu hình không hợp lệ.");
    const quote = ["'", '"', "`"].find((q) => !value.includes(q));
    if (!quote)
      throw new Error("Giá trị chứa quá nhiều kiểu dấu nháy để lưu an toàn.");
    lines.push(`${key}=${quote}${value}${quote}`);
  }
  const output = lines.join("\n").replace(/^\n+/, "") + "\n";
  const parsed = dotenv.parse(output);
  for (const [key, value] of Object.entries(changes))
    if (parsed[key] !== value)
      throw new Error("Không thể lưu chính xác cấu hình.");
  return output;
}

export async function privateOperations(root: string) {
  const privateDir = path.join(root, "data", "operations");
  await fs.mkdir(privateDir, { recursive: true, mode: 0o700 });
  if (process.platform === "win32") {
    const identity = (
      await exec("whoami.exe", [], { windowsHide: true })
    ).stdout.trim();
    await exec(
      "icacls.exe",
      [
        privateDir,
        "/inheritance:r",
        "/grant:r",
        `${identity}:(OI)(CI)F`,
        "*S-1-5-18:(OI)(CI)F",
        "*S-1-5-32-544:(OI)(CI)F",
      ],
      { windowsHide: true },
    );
  }
  return privateDir;
}

export async function updateEnvFile(
  root: string,
  changes: Record<string, string>,
) {
  const target = path.join(root, ".env");
  const privateDir = await privateOperations(root);
  const lockFile = path.join(privateDir, "env-update.lock");
  const lock = await fs.open(lockFile, "wx", 0o600);
  const stage = path.join(privateDir, `env-${randomUUID()}.tmp`);
  try {
    const original = await fs.readFile(target, "utf8");
    await fs.writeFile(stage, patchEnv(original, changes), {
      flag: "wx",
      mode: 0o600,
    });
    if ((await fs.readFile(target, "utf8")) !== original)
      throw new Error("Cấu hình đã được sửa bởi tiến trình khác; chưa ghi đè.");
    // Move from a directory with private ACLs, never stage a secret beside public files.
    await fs.rename(stage, target);
  } finally {
    await fs.rm(stage, { force: true });
    await lock.close();
    await fs.rm(lockFile, { force: true });
  }
}
