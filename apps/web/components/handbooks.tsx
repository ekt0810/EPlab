"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BookOpen, FileDown, ArrowRight, LockKeyhole } from "lucide-react";
import { useApi } from "../lib/api";
import { useAuth } from "./context";
import { Loading, ErrorBox, PageTitle } from "./ui";

export type Handbook = {
  category: string;
  title: string;
  courseSlug: string;
  practiceBase: string;
  lessonSlug: string;
  pages: number;
  version: string;
  accessible: boolean;
  resourceId: string | null;
  chapters: { id: string; title: string; page: number }[];
};
export function HandbookEntry({ category }: { category: string }) {
  const { data } = useApi<Handbook[]>("/api/handbooks");
  const book = data?.find((b) => b.category === category);
  if (!book) return null;
  return (
    <section className="panel practice-course-entry handbook-entry">
      <BookOpen size={30} />
      <div>
        <h2>Giáo trình người tham gia {book.title}</h2>
        <p>
          {book.pages} trang · 12 chương · Bài tập từ
          cơ bản đến nâng cao
        </p>
      </div>
      <Link className="btn primary" href={`/bai-hoc/${book.lessonSlug}`}>
        Đọc giáo trình <ArrowRight size={16} />
      </Link>
      <Link className="btn secondary" href={`/giao-trinh?mon=${book.category}`}>
        Xem mục lục
      </Link>
    </section>
  );
}
export function HandbookLibrary() {
  const { data, loading, error, reload } = useApi<Handbook[]>("/api/handbooks");
  const selected = useSearchParams().get("mon");
  const { user } = useAuth();
  return (
    <>
      <PageTitle
        eyebrow="TÀI LIỆU EP LAB"
        title="Giáo trình người tham gia"
        description="Ba giáo trình tiếng Việt. Đọc kiến thức, xem ví dụ, tự kiểm tra rồi chuyển sang bài thực hành cùng mã. Người chủ trì trực tiếp chấm và phản hồi."
      />
      <nav className="practice-nav" aria-label="Chọn giáo trình">
        <Link href="/giao-trinh" className={!selected ? "selected" : ""}>
          Tất cả
        </Link>
        {data?.map((b) => (
          <Link
            key={b.category}
            href={`/giao-trinh?mon=${b.category}`}
            className={selected === b.category ? "selected" : ""}
          >
            {b.title}
          </Link>
        ))}
      </nav>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : (
        <div className="handbook-grid">
          {data
            ?.filter((b) => !selected || b.category === selected)
            .map((book) => (
              <section
                className="panel handbook-card"
                key={book.category}
                data-handbook={book.category}
              >
                <div className="handbook-heading">
                  <BookOpen size={28} />
                  <span className="eyebrow">GIÁO TRÌNH</span>
                </div>
                <h2>{book.title}</h2>
                <p className="muted">
                  {book.pages} trang · 12 chương · 12 bài thực hành
                </p>
                <p>
                  {book.category === "kicad"
                    ? "Kết hợp giáo trình với video Phil’s Lab và 24 bài đọc trên web."
                    : book.category === "solidworks"
                      ? "Học qua giáo trình và thực hành trên SOLIDWORKS, có người chủ trì hướng dẫn."
                      : "Từ nền tảng C tới bộ đệm, giao thức, tác vụ định kỳ và firmware chịu lỗi."}
                </p>
                <div className="button-row">
                  {book.accessible && book.resourceId ? (
                    <>
                      <Link
                        className="btn primary"
                        href={`/bai-hoc/${book.lessonSlug}`}
                      >
                        Vào giáo trình <ArrowRight size={16} />
                      </Link>
                      <a
                        className="btn secondary"
                        href={`/api/files/${book.resourceId}`}
                      >
                        <FileDown size={16} />
                        Tải PDF
                      </a>
                    </>
                  ) : (
                    <Link
                      className="btn primary"
                      href={user ? "/tham-gia-lab" : "/dang-nhap"}
                    >
                      <LockKeyhole size={16} />
                      {user ? "Tham gia Lab" : "Đăng nhập để học"}
                    </Link>
                  )}
                </div>
                {!book.accessible && (
                  <p className="muted">
                    PDF đầy đủ dành cho tài khoản đã có quyền học; hai người chủ
                    trì truy cập miễn phí.
                  </p>
                )}
                <details className="handbook-contents">
                  <summary>Mục lục 12 chương</summary>
                  <ol>
                    {book.chapters.map((ch) => (
                      <li key={ch.id}>
                        <span>
                          <b>{ch.id.toUpperCase()}</b> {ch.title}
                        </span>
                        <small>Trang {ch.page}</small>
                      </li>
                    ))}
                  </ol>
                </details>
                <Link
                  className="handbook-practice"
                  href={`${book.practiceBase}/thuc-hanh`}
                >
                  Bài tập và nộp bài <ArrowRight size={16} />
                </Link>
              </section>
            ))}
        </div>
      )}
      <p className="practice-note">
        Mỗi trang PDF có chữ chìm EP lab. Câu hỏi tự kiểm hỗ trợ việc học; kết
        quả bài nộp do người chủ trì đánh giá.
      </p>
    </>
  );
}
