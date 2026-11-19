import { z } from "zod";
import { ApiError } from "../security.js";

export function withSelfChecks(body: any) {
  return {
    ...body,
    checks: body.checks?.length
      ? body.checks
      : body.criteria.map((c: any) => [
          `Đối chiếu ${c.id.toUpperCase()} trên bài làm và ảnh bằng chứng.`,
          c.text,
        ]),
  };
}

export function parseSelfChecks(raw: string, exercise: any) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(400, "Kết quả tự kiểm tra không đúng định dạng.");
  }
  const checks = z
    .array(
      z
        .object({
          index: z.number().int().min(0),
          status: z.enum(["not_run", "pass", "fail"]),
          observed: z.string().trim().max(600),
        })
        .strict(),
    )
    .max(20)
    .parse(parsed);
  if (
    new Set(checks.map((c) => c.index)).size !== checks.length ||
    checks.some((c) => c.index >= exercise.checks.length)
  )
    throw new ApiError(400, "Ca tự kiểm tra bị trùng hoặc không thuộc đề bài.");
  if (checks.some((c) => c.status !== "not_run" && !c.observed))
    throw new ApiError(400, "Ghi kết quả thực tế cho mỗi ca đã kiểm tra.");
  return checks.sort((a, b) => a.index - b.index);
}
