import { z } from "zod";
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine(
      (v) => !/[<>\u0000-\u0008\u202a-\u202e\u2066-\u2069]/u.test(v),
      "Chỉ nhập văn bản, không dùng HTML hoặc ký tự điều hướng ẩn.",
    );
export const externalUrl = z
  .string()
  .max(2048)
  .url()
  .refine((value) => {
    try {
      const u = new URL(value),
        host = u.hostname.toLowerCase();
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        (!u.port || u.port === "443") &&
        /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) &&
        !/(^|\.)(localhost|local|internal|test|invalid|example)$/.test(host)
      );
    } catch {
      return false;
    }
  }, "Dùng đường dẫn HTTPS công khai của ban tổ chức.");
const timestamp = z.string().datetime({ offset: true });
const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(v + "T00:00:00Z");
    return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === v;
  });
export const competitionSchema = z
  .object({
    id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    title: text(160),
    organizer: text(160),
    summary: text(600),
    topics: z
      .array(z.enum(["embedded", "robotics", "iot", "fpga"]))
      .min(1)
      .max(4),
    region: z.enum(["vietnam", "international"]),
    eligibility: text(600),
    eligibilityNote: text(400).nullable(),
    format: z.enum(["online", "in-person", "hybrid"]),
    location: text(200),
    applicationState: z.enum(["open", "upcoming", "closed", "unconfirmed"]),
    opensAt: timestamp.nullable(),
    deadlineAt: timestamp.nullable(),
    deadlineDate: calendarDate.nullable(),
    deadlineLabel: text(200),
    eventPeriod: text(300),
    costNote: text(250),
    registrationUrl: externalUrl.nullable(),
    registrationKind: z.enum(["form", "submission", "organizer"]),
    registrationVerified: z.boolean(),
    sourceUrl: externalUrl,
    rulesUrl: externalUrl.nullable(),
    seasonYear: z.number().int().min(2000).max(2100).nullable().default(null),
    completedOn: calendarDate.nullable().default(null),
    resultsUrl: externalUrl.nullable().default(null),
    verifiedAt: timestamp,
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.completedOn &&
      (v.applicationState !== "closed" ||
        !v.resultsUrl ||
        v.seasonYear !== Number(v.completedOn.slice(0, 4)) ||
        v.completedOn > v.verifiedAt.slice(0, 10))
    )
      c.addIssue({
        code: "custom",
        message:
          "Mùa đã diễn ra cần năm, ngày kết thúc đã xác minh, nguồn tổng kết và trạng thái đóng đăng ký.",
      });
    if (v.registrationVerified && !v.registrationUrl)
      c.addIssue({
        code: "custom",
        message: "Thiếu link đăng ký đã kiểm tra.",
      });
    if (
      v.opensAt &&
      v.deadlineAt &&
      Date.parse(v.opensAt) > Date.parse(v.deadlineAt)
    )
      c.addIssue({ code: "custom", message: "Ngày mở sau ngày đóng." });
    if (v.deadlineAt && v.deadlineDate)
      c.addIssue({
        code: "custom",
        message:
          "Dùng deadlineAt khi biết giờ; deadlineDate khi chỉ biết ngày.",
      });
  });
export type Competition = z.infer<typeof competitionSchema>;
export type StoredCompetition = Competition & { hidden: boolean };
export type CompetitionSnapshot = {
  revision: number;
  updatedAt: string | null;
  entries: StoredCompetition[];
};
export const batchSchema = z
  .object({
    expectedRevision: z.number().int().min(0),
    entries: z.array(competitionSchema).min(1).max(80),
    note: text(500),
  })
  .strict()
  .superRefine((b, c) => {
    if (new Set(b.entries.map((v) => v.id)).size !== b.entries.length)
      c.addIssue({
        code: "custom",
        message: "Trùng mã cuộc thi trong một lần cập nhật.",
      });
  });
export function validateVerificationDates(
  entries: Competition[],
  now = Date.now(),
) {
  for (const entry of entries)
    if (Date.parse(entry.verifiedAt) > now + 60_000)
      throw new Error("Không được ghi ngày xác minh trong tương lai.");
}
export function competitionStatus(
  c: Competition,
  now = Date.now(),
): "open" | "upcoming" | "needs_check" | "closed" {
  const exact = c.deadlineAt ? Date.parse(c.deadlineAt) : null;
  const day = c.deadlineDate ? Date.parse(c.deadlineDate + "T00:00:00Z") : null;
  // Date-only sources do not establish a timezone or closing hour. Never promise
  // availability during the deadline day; after the latest AoE boundary it is closed.
  if (
    c.applicationState === "closed" ||
    (exact !== null && now > exact) ||
    (day !== null && now >= day + 36 * 3600_000)
  )
    return "closed";
  if (now - Date.parse(c.verifiedAt) >= 14 * 86400_000) return "needs_check";
  if (c.opensAt && now < Date.parse(c.opensAt)) return "upcoming";
  if (day !== null && now >= day - 12 * 3600_000) return "needs_check";
  if (c.applicationState === "upcoming") return "upcoming";
  if (
    c.applicationState !== "open" ||
    !c.registrationUrl ||
    !c.registrationVerified
  )
    return "needs_check";
  return "open";
}
export function presentCompetitions(
  snapshot: CompetitionSnapshot,
  includeHidden = false,
  now = Date.now(),
) {
  const rank = { open: 0, upcoming: 1, needs_check: 2, closed: 3 };
  const items = snapshot.entries
    .filter((c) => includeHidden || !c.hidden)
    .map(({ hidden, ...c }) => ({
      ...c,
      seasonYear: c.seasonYear ?? null,
      completedOn: c.completedOn ?? null,
      resultsUrl: c.resultsUrl ?? null,
      ...(includeHidden ? { hidden } : {}),
      status: competitionStatus(c, now),
      stale: now - Date.parse(c.verifiedAt) >= 14 * 86400_000,
    }))
    .sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        (a.completedOn && b.completedOn
          ? b.completedOn.localeCompare(a.completedOn)
          : Number(!!a.completedOn) - Number(!!b.completedOn)) ||
        Date.parse(a.deadlineAt || a.deadlineDate || "9999-12-31") -
          Date.parse(b.deadlineAt || b.deadlineDate || "9999-12-31") ||
        a.title.localeCompare(b.title, "vi"),
    );
  return {
    items,
    revision: snapshot.revision,
    checkedAt: snapshot.updatedAt,
    intervalDays: 14,
    nextReviewAt: snapshot.updatedAt
      ? new Date(Date.parse(snapshot.updatedAt) + 14 * 86400_000).toISOString()
      : null,
    stale:
      !snapshot.updatedAt ||
      now - Date.parse(snapshot.updatedAt) >= 14 * 86400_000,
    counts: {
      open: items.filter((c) => c.status === "open").length,
      upcoming: items.filter((c) => c.status === "upcoming").length,
      needs_check: items.filter((c) => c.status === "needs_check").length,
      closed: items.filter((c) => c.status === "closed").length,
    },
    completedCount: items.filter((c) => c.completedOn).length,
  };
}
