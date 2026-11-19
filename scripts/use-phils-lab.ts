import fs from "node:fs/promises";
import path from "node:path";
import { pool, tx } from "../apps/api/src/db.js";
import { config } from "../apps/api/src/config.js";
import {
  kicadPhilsLabDescription,
  kicadPhilsLabPreviews,
} from "../apps/api/src/content/phils-lab-kicad.js";
// Explicit, repeatable content update. Keep row IDs, slugs, notes and progress.
try {
  const result = await tx(async (c) => {
    const course = (
      await c.query(
        "SELECT * FROM courses WHERE slug='thiet-ke-mach-kicad' AND category='kicad' FOR UPDATE",
      )
    ).rows[0];
    if (!course) throw new Error("Chưa có khóa KiCad. Chạy seed trước.");
    const before = [];
    for (const source of kicadPhilsLabPreviews) {
      const lesson = (
        await c.query(
          "SELECT l.* FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id WHERE ch.course_id=$1 AND l.slug=$2 FOR UPDATE OF l",
          [course.id, source.slug],
        )
      ).rows[0];
      if (
        !lesson ||
        ![source.previousUrl, source.url].includes(lesson.video_url)
      )
        throw new Error(
          "Nguồn bài đã thay đổi ngoài dữ liệu ban đầu. Không tự ghi đè.",
        );
      before.push(lesson);
    }
    const changes = before.filter(
      (l, i) => l.video_url !== kicadPhilsLabPreviews[i].url,
    );
    if (!changes.length && course.description === kicadPhilsLabDescription)
      return { updated: 0 };
    const dir = path.join(config.data, "content-history");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, `kicad-before-phils-lab-${Date.now()}.json`),
      JSON.stringify({ course, lessons: before }, null, 2),
      { mode: 0o600, flag: "wx" },
    );
    for (const [index, source] of kicadPhilsLabPreviews.entries()) {
      if (before[index].video_url === source.url) continue;
      await c.query(
        "UPDATE lessons SET title=$1,summary=$2,objectives=$2,prerequisites=$3,content=$4,exercise=$5,answer='',software_version=$6,video_url=$7,source_url=$7,author=$8,language='Tiếng Anh · hướng dẫn tiếng Việt',rights='public_reference',preview=true,video_type='reference',embed_verified=false,source_checked_at=NULL,duration_minutes=NULL WHERE id=$9",
        [
          source.title,
          source.summary,
          source.prerequisites,
          source.content,
          source.exercise,
          source.version,
          source.url,
          source.author,
          before[index].id,
        ],
      );
    }
    await c.query("UPDATE courses SET description=$1 WHERE id=$2", [
      kicadPhilsLabDescription,
      course.id,
    ]);
    await c.query(
      "INSERT INTO audit_logs(action,target,metadata) VALUES('content.kicad_source_changed',$1,$2)",
      [
        course.id,
        JSON.stringify({
          provider: "Phil's Lab",
          urls: kicadPhilsLabPreviews.map((p) => p.url),
          updated: changes.length,
        }),
      ],
    );
    return {
      updated: changes.length,
      provider: "Phil's Lab",
      rowIdsAndProgressPreserved: true,
    };
  });
  console.log(JSON.stringify(result));
} finally {
  await pool.end();
}
