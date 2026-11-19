"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, BookOpen, FlaskConical, Files } from "lucide-react";
import { subjects } from "../lib/subjects";
import { useApi } from "../lib/api";
import { CourseArt } from "./catalog";
import { Loading, ErrorBox, Empty } from "./ui";
import { useAuth } from "./context";
import { baseFor, plain, type Track } from "./classroom/types";

type ClassroomSummary = {
  track: Track;
  title: string;
  description: string;
  version: string;
  lessonCount: number;
  moduleCount: number;
  previews: { id: string; title: string; minutes: number }[];
};
export function SubjectHome({ previews = false }: { previews?: boolean }) {
  const { data, loading, error, reload } =
    useApi<ClassroomSummary[]>("/api/classroom");
  const { user } = useAuth(),
    params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || ""),
    [filter, setFilter] = useState("all");
  const visible = (data || []).filter(
    (c) =>
      (filter === "all" || filter === c.track) &&
      plain(
        c.title +
          " " +
          c.description +
          " " +
          c.previews.map((l) => l.title).join(" "),
      ).includes(plain(query)),
  );
  return (
    <>
      <div className="hub-home-title">
        <span className="eyebrow">KHÔNG GIAN HỌC TẬP EP LAB</span>
        <h1>{previews ? "Học thử trong lớp học" : "Chọn môn bạn muốn học"}</h1>
        <p>
          Bài giảng, hỏi đáp, video và giáo trình PDF nằm chung trong Lớp học.
          Sang Thực hành để làm bài, nộp sản phẩm và nhận góp ý.
        </p>
        {!user && !previews && (
          <div className="button-row">
            <Link className="btn primary" href="/dang-ky">
              Tạo tài khoản miễn phí
            </Link>
            <Link className="btn secondary" href="/hoc-thu">
              Xem bài miễn phí
            </Link>
          </div>
        )}
      </div>
      <div className="cr-filters">
        <label>
          <BookOpen size={17} />
          <input
            aria-label="Tìm môn hoặc bài học thử"
            placeholder="Tìm môn hoặc bài học thử…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Lọc môn học"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Tất cả môn</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.short}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : !visible.length ? (
        <Empty
          title="Chưa tìm thấy nội dung"
          description="Thử từ khóa khác hoặc chọn tất cả môn."
        />
      ) : (
        <div className="hub-home-grid">
          {visible.map((c) => (
            <article className="hub-subject-card panel" key={c.track}>
              <CourseArt type={c.track} />
              <div className="hub-subject-body">
                <h2>
                  <Link href={baseFor(c.track) + "/lop-hoc"}>{c.title}</Link>
                </h2>
                <p>{c.description}</p>
                <p className="muted">
                  {c.lessonCount} bài trong giáo trình · {c.moduleCount} học
                  phần · {c.previews.length} bài học thử
                </p>
                {previews ? (
                  <ul className="cr-trial-list">
                    {c.previews.map((l) => (
                      <li key={l.id}>
                        <Link href={`${baseFor(c.track)}/lop-hoc/${l.id}`}>
                          {l.title}
                          <ArrowRight size={16} />
                        </Link>
                        <small>{l.minutes} phút dự kiến</small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Link
                    className="btn primary"
                    href={baseFor(c.track) + "/lop-hoc"}
                  >
                    Vào lớp học <ArrowRight size={18} />
                  </Link>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      {!previews && (
        <>
          <section className="panel competition-entry">
            <div>
              <h2>Cuộc thi Embedded cho sinh viên</h2>
              <p>
                Điều kiện tham gia, lịch nhận hồ sơ và link đăng ký chính thức.
              </p>
            </div>
            <Link className="btn secondary" href="/cuoc-thi">
              Xem các cuộc thi <ArrowRight size={18} />
            </Link>
          </section>
          <section className="panel hub-how">
            <h2>Một đường học rõ ràng</h2>
            <div>
              <span>
                <BookOpen />
                Chọn bài trong giáo trình mới
              </span>
              <span>
                <Files />
                Hỏi đáp và xem video ngay trong lớp học
              </span>
              <span>
                <FlaskConical />
                Thực hành, nộp bài và nhận góp ý
              </span>
            </div>
            <p>
              Tạo tài khoản miễn phí để lưu tiến độ. Gửi yêu cầu tham gia Lab để
              học đầy đủ cả ba môn và được hỗ trợ.{" "}
              <Link href="/tham-gia-lab">Tham gia Lab →</Link>
            </p>
          </section>
        </>
      )}
    </>
  );
}
