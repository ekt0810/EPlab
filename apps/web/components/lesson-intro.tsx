"use client";
import Link from "next/link";
import { BookOpen, LockKeyhole, ChevronLeft, ChevronRight } from "lucide-react";
import { lessonHref } from "../lib/subjects";
import { LessonBadges, LessonFacts } from "./lesson-metadata";
export function LessonIntro({
  lesson: l,
  personal,
}: {
  lesson: any;
  personal: boolean;
}) {
  return (
    <section className="panel lesson-public-intro">
      <span className="eyebrow">{l.chapter_title}</span>
      <h1>{l.title}</h1>
      <LessonBadges lesson={l} personal={personal} />
      {l.summary && <p>{l.summary}</p>}
      <div className="lesson-goal">
        <h2>Mục tiêu học tập</h2>
        <p>
          {l.objectives ||
            "Người chủ trì đang cập nhật mục tiêu cụ thể cho bài này."}
        </p>
      </div>
      <LessonFacts lesson={l} />
      <p>
        <b>Kiến thức cần chuẩn bị:</b>{" "}
        {l.prerequisites ||
          "Học các bài trước trong chương; xem phần chuẩn bị ở mục Chuẩn bị trong lớp học."}
      </p>
      <p className="muted">
        Tác giả: {l.author} · {l.language}
      </p>
    </section>
  );
}
export function LessonOutline({
  course,
  current,
}: {
  course: any;
  current: string;
}) {
  return (
    <aside className="lesson-outline panel">
      <div className="outline-title">
        <BookOpen size={20} />
        <strong>Mục lục môn học</strong>
      </div>
      {course?.chapters.map((ch: any) => (
        <div key={ch.id}>
          <h3>{ch.title}</h3>
          {ch.lessons.map((l: any) => (
            <Link
              key={l.id}
              href={lessonHref(course.category, l.slug)}
              className={l.slug === current ? "current" : ""}
              aria-current={l.slug === current ? "page" : undefined}
            >
              {l.accessible ? (
                <BookOpen size={18} />
              ) : (
                <LockKeyhole size={18} />
              )}
              <span>
                {l.title}
                <small>
                  {l.status !== "published"
                    ? l.publication === "upcoming"
                      ? "Sắp ra mắt"
                      : "Bản nháp"
                    : l.preview
                      ? "Miễn phí"
                      : l.accessible
                        ? "Đã có quyền học"
                        : "Cần được duyệt tham gia Lab"}
                </small>
              </span>
            </Link>
          ))}
        </div>
      ))}
    </aside>
  );
}
export function LessonPager({
  course,
  current,
}: {
  course: any;
  current: string;
}) {
  const lessons = course?.chapters.flatMap((ch: any) => ch.lessons) || [];
  const index = lessons.findIndex((l: any) => l.slug === current),
    previous = lessons[index - 1],
    next = lessons[index + 1];
  return (
    <nav className="lesson-pager" aria-label="Bài trước và bài tiếp theo">
      {previous && (
        <Link
          className="btn secondary"
          href={lessonHref(course.category, previous.slug)}
        >
          <ChevronLeft size={18} />
          <span>
            <small>Bài trước</small>
            {previous.title}
          </span>
        </Link>
      )}
      {next && (
        <Link
          className="btn secondary"
          href={lessonHref(course.category, next.slug)}
        >
          <span>
            <small>Bài tiếp theo</small>
            {next.title}
          </span>
          <ChevronRight size={18} />
        </Link>
      )}
    </nav>
  );
}
