"use client";
import { usePracticeTrack, PracticeTrackTabs } from "./practice-track";
import Link from "next/link";
import { PracticeConversations } from "./practice-conversations";
import { useState } from "react";
import { useAuth } from "./context";
import { api, useApi, date } from "../lib/api";
import { Loading, ErrorBox, PageTitle, Notice, Empty } from "./ui";
import {
  ReviewForm,
  ReviewResult,
  SubmissionEvidence,
  reviewLabels,
} from "./practice-results";
export function PracticeAdmin() {
  const track = usePracticeTrack();
  const { user, loading: authLoading } = useAuth(),
    allowed = user?.role === "admin";
  const [tab, setTab] = useState("submissions"),
    [page, setPage] = useState(0),
    [selected, setSelected] = useState(""),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const submissions = useApi<any[]>(
      allowed ? `${track.adminApi}/submissions?page=${page}` : null,
    ),
    assignments = useApi<any[]>(
      allowed ? `${track.adminApi}/assignments` : null,
    ),
    students = useApi<any[]>(allowed ? "/api/admin/users" : null),
    exercises = useApi<any[]>(allowed ? `${track.api}/exercises` : null),
    detail = useApi(
      allowed && selected ? `${track.api}/submissions/${selected}` : null,
    );
  if (authLoading) return <Loading />;
  if (!allowed)
    return (
      <Empty
        title="Khu vực dành cho người chủ trì"
        description="Đăng nhập tài khoản quản trị để giao và chấm bài."
        href="/dang-nhap"
        label="Đăng nhập"
      />
    );
  return (
    <>
      <Link className="back-link" href="/quan-tri">
        ← Quản trị EP LAB
      </Link>
      <PageTitle
        eyebrow={`QUẢN TRỊ · ${track.label}`}
        title="Giao bài và chấm bài"
        description="Hai người chủ trì cùng xem bài nộp, chấm theo tiêu chí và lưu nhận xét. Lịch sử chấm được giữ để đối chiếu."
      />
      <PracticeTrackTabs admin />
      <div className="practice-nav">
        <button
          className={tab === "submissions" ? "selected" : ""}
          onClick={() => setTab("submissions")}
        >
          Chấm bài
        </button>
        <button
          className={tab === "assignments" ? "selected" : ""}
          onClick={() => setTab("assignments")}
        >
          Giao bài
        </button>
        <button
          className={tab === "conversations" ? "selected" : ""}
          onClick={() => setTab("conversations")}
        >
          Trao đổi
        </button>
      </div>
      {message && <Notice type="success">{message}</Notice>}
      {error && <Notice type="error">{error}</Notice>}
      {tab === "conversations" ? (
        <PracticeConversations host />
      ) : tab === "submissions" ? (
        <>
          {submissions.loading ? (
            <Loading />
          ) : submissions.error ? (
            <ErrorBox message={submissions.error} retry={submissions.reload} />
          ) : (
            <>
              <div className="panel practice-submission-list">
                {submissions.data?.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      setSelected(s.id);
                      setMessage("");
                    }}
                  >
                    <div>
                      <h3>
                        {exercises.data?.find((e) => e.id === s.exercise_id)
                          ?.title || s.exercise_id}
                      </h3>
                      <p>
                        {s.student_name} · {s.student_email} ·{" "}
                        {date(s.created_at)}
                      </p>
                    </div>
                    <span className="badge">{reviewLabels[s.status]}</span>
                    <b>
                      {s.result?.score != null
                        ? `${s.result.score}/100`
                        : "Chưa chấm"}
                    </b>
                  </button>
                ))}
                {!submissions.data?.length && (
                  <p>Chưa có bài nộp ở trang này.</p>
                )}
              </div>
              <div className="button-row">
                <button
                  className="btn secondary"
                  disabled={!page}
                  onClick={() => setPage(page - 1)}
                >
                  Trang trước
                </button>
                <span>Trang {page + 1}</span>
                <button
                  className="btn secondary"
                  disabled={(submissions.data?.length || 0) < 30}
                  onClick={() => setPage(page + 1)}
                >
                  Trang sau
                </button>
                <button className="btn secondary" onClick={submissions.reload}>
                  Làm mới danh sách
                </button>
              </div>
            </>
          )}
          {selected &&
            (detail.loading ? (
              <Loading />
            ) : detail.error ? (
              <ErrorBox message={detail.error} retry={detail.reload} />
            ) : (
              detail.data && (
                <div className="practice-layout">
                  <article className="panel practice-article">
                    <SubmissionEvidence submission={detail.data} />
                    <ReviewResult submission={detail.data} />
                    {detail.data.reviews.length > 0 && (
                      <details>
                        <summary>Lịch sử người chấm</summary>
                        {detail.data.reviews.map((r: any, i: number) => (
                          <div key={i}>
                            <b>
                              {r.reviewer} · {date(r.created_at)} ·{" "}
                              {r.result.score}/100
                            </b>
                            <p>{r.result.summary}</p>
                          </div>
                        ))}
                      </details>
                    )}
                  </article>
                  <aside className="panel practice-article">
                    <ReviewForm
                      key={`${selected}-${detail.data.revision}`}
                      submission={detail.data}
                      saved={() => {
                        setMessage("Đã lưu điểm và nhận xét.");
                        void detail.reload();
                        void submissions.reload();
                      }}
                    />
                    <button className="btn secondary" onClick={detail.reload}>
                      Tải lại bài và nhận xét
                    </button>
                  </aside>
                </div>
              )
            ))}
        </>
      ) : (
        <>
          <form
            className="panel stack practice-assignment-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setError("");
              setMessage("");
              const form = e.currentTarget,
                f = new FormData(form);
              try {
                await api(`${track.adminApi}/assignments`, "POST", {
                  exerciseId: f.get("exercise"),
                  studentId: f.get("student") || null,
                  instructions: f.get("instructions"),
                  dueAt: f.get("due")
                    ? new Date(String(f.get("due"))).toISOString()
                    : null,
                });
                setMessage("Đã giao bài cho người tham gia.");
                form.reset();
                await assignments.reload();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <h2>Giao bài thực hành</h2>
            <div className="form-grid">
              <label>
                Bài tập
                <select name="exercise" aria-label="Bài tập" required>
                  {exercises.data?.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.difficulty} · {e.id.toUpperCase()} · {e.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Giao cho
                <select name="student" aria-label="Giao cho">
                  <option value="">Cả lớp (người tham gia có quyền học)</option>
                  {students.data
                    ?.filter((s) => s.role === "student" && !s.blocked)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · {s.email}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <label>
              Yêu cầu bổ sung
              <textarea name="instructions" maxLength={3000} rows={4} />
            </label>
            <label>
              Hạn nộp (giờ trên máy của bạn, không bắt buộc)
              <input name="due" type="datetime-local" />
            </label>
            <button
              className="btn primary"
              disabled={busy || !exercises.data?.length}
            >
              {busy ? "Đang giao…" : "Giao bài cho người tham gia"}
            </button>
          </form>
          {assignments.loading ? (
            <Loading />
          ) : assignments.error ? (
            <ErrorBox message={assignments.error} retry={assignments.reload} />
          ) : (
            <div className="practice-grid">
              {assignments.data?.map((a) => (
                <article className="panel practice-assignment" key={a.id}>
                  <h3>{a.title}</h3>
                  <p>
                    {a.student_email || "Cả lớp"} · {a.submitted} lần nộp
                  </p>
                  <p className="preserve">{a.instructions}</p>
                  <p>
                    {a.due_at
                      ? `Hạn nộp: ${date(a.due_at)}`
                      : "Không đặt hạn nộp"}
                  </p>
                  <span className="badge">
                    {a.closed ? "Đã đóng" : "Đang nhận bài"}
                  </span>
                  <button
                    className="btn secondary"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        await api(
                          `${track.adminApi}/assignments/${a.id}`,
                          "PATCH",
                          { closed: !a.closed },
                        );
                        await assignments.reload();
                      } catch (e) {
                        setError((e as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {a.closed ? "Mở lại nhận bài" : "Đóng nhận bài"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
