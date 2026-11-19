import type { PoolClient } from "pg";
import { advancedExercises } from "./advanced-exercises.js";
const labels = {
  basic: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
};
export async function installPathways(c: PoolClient) {
  await c.query("SELECT pg_advisory_xact_lock(8493026)");
  if (
    (await c.query("SELECT 1 FROM settings WHERE key='practice_pathways_v1'"))
      .rowCount
  )
    return { updated: false };
  for (const e of advancedExercises) {
    const course = (
      await c.query("SELECT id FROM courses WHERE category=$1", [e.track])
    ).rows[0];
    if (!course) throw new Error("Seed ba khóa trước khi nâng cấp lộ trình.");
    await c.query("INSERT INTO exercises(id,course_id,body) VALUES($1,$2,$3)", [
      e.id,
      course.id,
      JSON.stringify(e),
    ]);
  }
  for (const row of (
    await c.query(
      "SELECT id,body FROM exercises WHERE id ~ '^[ecs][0-9]{2}$' ORDER BY id",
    )
  ).rows) {
    const n = Number(row.id.slice(1));
    if (n < 1 || n > 12) continue;
    const level = n <= 4 ? "basic" : n <= 8 ? "intermediate" : "advanced";
    const patch: any = {
      level,
      difficulty: labels[level],
      order: n,
      prerequisites:
        n === 1 ? [] : [`${row.id[0]}${String(n - 1).padStart(2, "0")}`],
    };
    // Add advanced review requirements without replacing the existing KiCad rubric or steps.
    if (row.id === "e09")
      patch.extension = {
        title: "Yêu cầu nâng cao: phân tích đường hồi",
        steps: [
          "So sánh trước/sau khi đổi GND zone trên bo MCU; chỉ rõ đường hồi của ít nhất hai tín hiệu.",
          "Đối chiếu một khe cắt/đảo đồng với đường tín hiệu và giải thích điều chỉnh; không coi hình zone liên tục là đủ kiểm định chất lượng tín hiệu.",
        ],
      };
    if (row.id === "e11")
      patch.extension = {
        title: "Yêu cầu nâng cao: đối chiếu hồ sơ chế tạo",
        steps: [
          "Đối chiếu Gerber/drill/BOM với cùng phiên bản PCB và footprint; ghi kết quả của ít nhất một lỗi chủ động tạo rồi sửa.",
          "Lập checklist về outline, lỗ, mask, silkscreen và khả năng mở bằng viewer độc lập; liệt kê thông số còn cần xưởng xác nhận.",
        ],
      };
    await c.query("UPDATE exercises SET body=body||$2::jsonb WHERE id=$1", [
      row.id,
      JSON.stringify(patch),
    ]);
  }
  await c.query(
    "INSERT INTO settings(key,value) VALUES('practice_pathways_v1',$1)",
    [JSON.stringify({ version: 1, tracks: 3, perTrack: 12 })],
  );
  await c.query(
    "INSERT INTO audit_logs(action,metadata) VALUES('content.practice_pathways_installed',$1)",
    [JSON.stringify({ added: 8, total: 36 })],
  );
  return { updated: true, added: 8, total: 36 };
}
