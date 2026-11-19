import sharp from "sharp";
import { z } from "zod";
import { ApiError } from "../security.js";
import type { Exercise } from "./content.js";
sharp.concurrency(1);
sharp.cache({ memory: 32, files: 0, items: 30 });
export async function normalizeImages(files: Buffer[]) {
  if (!files.length || files.length > 2)
    throw new ApiError(400, "Chọn 1–2 ảnh PNG, JPEG hoặc WebP.");
  const images: string[] = [];
  for (const buffer of files) {
    if (buffer.length > 5 * 1024 * 1024)
      throw new ApiError(413, "Mỗi ảnh tối đa 5 MB.");
    try {
      const img = sharp(buffer, {
        limitInputPixels: 8_000_000,
        animated: false,
        failOn: "warning",
      });
      const meta = await img.metadata();
      if (
        !["png", "jpeg", "webp"].includes(meta.format) ||
        (meta.pages || 1) > 1 ||
        meta.width < 200 ||
        meta.height < 150
      )
        throw new Error("format");
      const safe = await img
        .rotate()
        .flatten({ background: "#fff" })
        .resize({
          width: 1600,
          height: 1600,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 90 })
        .toBuffer();
      images.push(`data:image/webp;base64,${safe.toString("base64")}`);
    } catch {
      throw new ApiError(
        400,
        "Ảnh không hợp lệ. Dùng PNG/JPEG/WebP, tối thiểu 200×150 px và tối đa 8 megapixel.",
      );
    }
  }
  return images;
}
const violation = z
  .object({
    severity: z.enum(["error", "warning", "info", "exclusion"]).optional(),
  })
  .passthrough();
export function summarizeReport(raw: string) {
  if (!raw.trim()) return null;
  if (Buffer.byteLength(raw) > 100_000)
    throw new ApiError(400, "Báo cáo tối đa 100 KB.");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "Báo cáo cần là JSON xuất từ KiCad.");
  }
  const schema = z
    .object({
      kicad_version: z.string().max(100).optional(),
      violations: z.array(violation).max(5000).optional(),
      unconnected_items: z.array(violation).max(5000).optional(),
      schematic_parity: z.array(violation).max(5000).optional(),
      sheets: z
        .array(
          z
            .object({ violations: z.array(violation).max(5000).optional() })
            .passthrough(),
        )
        .max(100)
        .optional(),
    })
    .passthrough();
  const parsed = schema.safeParse(value);
  if (!parsed.success || (!parsed.data.violations && !parsed.data.sheets))
    throw new ApiError(400, "Không nhận diện cấu trúc báo cáo ERC/DRC KiCad.");
  const r = parsed.data,
    items = [
      ...(r.violations || []),
      ...(r.unconnected_items || []),
      ...(r.schematic_parity || []),
      ...(r.sheets || []).flatMap((s) => s.violations || []),
    ];
  return {
    provenance: "Báo cáo do người tham gia cung cấp; chưa đối chiếu tệp thiết kế.",
    errors: items.filter((v) => v.severity === "error").length,
    warnings: items.filter((v) => v.severity === "warning").length,
    total: items.length,
    version: r.kicad_version || "Không rõ",
    raw,
  };
}
export const reviewSchema = z
  .object({
    revision: z.number().int().min(0),
    summary: z.string().trim().min(5).max(2000),
    criteria: z
      .array(
        z
          .object({
            id: z.string(),
            status: z.enum(["met", "not_met", "unclear"]),
            evidence: z.string().trim().min(1).max(1500),
            action: z.string().max(1500),
          })
          .strict(),
      )
      .length(4),
  })
  .strict();
export function validateReview(input: unknown, exercise: Exercise) {
  const b = reviewSchema.parse(input),
    ids = new Set(b.criteria.map((c) => c.id));
  if (
    ids.size !== exercise.criteria.length ||
    exercise.criteria.some((c) => !ids.has(c.id))
  )
    throw new ApiError(400, "Bảng tiêu chí không khớp đề bài.");
  const score = b.criteria.reduce(
    (sum, c) =>
      sum +
      (c.status === "met"
        ? exercise.criteria.find((r) => r.id === c.id)!.points
        : 0),
    0,
  );
  const status = b.criteria.some((c) => c.status === "unclear")
    ? "needs_review"
    : score >= exercise.passScore
      ? "visual_pass"
      : "needs_revision";
  return {
    ...b,
    score,
    status,
    reviewer: "human",
    scope:
      "Người chủ trì đánh giá theo bằng chứng bài nộp. Các ca tự kiểm tra do người tham gia thực hiện; hệ thống không tự chạy mã hoặc kiểm định thiết kế.",
  };
}
