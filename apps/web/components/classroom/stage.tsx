"use client";
import {
  CheckCircle2,
  Clipboard,
  Flag,
  Lightbulb,
  ListChecks,
} from "lucide-react";
import { useState } from "react";
import type { Lesson } from "./types";
export type Scene = {
  kind: "intro" | "concept" | "example" | "practice" | "quiz";
  title: string;
  body?: string;
};
export function makeScenes(l: Lesson): Scene[] {
  return [
    { kind: "intro", title: "Bắt đầu từ mục tiêu" },
    ...l.concepts.map(([title, body]) => ({
      kind: "concept" as const,
      title,
      body,
    })),
    ...(l.example
      ? [
          {
            kind: "example" as const,
            title: l.example.title,
            body: l.example.body,
          },
        ]
      : []),
    { kind: "practice", title: "Đến lượt bạn thực hành" },
    { kind: "quiz", title: "Kiểm tra điều đã hiểu" },
  ];
}
export function ClassroomStage({
  lesson,
  scene,
  checklist,
  onCheck,
  answer,
  setAnswer,
  result,
  onQuiz,
  busy,
  signedIn,
}: {
  lesson: Lesson;
  scene: Scene;
  checklist: number[];
  onCheck: (index: number) => void;
  answer: number | null;
  setAnswer: (n: number) => void;
  result: { correct: boolean; explanation: string } | null;
  onQuiz: () => void;
  busy: boolean;
  signedIn: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <article className="cr-slide" aria-label="Nội dung bài giảng">
      <div className="cr-slide-top">
        <span>
          {scene.kind === "quiz"
            ? "TỰ KIỂM"
            : scene.kind === "practice"
              ? "THỰC HÀNH"
              : scene.kind === "intro"
                ? "MỤC TIÊU"
                : "BÀI GIẢNG"}
        </span>
        <span>EP LAB / {lesson.id.toUpperCase()}</span>
      </div>
      <h1>{scene.title}</h1>
      {scene.kind === "intro" && (
        <>
          <p className="cr-slide-lead">{lesson.summary}</p>
          <div className="cr-objectives">
            {lesson.objectives.map((o, i) => (
              <div key={o}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{o}</p>
              </div>
            ))}
          </div>
          <div className="cr-callout">
            <Lightbulb size={20} />
            <div>
              <strong>Chuẩn bị trước khi học</strong>
              <p>{lesson.prerequisites.join(" ")}</p>
            </div>
          </div>
          <p className="cr-small">
            {lesson.minutes} phút dự kiến cho đọc và thực hành. Bạn có thể chia
            thành nhiều buổi.
          </p>
        </>
      )}
      {scene.kind === "concept" && (
        <>
          <p className="cr-concept-body">{scene.body}</p>
          <div className="cr-callout">
            <Lightbulb size={21} />
            <div>
              <strong>Dừng một chút để tự giải thích</strong>
              <p>{lesson.discussion}</p>
            </div>
          </div>
          <div className="cr-stage-rule">
            <span>ĐỌC</span>
            <i />
            <span>GIẢI THÍCH</span>
            <i />
            <span>KIỂM CHỨNG</span>
          </div>
        </>
      )}
      {scene.kind === "example" && (
        <>
          <p className="cr-concept-body">{scene.body}</p>
          {lesson.example?.rows && (
            <div className="cr-table-wrap">
              <table>
                <tbody>
                  {lesson.example.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) =>
                        i === 0 ? (
                          <th key={j}>{cell}</th>
                        ) : (
                          <td key={j}>{cell}</td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {lesson.code && (scene.kind === "example" || scene.kind === "intro") && (
        <div className="cr-code">
          <header>
            <span>C · Ví dụ EP LAB</span>
            <button
              aria-label="Sao chép mã ví dụ"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(lesson.code!);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              <Clipboard size={14} />
              {copied ? "Đã chép" : "Sao chép"}
            </button>
          </header>
          <pre>
            <code>{lesson.code}</code>
          </pre>
          <small>
            Mã minh họa; đọc hợp đồng và tự chạy trong toolchain phù hợp.
          </small>
        </div>
      )}
      {scene.kind === "practice" && (
        <>
          <p className="cr-slide-lead">
            Tự thao tác và ghi bằng chứng trước khi đánh dấu từng bước.
          </p>
          <div className="cr-checklist">
            {lesson.steps.map((step, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={checklist.includes(i)}
                  onChange={() => onCheck(i)}
                />
                <span>
                  <b>Bước {i + 1}</b>
                  {step}
                </span>
              </label>
            ))}
          </div>
          <div className="cr-callout">
            <Flag size={21} />
            <div>
              <strong>Sản phẩm cần có</strong>
              <p>{lesson.deliverable}</p>
            </div>
          </div>
          <details>
            <summary>
              <ListChecks size={16} />
              Tiêu chí và lỗi cần kiểm
            </summary>
            <ul>
              {lesson.rubric.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <h3>Lỗi thường gặp</h3>
            <ul>
              {lesson.mistakes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </details>
        </>
      )}
      {scene.kind === "quiz" && (
        <>
          <p className="cr-quiz-question">{lesson.quiz.question}</p>
          <fieldset className="cr-answers">
            <legend className="cr-sr-only">Chọn một câu trả lời</legend>
            {lesson.quiz.options.map((o, i) => (
              <label key={i} className={answer === i ? "selected" : ""}>
                <input
                  name="classroom-quiz"
                  type="radio"
                  checked={answer === i}
                  onChange={() => setAnswer(i)}
                />
                <span>{String.fromCharCode(65 + i)}</span>
                <p>{o}</p>
              </label>
            ))}
          </fieldset>
          <button
            className="btn primary"
            disabled={answer === null || busy || !signedIn}
            onClick={onQuiz}
          >
            {busy ? "Đang kiểm tra…" : "Kiểm tra câu trả lời"}
          </button>
          {!signedIn && (
            <p className="cr-small">
              Đăng nhập để chấm câu trả lời và lưu tiến độ.
            </p>
          )}
          {result && (
            <div
              className={`cr-quiz-result ${result.correct ? "correct" : "retry"}`}
              role="status"
            >
              <strong>
                {result.correct
                  ? "Chính xác. Hãy giải thích lại bằng lời của bạn."
                  : "Chưa đúng. Xem lại nguyên lý rồi thử tiếp."}
              </strong>
              <p>{result.explanation}</p>
            </div>
          )}
          <div className="cr-callout">
            <CheckCircle2 size={20} />
            <p>
              Tự kiểm đánh giá kiến thức của bài. Sản phẩm thực hành được người
              chủ trì xem và chấm trong phòng thực hành.
            </p>
          </div>
        </>
      )}
      <div className="cr-slide-brand" aria-hidden="true">
        EP LAB
      </div>
    </article>
  );
}
