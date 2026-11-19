import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { config } from "../config.js";
import { tx } from "../db.js";
import { storage } from "../storage.js";
export const hostHandbooks = [
  { category: "embedded", title: "Lập trình nhúng C", file: "EP-LAB-C-nhung-Nguoi-chu-tri.pdf", pages: 25, sha256: "33cbbccac4b7405eee3653c676085182b546a081d7c43e1b4e574a97feeb8888" },
  { category: "kicad", title: "KiCad", file: "EP-LAB-KiCad-Nguoi-chu-tri.pdf", pages: 28, sha256: "c0ad8064c94da526977a881c5a1822d4f7d28ce47c4ec14e7c5c6fa5f24bde24" },
  { category: "solidworks", title: "SOLIDWORKS", file: "EP-LAB-SOLIDWORKS-Nguoi-chu-tri.pdf", pages: 25, sha256: "beb164b7b494937473f8a67dd6dd9f3812742158d2396ecd02b6d0793e2704bb" },
];
export async function installHostHandbooks() {
  const written: string[] = [];
  try {
    await tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(8493024)");
      for (const book of hostHandbooks) {
        const slug = `eplab-host-${book.category}-v31`;
        if ((await c.query("SELECT 1 FROM lessons WHERE slug=$1", [slug])).rowCount) continue;
        const bytes = await fs.readFile(path.join(config.root, "apps/api/assets/host-handbooks", book.file));
        if (createHash("sha256").update(bytes).digest("hex") !== book.sha256) throw new Error("Host PDF checksum mismatch: " + book.file);
        const chapter = (await c.query("INSERT INTO chapters(course_id,title,position) SELECT id,'Tài liệu riêng của người chủ trì',999 FROM courses WHERE category=$1 RETURNING id", [book.category])).rows[0];
        if (!chapter) throw new Error("Missing course: " + book.category);
        const lesson = (await c.query(`INSERT INTO lessons(chapter_id,slug,title,summary,objectives,content,status,preview,video_type,rights,audience,level,software_version,document_page_end)
          VALUES($1,$2,$3,$4,$5,$6,'published',false,'none','owned','host','all','3.1',$7) RETURNING id`,
          [chapter.id,slug,`Giáo trình ${book.title} dành cho người chủ trì`,
           `Hướng dẫn tổ chức buổi học, giao bài và chấm thủ công. ${book.pages} trang, có watermark EP lab.`,
           "Tổ chức tiến trình học, giao bài theo cấp độ và đánh giá bằng chứng dựa trên tiêu chí công bố.",
           "Tài liệu nội bộ dành riêng cho hai người chủ trì. Đọc giáo trình và dùng công cụ giao bài, chấm bài của môn tương ứng.",book.pages])).rows[0];
        const key = randomUUID();
        await storage.put(key, bytes); written.push(key);
        const resource = (await c.query("INSERT INTO resources(lesson_id,name,storage_key,content_type,size,sha256) VALUES($1,$2,$3,'application/pdf',$4,$5) RETURNING id", [lesson.id,book.file,key,bytes.length,book.sha256])).rows[0];
        await c.query("UPDATE lessons SET document_resource_id=$1 WHERE id=$2", [resource.id,lesson.id]);
      }
    });
  } catch (e) { await Promise.allSettled(written.map((key) => storage.remove(key))); throw e; }
}
