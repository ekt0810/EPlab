"use client";
import { levelLabels, formatLabels, progressLabel } from "../lib/subjects";
export function LessonBadges({
  lesson: l,
  personal = false,
}: {
  lesson: any;
  personal?: boolean;
}) {
  return (
    <div className="lesson-badges">
      <span
        className={
          "badge " + (l.status === "published" ? "published" : "draft")
        }
      >
        {l.status === "published"
          ? "Đã xuất bản"
          : l.publication === "upcoming"
            ? "Sắp ra mắt"
            : "Bản nháp · Chỉ chủ trì"}
      </span>
      <span className={"badge " + (l.preview ? "free" : "member")}>
        {l.audience === "host"
          ? "Chỉ người chủ trì"
          : l.preview
            ? "Miễn phí"
            : l.accessible
              ? "Đã có quyền học"
              : "Cần được duyệt tham gia Lab"}
      </span>
      {personal && l.status === "published" && (
        <span className="badge progress-badge">{progressLabel(l)}</span>
      )}
    </div>
  );
}
export function LessonFacts({ lesson: l }: { lesson: any }) {
  return (
    <dl className="lesson-facts">
      <div>
        <dt>Cấp độ</dt>
        <dd>{levelLabels[l.level] || "Cơ bản"}</dd>
      </div>
      <div>
        <dt>Hình thức</dt>
        <dd>{formatLabels[l.format] || "Bài đọc"}</dd>
      </div>
      {l.duration_minutes && (
        <div>
          <dt>Thời lượng</dt>
          <dd>{l.duration_minutes} phút</dd>
        </div>
      )}
    </dl>
  );
}
