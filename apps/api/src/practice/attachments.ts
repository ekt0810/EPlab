import path from "node:path";
import { createHash } from "node:crypto";
import { ApiError } from "../security.js";
export type Track = "kicad" | "embedded" | "solidworks";
export const tracks: Track[] = ["kicad", "embedded", "solidworks"];
export interface SubmittedFile {
  name: string;
  size: number;
  sha256: string;
  data: string;
}
export function inspectAttachments(
  files: { name: string; bytes: Buffer }[],
  track: Track,
): SubmittedFile[] {
  if (
    files.length > 6 ||
    files.reduce((n, f) => n + f.bytes.length, 0) > 15 * 1024 * 1024
  )
    throw new ApiError(
      413,
      "Tối đa 6 tệp, tổng dung lượng tệp không quá 15 MB.",
    );
  const allowed =
    track === "embedded"
      ? [".c", ".h", ".txt", ".md"]
      : track === "solidworks"
        ? [
            ".sldprt",
            ".sldasm",
            ".slddrw",
            ".step",
            ".stp",
            ".pdf",
            ".txt",
            ".md",
          ]
        : [];
  const names = new Set<string>();
  return files.map(({ name, bytes: b }) => {
    if (
      !name ||
      name.length > 120 ||
      /[\x00-\x1f\x7f/\\:\u202a-\u202e\u2066-\u2069]/.test(name) ||
      name.endsWith(".") ||
      name.endsWith(" ")
    )
      throw new ApiError(
        400,
        "Tên tệp không hợp lệ; không chứa đường dẫn hoặc ký tự điều khiển.",
      );
    const lower = name.toLowerCase(),
      ext = path.extname(lower);
    if (!allowed.includes(ext) || names.has(lower))
      throw new ApiError(
        400,
        "Loại tệp không phù hợp môn học hoặc tên tệp bị trùng.",
      );
    names.add(lower);
    if (!b.length || b.length > 5 * 1024 * 1024)
      throw new ApiError(413, "Tệp cần có nội dung và không quá 5 MB.");
    let valid = false;
    if ([".c", ".h", ".txt", ".md", ".step", ".stp"].includes(ext)) {
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(b);
        valid = !b.includes(0) && !/[\x01-\x08\x0b\x0c\x0e-\x1f]/.test(text);
        if ([".step", ".stp"].includes(ext))
          valid =
            valid &&
            text.trimStart().startsWith("ISO-10303-21;") &&
            text.includes("END-ISO-10303-21;");
      } catch {
        valid = false;
      }
    } else if (ext === ".pdf")
      valid =
        b.subarray(0, 5).toString() === "%PDF-" &&
        b.subarray(-2048).includes(Buffer.from("%%EOF"));
    else
      valid =
        b.length >= 512 &&
        b.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1";
    if (!valid)
      throw new ApiError(
        400,
        "Nội dung không khớp định dạng tệp. Mã C/văn bản dùng UTF-8; CAD cần tệp gốc.",
      );
    return {
      name,
      size: b.length,
      sha256: createHash("sha256").update(b).digest("hex"),
      data: b.toString("base64"),
    };
  });
}
