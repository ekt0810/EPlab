"use client";
import Link from "next/link";
import { usePracticeTrack } from "./practice-track";
export const statusLabels: Record<string, string> = {
  new: "Chưa nộp",
  pending_manual: "Đang chờ chấm",
  needs_revision: "Cần sửa bài",
  needs_review: "Cần thêm bằng chứng",
  visual_pass: "Đã đạt",
};
export const exerciseStatus = (e: any): string =>
  e.latest?.status ||
  (e.passed ? "visual_pass" : e.submitted ? "pending_manual" : "new");
export function PracticeNext({ exercises }: { exercises: any[] }) {
  const track = usePracticeTrack();
  const available = exercises.filter((e) => e.accessible);
  const revise = available.find((e) =>
    ["needs_revision", "needs_review"].includes(exerciseStatus(e)),
  );
  const next = available.find(
    (e) =>
      !e.passed &&
      exerciseStatus(e) === "new" &&
      e.prerequisites.every((id: string) =>
        exercises.some((p) => p.id === id && p.passed),
      ),
  );
  const waiting = available.find((e) => exerciseStatus(e) === "pending_manual");
  const item = revise || next || waiting || available.find((e) => !e.passed);
  if (!available.length) return null;
  return (
    <section className="panel practice-next" aria-label="Gợi ý bài tiếp theo">
      <div>
        <span className="eyebrow">VIỆC TIẾP THEO</span>
        <h2>
          {item
            ? `${item.id.toUpperCase()} · ${item.title}`
            : "Bạn đã đạt toàn bộ bài thực hành"}
        </h2>
        <p>
          {revise
            ? "Đọc nhận xét, sửa đúng phần còn thiếu rồi nộp phiên bản mới."
            : next
              ? "Ôn bài liên quan, làm theo đề và ghi lại từng ca tự kiểm tra."
              : waiting
                ? "Bài đã gửi đang chờ chấm. Bạn vẫn có thể ôn và làm các bài khác bên dưới."
                : item
                  ? "Ôn bài chuẩn bị trước khi bắt đầu; lộ trình là gợi ý, bạn vẫn có thể mở bài này."
                  : "Xem lại góp ý và thử hoàn thiện đồ án của bạn."}
        </p>
      </div>
      {item && (
        <Link
          className="btn primary"
          href={
            revise || (!next && waiting)
              ? `${track.base}/bai-nop/${item.latest.id}`
              : `${track.base}/thuc-hanh/${item.id}`
          }
        >
          {revise
            ? "Xem góp ý để sửa"
            : !next && waiting
              ? "Xem bài đang chờ chấm"
              : "Bắt đầu bài này"}{" "}
          →
        </Link>
      )}
    </section>
  );
}
