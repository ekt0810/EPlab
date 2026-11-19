"use client";
import Link from "next/link";
import { BookOpen, FileDown, ExternalLink, GraduationCap } from "lucide-react";
import { categories } from "../lib/api";
export function DocumentLesson({ lesson }: { lesson: any }) {
  const pdf = lesson.resources.find(
    (r: any) => r.id === lesson.document_resource_id,
  );
  const start = lesson.document_page_start || 1;
  const book = lesson.handbook;
  const pages = book?.pages || lesson.document_page_end || 50;
  return (
    <section className="document-card" aria-label="Học theo giáo trình">
      <div className="document-mark">
        <BookOpen size={48} />
        <strong>EP LAB</strong>
        <span>{categories[lesson.category]?.short || "EP LAB"}</span>
      </div>
      <div className="document-details">
        <span className="eyebrow">GIÁO TRÌNH & THỰC HÀNH</span>
        <h2>
          {pdf
            ? "Đọc giáo trình, thực hành cùng người chủ trì"
            : "Học theo giáo trình EP LAB"}
        </h2>
        <p>
          {book
            ? `Giáo trình ${book.title}. Đọc ví dụ, thực hành và tự kiểm tra trước khi nộp bài cho người chủ trì.`
            : lesson.audience === "host" ? "Tài liệu nội bộ để tổ chức buổi học, giao bài và chấm thủ công."
            : `Người chủ trì trực tiếp hướng dẫn. Đọc tài liệu, thực hành ${categories[lesson.category]?.name || ""} và lưu lại câu hỏi của bạn.`}
        </p>
        <div className="document-meta">
          <span>
            <BookOpen size={15} />
            PDF · {pages} trang
          </span>
          <span>
            <GraduationCap size={16} />
            Hướng dẫn trực tiếp
          </span>
        </div>
        {pdf ? (
          <>
            <p className="document-pages">
              Phần đang học: trang {start}–{lesson.document_page_end || pages}.
            </p>
            <div className="button-row">
              <a
                className="btn primary"
                href={`/api/files/${pdf.id}/view#page=${start}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Mở giáo trình <ExternalLink size={16} />
              </a>
              <a className="btn secondary" href={`/api/files/${pdf.id}`}>
                <FileDown size={16} />
                Tải PDF
              </a>
            </div>
            <small className="muted document-filename">{pdf.name}</small>
            {book && (
              <nav
                className="handbook-chapters"
                aria-label="Chương và bài thực hành"
              >
                <h3>Đọc chương và làm bài cùng mã</h3>
                <ol>
                  {book.chapters.map((ch: any) => (
                    <li key={ch.id}>
                      <a
                        href={`/api/files/${pdf.id}/view#page=${ch.page}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <b>{ch.id.toUpperCase()}</b> {ch.title}
                        <small>Trang {ch.page}</small>
                      </a>
                      <Link href={`${book.practiceBase}/thuc-hanh/${ch.id}`}>
                        Làm bài {ch.id.toUpperCase()}
                      </Link>
                    </li>
                  ))}
                </ol>
              </nav>
            )}
          </>
        ) : (
          <>
            <Link className="btn primary" href="/bai-hoc/eplab-giao-trinh-solidworks-v5">
              Xem giáo trình đầy đủ <BookOpen size={16} />
            </Link>
            <small className="muted">
              Dành cho người tham gia đã kích hoạt và hai người chủ trì.
            </small>
          </>
        )}
      </div>
    </section>
  );
}
