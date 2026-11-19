import fs from "node:fs/promises";
import path from "node:path";
import { pool, setting } from "../apps/api/src/db.js";
import { config } from "../apps/api/src/config.js";
import {
  batchSchema,
  validateVerificationDates,
} from "../apps/api/src/competitions/model.js";
import {
  importCompetitions,
  readCompetitions,
} from "../apps/api/src/competitions/store.js";
// Local operator CLI: never loads remote code, sends mail, or changes accounts.
const args = process.argv.slice(2);
function option(name: string) {
  const i = args.indexOf(name);
  return i < 0 ? undefined : args[i + 1];
}
try {
  const expected = option("--database");
  if (
    !expected ||
    !["eplab", "eplab_review_20261115", "eplab_review_test_20261115"].includes(
      expected,
    )
  )
    throw Error("Cần --database với tên database được cho phép.");
  const actual = (await pool.query("SELECT current_database() AS name")).rows[0]
    .name;
  if (actual !== expected) throw Error("Sai database đích. Không cập nhật.");
  if (args.includes("--show")) {
    console.log(JSON.stringify(await readCompetitions(), null, 2));
  } else {
    const file = option("--file");
    if (!file)
      throw Error("Cần --file JSON đã xác minh, kèm --dry-run hoặc --apply.");
    if (args.includes("--apply") === args.includes("--dry-run"))
      throw Error("Chọn đúng một chế độ --dry-run hoặc --apply.");
    const info = await fs.stat(path.resolve(file));
    if (!info.isFile() || info.size > 256 * 1024)
      throw Error("Tệp cập nhật vượt 256 KB hoặc không hợp lệ.");
    const batch = batchSchema.parse(
      JSON.parse(await fs.readFile(path.resolve(file), "utf8")),
    );
    validateVerificationDates(batch.entries);
    const current = await readCompetitions();
    if (batch.expectedRevision !== current.revision)
      throw Error("Revision thay đổi; đọc lại --show và đối chiếu.");
    if (args.includes("--apply")) {
      if (await setting("maintenance"))
        throw Error("Máy chủ đang bảo trì. Thử lại khi bảo trì kết thúc.");
      console.log(
        JSON.stringify({
          database: actual,
          ...(await importCompetitions(batch, null)),
        }),
      );
    } else
      console.log(
        JSON.stringify({
          valid: true,
          database: actual,
          entries: batch.entries.length,
          revision: current.revision,
          publicMode: config.public,
        }),
      );
  }
} finally {
  await pool.end();
}
