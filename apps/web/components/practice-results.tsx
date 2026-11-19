"use client";
import { usePracticeTrack } from "./practice-track";
import { useState } from "react";
import { api, date } from "../lib/api";
import { selfCheckLabels } from "./practice-self-checks";
import { Notice } from "./ui";
export const reviewLabels: Record<string, string> = {
  pending_manual: "Chờ người chủ trì chấm",
  needs_review: "Cần thêm bằng chứng",
  visual_pass: "Đạt tiêu chí bài nộp",
  needs_revision: "Cần sửa bài",
};
export function ReviewResult({ submission: s }: { submission: any }) {
  return (
    <section className="practice-result">
      <div className="section-heading">
        <h2>Nhận xét của người chủ trì</h2>
        <span className="badge">{reviewLabels[s.status] || s.status}</span>
      </div>
      {s.result ? (
        <>
          <div className="practice-score">
            <strong>
              {s.result.score}
              <small>/100</small>
            </strong>
            <p>{s.result.summary}</p>
          </div>
          {s.result.criteria.map((c: any) => (
            <div className={`practice-criterion ${c.status}`} key={c.id}>
              <b>
                {c.id.toUpperCase()} ·{" "}
                {c.status === "met"
                  ? "Đạt"
                  : c.status === "not_met"
                    ? "Cần sửa"
                    : "Chưa đủ bằng chứng"}
              </b>
              <p>{c.evidence}</p>
              {c.action && (
                <p>
                  <b>Việc cần làm:</b> {c.action}
                </p>
              )}
            </div>
          ))}
          <p className="muted">{s.result.scope}</p>
        </>
      ) : (
        <p>
          Bài đã được lưu. Hai người chủ trì EP LAB sẽ xem và chấm theo bảng
          tiêu chí.
        </p>
      )}
    </section>
  );
}
export function SubmissionEvidence({ submission: s }: { submission: any }) {
  const track = usePracticeTrack();
  return (
    <>
      <h2>{s.rubric.title}</h2>
      {s.attachments?.length > 0 && (
        <section className="practice-files">
          <h3>Tệp bài làm</h3>
          <p>
            Tải tệp để xem trong công cụ của bạn. Website không tự biên dịch mã
            hoặc kiểm định file CAD.
          </p>
          {s.attachments.map((f: any, i: number) => (
            <a
              className="btn secondary"
              key={i}
              href={`${track.api}/submissions/${s.id}/files/${i}`}
            >
              Tải {f.name} · {(f.size / 1024).toFixed(1)} KB
            </a>
          ))}
        </section>
      )}
      <p className="muted">
        {s.student_name} · {date(s.created_at)}
      </p>
      <p className="preserve">{s.notes}</p>
      {!!s.self_checks?.length && (
        <section className="submission-self-checks">
          <h3>Tự kiểm tra do người học ghi nhận</h3>
          <p className="muted">
            Đây là kết quả tự báo cáo, chưa phải kết luận của người chấm.
          </p>
          {s.self_checks.map((c: any) => (
            <article key={c.index}>
              <b>
                Kiểm tra {c.index + 1} ·{" "}
                {selfCheckLabels[c.status as keyof typeof selfCheckLabels]}
              </b>
              <p>{s.rubric.checks?.[c.index]?.[0]}</p>
              <p>Kết quả mong đợi: {s.rubric.checks?.[c.index]?.[1]}</p>
              <p className="preserve">
                {c.observed || "Chưa ghi nhận kết quả."}
              </p>
            </article>
          ))}
        </section>
      )}
      <div className="practice-images">
        {Array.from({ length: s.image_count }, (_, i) => (
          <a
            key={i}
            href={`${track.api}/submissions/${s.id}/images/${i}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <img
              src={`${track.api}/submissions/${s.id}/images/${i}`}
              alt={`Ảnh bài làm ${i + 1}`}
            />
            <span>Mở ảnh {i + 1}</span>
          </a>
        ))}
      </div>
      {s.report && (
        <details className="practice-report">
          <summary>
            ERC/DRC: {s.report.errors} lỗi · {s.report.warnings} cảnh báo ·{" "}
            {s.report.total} mục
          </summary>
          <p>{s.report.provenance}</p>
          <p>Phiên bản KiCad: {s.report.version}</p>
          <pre>{s.report.raw}</pre>
        </details>
      )}
      <h3>Bảng tiêu chí khi nộp bài</h3>
      <div className="practice-rubric">
        {s.rubric.criteria.map((c: any) => (
          <div key={c.id}>
            <b>{c.id.toUpperCase()}</b>
            <p>{c.text}</p>
            <span>{c.points}đ</span>
          </div>
        ))}
      </div>
    </>
  );
}
export function ReviewForm({
  submission: s,
  saved,
}: {
  submission: any;
  saved: () => void;
}) {
  const track = usePracticeTrack();
  const [criteria, setCriteria] = useState<any[]>(
      s.rubric.criteria.map((c: any) => ({
        ...c,
        status:
          s.result?.criteria.find((r: any) => r.id === c.id)?.status ||
          "unclear",
        evidence:
          s.result?.criteria.find((r: any) => r.id === c.id)?.evidence || "",
        action:
          s.result?.criteria.find((r: any) => r.id === c.id)?.action || "",
      })),
    ),
    [summary, setSummary] = useState(s.result?.summary || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const set = (i: number, key: string, value: string) =>
    setCriteria((old) =>
      old.map((c, j) => (j === i ? { ...c, [key]: value } : c)),
    );
  return (
    <form
      className="stack practice-review-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await api(`${track.adminApi}/submissions/${s.id}/review`, "POST", {
            revision: s.revision,
            summary,
            criteria: criteria.map(({ id, status, evidence, action }) => ({
              id,
              status,
              evidence,
              action,
            })),
          });
          saved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>Chấm bài thủ công</h2>
      <p>
        Chọn kết quả và ghi bằng chứng cho từng tiêu chí. Điểm được tính theo
        bảng tiêu chí.
      </p>
      {criteria.map((c, i) => (
        <fieldset key={c.id}>
          <legend>
            {c.id.toUpperCase()} · {c.points} điểm
          </legend>
          <p>{c.text}</p>
          <label>
            Kết quả {c.id.toUpperCase()}
            <select
              aria-label={`Kết quả ${c.id.toUpperCase()}`}
              value={c.status}
              onChange={(e) => set(i, "status", e.target.value)}
            >
              <option value="unclear">Chưa đủ bằng chứng</option>
              <option value="met">Đạt</option>
              <option value="not_met">Cần sửa</option>
            </select>
          </label>
          <label>
            Nhận xét {c.id.toUpperCase()}
            <textarea
              required
              maxLength={1500}
              value={c.evidence}
              onChange={(e) => set(i, "evidence", e.target.value)}
            />
          </label>
          <label>
            Hướng sửa {c.id.toUpperCase()}
            <textarea
              maxLength={1500}
              value={c.action}
              onChange={(e) => set(i, "action", e.target.value)}
            />
          </label>
        </fieldset>
      ))}
      <label>
        Nhận xét chung
        <textarea
          required
          minLength={5}
          maxLength={2000}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </label>
      <p className="practice-score-preview">
        Điểm theo tiêu chí đã chọn:{" "}
        <b>
          {criteria.reduce(
            (n, c) => n + (c.status === "met" ? c.points : 0),
            0,
          )}
          /100
        </b>
      </p>
      {error && <Notice type="error">{error}</Notice>}
      <button className="btn primary" disabled={busy}>
        {busy ? "Đang lưu…" : "Lưu điểm và nhận xét"}
      </button>
    </form>
  );
}
