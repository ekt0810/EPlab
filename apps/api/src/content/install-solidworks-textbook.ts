import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config } from "../config.js";
import { storage } from "../storage.js";
import { solidworksTextbook as book } from "./solidworks-textbook.js";
export const textbookSha256 =
  "993af1f533103ad326b524d667816eade790359627e72ba90442cd3f8937a5de";
export async function installSolidworksTextbook(c: PoolClient) {
  await c.query("SELECT pg_advisory_xact_lock(8493023)");
  const marker = (
    await c.query(
      "SELECT value FROM settings WHERE key='solidworks_textbook_v5'",
    )
  ).rows[0];
  if (marker) return { updated: false, ...marker.value };
  const bytes = await fs.readFile(
    path.join(config.root, "apps/api/assets/solidworks-textbook.pdf"),
  );
  if (createHash("sha256").update(bytes).digest("hex") !== textbookSha256)
    throw new Error("Giáo trình không trùng PDF đã kiểm chứng.");
  let course = (
    await c.query("SELECT * FROM courses WHERE slug=$1 FOR UPDATE", [
      book.courseSlug,
    ])
  ).rows[0];
  if (course) {
    const lessons = (
      await c.query(
        "SELECT l.* FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id WHERE ch.course_id=$1",
        [course.id],
      )
    ).rows;
    const dir = path.join(config.data, "content-history");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, `solidworks-before-textbook-${Date.now()}.json`),
      JSON.stringify({ course, lessons }, null, 2),
      { flag: "wx", mode: 0o600 },
    );
    await c.query("UPDATE courses SET description=$1 WHERE id=$2", [
      book.description,
      course.id,
    ]);
  } else
    course = (
      await c.query(
        "INSERT INTO courses(slug,category,title,description,status,position) VALUES($1,'solidworks','Thiết kế cơ khí SOLIDWORKS',$2,'published',2) RETURNING *",
        [book.courseSlug, book.description],
      )
    ).rows[0];
  const chapters = [];
  for (const [position, title] of [
    "Làm quen · Học theo giáo trình",
    "Giáo trình SOLIDWORKS EP LAB",
    "Thực hành cùng giảng viên",
  ].entries()) {
    let ch = (
      await c.query(
        "SELECT id FROM chapters WHERE course_id=$1 AND position=$2 ORDER BY id LIMIT 1",
        [course.id, position],
      )
    ).rows[0];
    if (ch)
      await c.query("UPDATE chapters SET title=$1 WHERE id=$2", [title, ch.id]);
    else
      ch = (
        await c.query(
          "INSERT INTO chapters(course_id,title,position) VALUES($1,$2,$3) RETURNING id",
          [course.id, title, position],
        )
      ).rows[0];
    chapters.push(ch.id);
  }
  async function lesson(
    p: {
      slug: string;
      title: string;
      summary: string;
      content: string;
      exercise: string;
    },
    chapter: string,
    position: number,
    preview: boolean,
    start = 1,
    end: number | null = null,
  ) {
    const existing = (
      await c.query(
        "SELECT ch.course_id FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id WHERE l.slug=$1",
        [p.slug],
      )
    ).rows[0];
    if (existing && existing.course_id !== course.id)
      throw new Error("Slug bài học đang thuộc khóa khác. Không ghi đè.");
    return (
      await c.query(
        `INSERT INTO lessons(chapter_id,slug,title,summary,objectives,content,exercise,answer,status,preview,position,video_type,video_url,source_url,author,language,software_version,rights,embed_verified,source_checked_at,document_page_start,document_page_end)
      VALUES($1,$2,$3,$4,$4,$5,$6,'','published',$7,$8,'none',NULL,NULL,'EP LAB · nguồn gốc ghi trong giáo trình','Tiếng Việt',$9,'owned',false,NULL,$10,$11)
      ON CONFLICT(slug) DO UPDATE SET chapter_id=EXCLUDED.chapter_id,title=EXCLUDED.title,summary=EXCLUDED.summary,objectives=EXCLUDED.objectives,content=EXCLUDED.content,exercise=EXCLUDED.exercise,answer='',prerequisites='',status='published',preview=EXCLUDED.preview,position=EXCLUDED.position,video_type='none',video_url=NULL,source_url=NULL,author=EXCLUDED.author,language=EXCLUDED.language,software_version=EXCLUDED.software_version,rights='owned',embed_verified=false,source_checked_at=NULL,duration_minutes=NULL,document_page_start=EXCLUDED.document_page_start,document_page_end=EXCLUDED.document_page_end RETURNING id`,
        [
          chapter,
          p.slug,
          p.title,
          p.summary,
          p.content,
          p.exercise,
          preview,
          position,
          book.version,
          start,
          end,
        ],
      )
    ).rows[0].id;
  }
  for (const [i, p] of book.previews.entries())
    await lesson(p, chapters[0], i, true);
  const ids = [];
  for (const [i, s] of book.sections.entries()) {
    ids.push(
      await lesson(
        {
          ...s,
          summary: `Giáo trình EP LAB, trang ${s.start}–${s.end}. Học theo tài liệu và giảng viên trực tiếp hướng dẫn.`,
          content: `Mở giáo trình tại trang ${s.start}–${s.end} để đọc phần “${s.title}”. Thực hiện bài tập trong SOLIDWORKS, giữ mã hình và đối chiếu yêu cầu trong tài liệu.\n\nGiảng viên EP LAB trực tiếp hướng dẫn nội dung này. Ghi câu hỏi, lưu file thực hành và đánh dấu hoàn thành sau khi đã đọc, thực hành và tự kiểm tra.\n\nGiữ nguyên nguồn trích dẫn và logo trong giáo trình. Website cung cấp bản PDF nguyên vẹn, không thay thế phần hướng dẫn của giảng viên.`,
          exercise:
            "Làm bài theo phần đang học trong giáo trình và yêu cầu của giảng viên. Ghi lại vị trí trang, mã hình, lỗi gặp phải và cách kiểm tra kết quả.",
        },
        chapters[i === 0 ? 1 : 2],
        i === 0 ? 0 : i - 1,
        false,
        s.start,
        s.end,
      ),
    );
  }
  const key = randomUUID();
  await storage.put(key, bytes);
  try {
    const resource = (
      await c.query(
        "INSERT INTO resources(lesson_id,name,storage_key,content_type,size,sha256) VALUES($1,$2,$3,'application/pdf',$4,$5) RETURNING id",
        [ids[0], book.fileName, key, bytes.length, textbookSha256],
      )
    ).rows[0];
    await c.query(
      "UPDATE lessons SET document_resource_id=$1 WHERE id=ANY($2::uuid[])",
      [resource.id, ids],
    );
    await c.query(
      "UPDATE lessons l SET video_url=NULL,video_type='none',embed_verified=false,source_url=NULL,source_checked_at=NULL FROM chapters ch WHERE l.chapter_id=ch.id AND ch.course_id=$1",
      [course.id],
    );
    const value = {
      resourceId: resource.id,
      pageCount: book.pageCount,
      sha256: textbookSha256,
      version: book.version,
    };
    await c.query(
      "INSERT INTO settings(key,value) VALUES('solidworks_textbook_v5',$1)",
      [JSON.stringify(value)],
    );
    await c.query(
      "INSERT INTO audit_logs(action,target,metadata) VALUES('content.solidworks_textbook_installed',$1,$2)",
      [
        course.id,
        JSON.stringify({
          sha256: textbookSha256,
          pages: book.pageCount,
          lessons: ids.length,
        }),
      ],
    );
    return { updated: true, ...value };
  } catch (e) {
    await storage.remove(key);
    throw e;
  }
}
