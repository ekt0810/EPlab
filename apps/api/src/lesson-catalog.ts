import { canLearn, hasAdminAccess, type Actor } from "./security.js";

// Only this allowlist may be returned before content authorization.
export function lessonSummary(l: any, actor: Actor | null) {
  return {
    id: l.id,
    slug: l.slug,
    title: l.title,
    summary: l.summary,
    objectives: l.objectives,
    prerequisites: l.prerequisites,
    chapter_id: l.chapter_id,
    chapter_title: l.chapter_title,
    course_slug: l.course_slug,
    course_title: l.course_title,
    category: l.category,
    position: l.position,
    duration_minutes: l.duration_minutes,
    level: l.level,
    status: l.status,
    preview: l.preview,
    publication:
      l.status === "published" ? "published" : l.listed ? "upcoming" : "draft",
    format: l.document_resource_id
      ? "document"
      : l.video_url
        ? "video"
        : "reading",
    author: l.author,
    language: l.language,
    software_version: l.software_version,
    audience: l.audience,
    accessible: canLearn(actor, l),
    progress:
      actor && l.progress_updated_at
        ? { completed: l.completed, updated_at: l.progress_updated_at }
        : null,
  };
}
export function canSeeSummary(l: any, actor: Actor | null) {
  return (
    hasAdminAccess(actor) ||
    (l.course_status === "published" &&
      l.audience !== "host" &&
      (l.status === "published" || l.listed))
  );
}
