"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { subjects } from "../../lib/subjects";
import { ClassroomResources } from "./resources";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  Download,
  ExternalLink,
  Layers3,
  Play,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useApi } from "../../lib/api";
import { Loading, ErrorBox } from "../ui";
import {
  baseFor,
  plain,
  clock,
  type Track,
  type Course,
  type Source,
} from "./types";

export function ClassroomLibrary({ track }: { track: Track }) {
  const {
    data: course,
    loading,
    error,
    reload,
  } = useApi<Course>(`/api/classroom/${track}`);
  const params = useSearchParams(),
    router = useRouter();
  const subject = subjects.find((s) => s.id === track)!;
  const [query, setQuery] = useState(params.get("q") || ""),
    [level, setLevel] = useState(params.get("level") || "all"),
    [access, setAccess] = useState(
      params.get("access") === "free" ? "free" : "all",
    );
  const tab = params.get("tab") === "resources" ? "resources" : "course";
  function chooseTab(next: string) {
    const nextParams = new URLSearchParams(params.toString());
    if (next === "course") nextParams.delete("tab");
    else nextParams.set("tab", next);
    if (query) nextParams.set("q", query);
    else nextParams.delete("q");
    if (level !== "all") nextParams.set("level", level);
    else nextParams.delete("level");
    if (access === "free") nextParams.set("access", access);
    else nextParams.delete("access");
    router.push(
      `${baseFor(track)}/lop-hoc${nextParams.size ? "?" + nextParams.toString() : ""}`,
      { scroll: false },
    );
  }
  if (loading) return <Loading />;
  if (error || !course)
    return (
      <ErrorBox message={error || "Chưa tải được lớp học."} retry={reload} />
    );
  const lessons = course.lessons.filter(
    (l) =>
      plain(l.title + " " + l.summary).includes(plain(query)) &&
      (level === "all" || l.level === level) &&
      (access !== "free" || l.preview),
  );
  const completed = course.lessons.filter((l) => l.progress?.completed).length;
  const next =
    course.lessons.find((l) => l.accessible && !l.progress?.completed) ||
    course.lessons.find((l) => l.accessible);
  return (
    <div className="cr-library">
      <section className="cr-intro">
        <div>
          <div className="cr-eyebrow">
            <span className="cr-live-dot" /> EP LAB CLASSROOM{" "}
            <span>HỌC CÓ HƯỚNG DẪN</span>
          </div>
          <h1>{course.title}</h1>
          <p>{course.description}</p>
          <p className="cr-small">
            Chọn bài → đọc giáo trình → đặt câu hỏi → xem câu trả lời và video
            liên quan.
          </p>
          <div className="cr-metrics">
            <span>
              <BookOpen size={16} />
              {course.lessons.length} bài học
            </span>
            <span>
              <Layers3 size={16} />
              {course.modules.length} học phần
            </span>
            <span>
              <ShieldCheck size={16} />
              Nguồn đối chiếu {course.checkedAt.split("-").reverse().join("/")}
            </span>
          </div>
          <div className="button-row">
            {next ? (
              <Link
                className="btn primary"
                href={`${baseFor(track)}/lop-hoc/${next.id}`}
              >
                <Play size={16} />
                {completed ? "Tiếp tục lớp học" : "Vào lớp học"}
                <ArrowRight size={16} />
              </Link>
            ) : (
              <Link className="btn primary" href="/tham-gia-lab">
                Tham gia lớp học
              </Link>
            )}
            <button
              type="button"
              className="btn secondary"
              onClick={() => chooseTab("resources")}
            >
              <Download size={16} />
              Giáo trình PDF & video
            </button>
          </div>
        </div>
        <div className="cr-progress-card">
          <span>HÀNH TRÌNH CỦA BẠN</span>
          <strong>
            {completed}
            <small> / {course.lessons.length}</small>
          </strong>
          <p>bài đã hoàn thành</p>
          <progress value={completed} max={course.lessons.length} />
          <small>Hiểu kiến thức → tự thực hành → kiểm tra</small>
        </div>
      </section>
      <details className="panel cr-preparation">
        <summary>Chuẩn bị & cách học</summary>
        <p>
          <strong>Phù hợp với:</strong> {subject.audience}
        </p>
        <p>
          <strong>Kiến thức đầu vào:</strong> {subject.prerequisites}
        </p>
        <ul>
          {subject.tools.map((tool) => (
            <li key={tool}>{tool}</li>
          ))}
        </ul>
        <p>
          Học lần lượt theo các học phần dưới đây. Đặt câu hỏi ngay trong bài;
          phần Thực hành dùng để nộp sản phẩm và nhận nhận xét.
        </p>
      </details>
      <div className="cr-tabbar" role="tablist" aria-label="Nội dung lớp học">
        <button
          className={tab === "course" ? "active" : ""}
          role="tab"
          aria-selected={tab === "course"}
          onClick={() => chooseTab("course")}
        >
          Lộ trình học
        </button>
        <button
          className={tab === "resources" ? "active" : ""}
          role="tab"
          aria-selected={tab === "resources"}
          onClick={() => chooseTab("resources")}
        >
          Video & giáo trình PDF
        </button>
        <span>{course.version}</span>
      </div>
      {tab === "resources" ? (
        <ClassroomResources track={track} course={course} />
      ) : (
        <>
          <div className="cr-filters">
            <label>
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm chủ đề, kỹ năng…"
                aria-label="Tìm trong lớp học"
              />
            </label>
            <select
              aria-label="Lọc trình độ"
              value={level}
              onChange={(e) => setLevel(e.target.value)}
            >
              <option value="all">Tất cả trình độ</option>
              <option value="basic">Cơ bản</option>
              <option value="intermediate">Trung cấp</option>
              <option value="advanced">Nâng cao</option>
            </select>
            <select
              aria-label="Lọc quyền học"
              value={access}
              onChange={(e) => setAccess(e.target.value)}
            >
              <option value="all">Tất cả bài</option>
              <option value="free">Bài học thử</option>
            </select>
            <span>{lessons.length} bài phù hợp</span>
          </div>
          {!lessons.length && (
            <div className="cr-empty">
              Không có bài phù hợp. Thử từ khóa hoặc trình độ khác.
            </div>
          )}
          <div className="cr-modules">
            {course.modules.map((m) => {
              const items = lessons.filter((l) => l.module === m.id);
              if (!items.length) return null;
              return (
                <section key={m.id} className="cr-module">
                  <header>
                    <span>{String(m.id).padStart(2, "0")}</span>
                    <div>
                      <h2>{m.title}</h2>
                      <small>
                        {items.length} bài ·{" "}
                        {items.reduce((n, l) => n + l.minutes, 0)} phút học &
                        thực hành dự kiến
                      </small>
                    </div>
                  </header>
                  <div>
                    {items.map((l) => (
                      <Link
                        key={l.id}
                        href={`${baseFor(track)}/lop-hoc/${l.id}`}
                        className="cr-lesson-link"
                      >
                        <span
                          className={
                            l.progress?.completed
                              ? "cr-lesson-dot complete"
                              : "cr-lesson-dot"
                          }
                        >
                          {l.progress?.completed ? (
                            <Check size={14} />
                          ) : (
                            <Play size={12} />
                          )}
                        </span>
                        <div>
                          <strong>{l.title}</strong>
                          <small>
                            {l.preview ? "Học thử" : "Thành viên EP LAB"} ·{" "}
                            {l.id.toUpperCase()}
                          </small>
                        </div>
                        <span className="cr-time">
                          <Clock3 size={13} />
                          {l.minutes}′
                        </span>
                        <ArrowRight size={15} />
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
          <div className="cr-attribution">
            Thiết kế hoạt động học tham khảo{" "}
            <a
              href="https://github.com/THU-MAIC/OpenMAIC"
              target="_blank"
              rel="noreferrer"
            >
              OpenMAIC
            </a>
            . Bài giảng tiếng Việt và bài thực hành do EP LAB biên soạn. Video
            được dẫn từ tác giả gốc.
          </div>
        </>
      )}
    </div>
  );
}
