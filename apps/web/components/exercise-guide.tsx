"use client";
import Link from "next/link";
import { usePracticeTrack } from "./practice-track";
export function ExerciseGuide({ exercise: e }: { exercise: any }) {
  const track = usePracticeTrack();
  const kicadReading: Record<string, string> = {
    e01: "l01",
    e02: "l03",
    e03: "l04",
    e04: "l06",
    e05: "l07",
    e06: "l10",
    e07: "l11",
    e08: "l13",
    e09: "l14",
    e10: "l16",
    e11: "l19",
    e12: "l22",
  };
  const classroomLesson =
    track.id === "kicad"
      ? kicadReading[e.id]
      : /^[cs](0[1-9]|1[0-2])$/.test(e.id)
        ? e.id
        : null;
  return (
    <section className="exercise-guide">
      <Link
        className="btn secondary"
        href={`${track.base}/lop-hoc${classroomLesson ? "/" + classroomLesson : ""}`}
      >
        {classroomLesson
          ? `Ôn bài ${classroomLesson.toUpperCase()} trong lớp học`
          : "Mở giáo trình trong lớp học"}{" "}
        →
      </Link>
      {!!e.learn?.length && <h2>Kiến thức cần dùng</h2>}
      {e.learn?.map((s: string) => (
        <p key={s}>{s}</p>
      ))}
      {e.starter && (
        <>
          <h3>Giao diện hàm cần viết</h3>
          <pre>
            <code>{e.starter}</code>
          </pre>
        </>
      )}
    </section>
  );
}
export function ExerciseChecks({ exercise: e }: { exercise: any }) {
  if (!e.checks) return null;
  return (
    <section className="exercise-checks">
      <h2>Tự kiểm tra trước khi nộp</h2>
      <p>
        Thực hiện trên máy hoặc phần mềm của bạn, ghi kết quả thực tế và giải
        thích ca chưa đạt. Người chủ trì sẽ xem bằng chứng và chấm bài.
      </p>
      {e.checks.map(([input, expected]: string[], i: number) => (
        <article key={i}>
          <h3>Kiểm tra {i + 1}</h3>
          <p>
            <b>Thao tác / đầu vào:</b> {input}
          </p>
          <p>
            <b>Kết quả mong đợi:</b> {expected}
          </p>
        </article>
      ))}
    </section>
  );
}
