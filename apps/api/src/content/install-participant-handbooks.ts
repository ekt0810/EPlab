import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { config } from "../config.js";
import { tx } from "../db.js";
import { storage } from "../storage.js";
import { participantHandbooks } from "./participant-handbooks.js";

export async function installParticipantHandbooks() {
  const written: string[] = [];
  try {
    return await tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(8493024)");
      const marker = await c.query(
        "SELECT value FROM settings WHERE key='participant_handbooks_v5'",
      );
      if (marker.rowCount) return { updated: false };
      // Validate the whole release before writing files or database rows.
      const assets = await Promise.all(
        participantHandbooks.map(async (book) => {
          const bytes = await fs.readFile(
            path.join(
              config.root,
              "apps/api/assets/participant-handbooks",
              book.fileName,
            ),
          );
          if (createHash("sha256").update(bytes).digest("hex") !== book.sha256)
            throw new Error(
              `Giáo trình ${book.title} không khớp bản đã kiểm chứng.`,
            );
          return bytes;
        }),
      );
      const installed = [];
      for (const [i, book] of participantHandbooks.entries()) {
        const course = (
          await c.query("SELECT id FROM courses WHERE slug=$1", [
            book.courseSlug,
          ])
        ).rows[0];
        if (!course) throw new Error(`Chưa có khóa học ${book.title}.`);
        const chapter = (
          await c.query(
            "INSERT INTO chapters(course_id,title,position) SELECT $1,'Giáo trình người tham gia',COALESCE(MAX(position),0)+1 FROM chapters WHERE course_id=$1 RETURNING id",
            [course.id],
          )
        ).rows[0];
        const lesson = (
          await c.query(
            `INSERT INTO lessons(chapter_id,slug,title,summary,objectives,content,exercise,status,preview,position,video_type,author,language,software_version,rights,document_page_start,document_page_end)
           VALUES($1,$2,$3,$4,$4,$5,$6,'published',false,0,'none','EP LAB','Tiếng Việt','Giáo trình 5.0 · 11/2026','owned',1,$7) RETURNING id`,
            [
              chapter.id,
              book.lessonSlug,
              `Giáo trình ${book.title} dành cho người tham gia`,
              `${book.pages} trang, 12 chương và 12 bài thực hành từ cơ bản đến nâng cao.`,
              "Đọc phần nhập môn trước khi bắt đầu. Mỗi chương gồm mục tiêu, kiến thức, ví dụ, thực hành có hướng dẫn và bài nộp. Dùng mục lục bên dưới để mở đúng trang rồi chuyển tới bài thực hành cùng mã.\n\nNgười chủ trì trực tiếp chấm bài và phản hồi. Câu hỏi tự kiểm trong giáo trình có gợi ý ở cuối sách; chúng không thay thế việc thực hành và nộp bằng chứng.\n\nGiữ logo, chữ chìm EP lab và nguồn tham khảo khi sử dụng tài liệu.",
              "Chọn chương phù hợp, thực hiện các bước trong giáo trình và nộp bài ở phòng thực hành của môn học.",
              book.pages,
            ],
          )
        ).rows[0];
        const key = randomUUID();
        await storage.put(key, assets[i]);
        written.push(key);
        const resource = (
          await c.query(
            "INSERT INTO resources(lesson_id,name,storage_key,content_type,size,sha256) VALUES($1,$2,$3,'application/pdf',$4,$5) RETURNING id",
            [lesson.id, book.fileName, key, assets[i].length, book.sha256],
          )
        ).rows[0];
        await c.query(
          "UPDATE lessons SET document_resource_id=$1 WHERE id=$2",
          [resource.id, lesson.id],
        );
        installed.push({
          category: book.category,
          lessonId: lesson.id,
          resourceId: resource.id,
          sha256: book.sha256,
          pages: book.pages,
        });
      }
      await c.query(
        "INSERT INTO settings(key,value) VALUES('participant_handbooks_v5',$1)",
        [JSON.stringify(installed)],
      );
      await c.query(
        "INSERT INTO audit_logs(action,metadata) VALUES('content.participant_handbooks_installed',$1)",
        [JSON.stringify(installed)],
      );
      return { updated: true, books: installed.length };
    });
  } catch (error) {
    await Promise.allSettled(written.map((key) => storage.remove(key)));
    throw error;
  }
}
