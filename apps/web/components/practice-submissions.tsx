"use client";
import { usePracticeTrack } from "./practice-track";
import Link from "next/link";
import { useAuth } from "./context";
import { useApi, date } from "../lib/api";
import { Loading, ErrorBox, PageTitle, Empty } from "./ui";
import { PracticeNav } from "./practice-nav";
import {
  ReviewResult,
  SubmissionEvidence,
  reviewLabels,
} from "./practice-results";
export function MySubmissions() {
  const track = usePracticeTrack();
  const { user, loading: authLoading } = useAuth(),
    list = useApi<any[]>(user ? `${track.api}/submissions` : null),
    exercises = useApi<any[]>(`${track.api}/exercises`);
  if (authLoading) return <Loading />;
  if (!user)
    return (
      <Empty
        title="Đăng nhập để xem bài nộp"
        description="Bài làm và nhận xét được lưu riêng theo tài khoản."
        href="/dang-nhap"
        label="Đăng nhập"
      />
    );
  return (
    <>
      <PageTitle
        eyebrow={`${track.label} · HỒ SƠ THỰC HÀNH`}
        title="Bài nộp của tôi"
        description="Xem lại mỗi lần nộp, điểm và nhận xét của người chủ trì."
      />
      <PracticeNav />
      <button className="btn secondary" onClick={list.reload}>
        Làm mới kết quả
      </button>
      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : list.data?.length ? (
        <div className="panel practice-submission-list">
          {list.data.map((s) => (
            <Link key={s.id} href={`${track.base}/bai-nop/${s.id}`}>
              <div>
                <h3>
                  {exercises.data?.find((e) => e.id === s.exercise_id)?.title ||
                    s.exercise_id}
                </h3>
                <p>{date(s.created_at)}</p>
              </div>
              <span className="badge">{reviewLabels[s.status]}</span>
              <strong>
                {s.result?.score != null ? `${s.result.score}/100` : "—"}
              </strong>
            </Link>
          ))}
        </div>
      ) : (
        <Empty
          title="Bạn chưa nộp bài thực hành"
          description="Chọn một bài và thực hiện theo tiêu chí."
          href={`${track.base}/thuc-hanh`}
          label="Chọn bài thực hành"
        />
      )}
    </>
  );
}
export function SubmissionDetail({ id }: { id: string }) {
  const track = usePracticeTrack();
  const { data, error, loading, reload } = useApi(
    `${track.api}/submissions/${id}`,
  );
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  return (
    <>
      <PracticeNav />
      <Link className="back-link" href={`${track.base}/bai-nop`}>
        ← Bài nộp của tôi
      </Link>
      <div className="panel practice-article">
        <SubmissionEvidence submission={data} />
        <ReviewResult submission={data} />
        <Link
          className="btn secondary"
          href={`${track.base}/trao-doi?exercise=${data.exercise_id}`}
        >
          Trao đổi về bài và nhận xét
        </Link>
        <button className="btn secondary" onClick={reload}>
          Làm mới nhận xét
        </button>
        <Link
          className="btn primary"
          href={`${track.base}/thuc-hanh/${data.exercise_id}${data.assignment_id ? `?assignment=${data.assignment_id}` : ""}`}
        >
          Nộp phiên bản đã sửa
        </Link>
        {data.reviews.length > 1 && (
          <details>
            <summary>Lịch sử chấm · {data.reviews.length} lần</summary>
            {data.reviews.map((r: any, i: number) => (
              <div className="practice-review-history" key={i}>
                <b>
                  {r.reviewer} · {date(r.created_at)} · {r.result.score}/100
                </b>
                <p>{r.result.summary}</p>
              </div>
            ))}
          </details>
        )}
      </div>
    </>
  );
}
export function MyAssignments() {
  const track = usePracticeTrack();
  const { user, loading: authLoading } = useAuth(),
    list = useApi<any[]>(user ? `${track.api}/assignments` : null);
  if (authLoading) return <Loading />;
  if (!user)
    return (
      <Empty
        title="Đăng nhập để xem bài được giao"
        description="Người chủ trì có thể giao riêng hoặc giao cho cả lớp."
        href="/dang-nhap"
        label="Đăng nhập"
      />
    );
  return (
    <>
      <PageTitle
        eyebrow={`${track.label} · LỚP HỌC`}
        title="Bài người chủ trì giao"
        description="Đọc yêu cầu, xem hạn nộp và mở đúng đề bài để gửi bài làm."
      />
      <PracticeNav />
      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : list.data?.length ? (
        <div className="practice-grid">
          {list.data.map((a) => (
            <article className="panel practice-assignment" key={a.id}>
              <span className="eyebrow">
                {a.student_id ? "GIAO RIÊNG" : "CẢ LỚP"} ·{" "}
                {a.closed ? "ĐÃ ĐÓNG" : "ĐANG NHẬN BÀI"}
              </span>
              <h2>{a.title}</h2>
              <p className="preserve">{a.instructions}</p>
              <p>
                {a.due_at ? `Hạn nộp: ${date(a.due_at)}` : "Không đặt hạn nộp"}
              </p>
              <p>Đã nộp {a.submitted} lần</p>
              <Link
                className="btn secondary"
                href={`${track.base}/thuc-hanh/${a.exercise_id}?assignment=${a.id}`}
              >
                Xem đề bài
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title="Chưa có bài được giao"
          description={`Bạn vẫn có thể tự chọn ${track.count} bài thực hành.`}
          href={`${track.base}/thuc-hanh`}
          label="Vào phòng thực hành"
        />
      )}
    </>
  );
}
