import type { PoolClient } from "pg";
import { curriculum } from "./content.js";
export async function installKicadPractice(c: PoolClient) {
  await c.query("SELECT pg_advisory_xact_lock(8493024)");
  if (
    (await c.query("SELECT 1 FROM settings WHERE key='kicad_practice_v1'"))
      .rowCount
  )
    return { updated: false };
  const course = (
    await c.query("SELECT id FROM courses WHERE slug='thiet-ke-mach-kicad'")
  ).rows[0];
  if (!course)
    throw new Error("Chạy seed ba lĩnh vực trước khi nhập giáo trình KiCad.");
  for (const m of curriculum.modules) {
    const ch = (
      await c.query(
        "INSERT INTO chapters(course_id,title,position) VALUES($1,$2,$3) RETURNING id",
        [course.id, `${m.id}. ${m.title}`, 10 + m.id],
      )
    ).rows[0];
    for (const [i, l] of curriculum.lessons
      .filter((l) => l.module === m.id)
      .entries()) {
      const text = [
        ...l.concepts.map(([title, body]) => `${title}\n${body}`),
        "Thực hành trong KiCad\n" +
          l.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
        "Lỗi thường gặp\n" + l.mistakes.join("\n"),
      ].join("\n\n");
      const row = (
        await c.query(
          `INSERT INTO lessons(chapter_id,slug,title,summary,objectives,content,exercise,status,preview,position,video_type,author,language,software_version,rights)
        VALUES($1,$2,$3,$4,$4,$5,$6,'published',false,$7,'none','EP LAB','Tiếng Việt','Giáo trình KiCad 9 · nhập từ web KiCad EP Lab','owned') RETURNING id`,
          [
            ch.id,
            `kicad-${l.id}`,
            l.title,
            l.summary,
            text,
            l.steps.join("\n"),
            i,
          ],
        )
      ).rows[0];
      await c.query(
        "INSERT INTO kicad_lessons(lesson_id,source_id,module,body) VALUES($1,$2,$3,$4)",
        [row.id, l.id, m.id, JSON.stringify(l)],
      );
    }
  }
  for (const e of curriculum.exercises)
    await c.query("INSERT INTO exercises(id,course_id,body) VALUES($1,$2,$3)", [
      e.id,
      course.id,
      JSON.stringify(e),
    ]);
  await c.query("UPDATE courses SET description=$1 WHERE id=$2", [
    "Học thiết kế mạch qua 24 bài tiếng Việt, 12 bài thực hành, tự kiểm tra và nộp bài nhận phản hồi. Video tham khảo từ Phil’s Lab.",
    course.id,
  ]);
  await c.query(
    "INSERT INTO settings(key,value) VALUES('kicad_practice_v1',$1)",
    [
      JSON.stringify({
        lessons: 24,
        exercises: 12,
        source: "machlab",
        version: 1,
      }),
    ],
  );
  await c.query(
    "INSERT INTO audit_logs(action,target,metadata) VALUES('content.kicad_practice_installed',$1,$2)",
    [course.id, JSON.stringify({ lessons: 24, exercises: 12 })],
  );
  return { updated: true, lessons: 24, exercises: 12 };
}
