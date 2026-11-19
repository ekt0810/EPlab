import { tx, setting, auditTx } from "../db.js";
import { ApiError } from "../security.js";
import {
  batchSchema,
  validateVerificationDates,
  type CompetitionSnapshot,
} from "./model.js";
export const COMPETITION_KEY = "embedded_competitions";
const empty = (): CompetitionSnapshot => ({
  revision: 0,
  updatedAt: null,
  entries: [],
});
export async function readCompetitions(): Promise<CompetitionSnapshot> {
  return (await setting(COMPETITION_KEY)) || empty();
}
export async function importCompetitions(
  input: unknown,
  actor: string | null,
  now = Date.now(),
) {
  const batch = batchSchema.parse(input);
  try {
    validateVerificationDates(batch.entries, now);
  } catch {
    throw new ApiError(400, "Ngày xác minh không hợp lệ.");
  }
  return tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(8493035)");
    const current: CompetitionSnapshot =
      (
        await c.query("SELECT value FROM settings WHERE key=$1 FOR UPDATE", [
          COMPETITION_KEY,
        ])
      ).rows[0]?.value || empty();
    if (current.revision !== batch.expectedRevision)
      throw new ApiError(
        409,
        "Danh sách đã thay đổi. Tải lại trước khi cập nhật.",
      );
    const merged = new Map(current.entries.map((e) => [e.id, e]));
    for (const entry of batch.entries) {
      const old = merged.get(entry.id);
      if (old && Date.parse(entry.verifiedAt) < Date.parse(old.verifiedAt))
        throw new ApiError(
          409,
          "Dữ liệu xác minh cũ hơn bản hiện tại: " + entry.id,
        );
      merged.set(entry.id, { ...entry, hidden: old?.hidden || false });
    }
    if (merged.size > 300)
      throw new ApiError(
        400,
        "Danh sách vượt giới hạn 300 cuộc thi; cần rà soát lưu trữ.",
      );
    const snapshot: CompetitionSnapshot = {
      revision: current.revision + 1,
      updatedAt: new Date(now).toISOString(),
      entries: [...merged.values()],
    };
    await c.query(
      "INSERT INTO settings(key,value) VALUES($1,$2::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
      [COMPETITION_KEY, JSON.stringify(snapshot)],
    );
    // Retain the previous 10 complete snapshots for recovery. Settings are included
    // in the existing encrypted backup, so no separate unprotected data store exists.
    const versions =
      (
        await c.query(
          "SELECT value FROM settings WHERE key='embedded_competitions_history' FOR UPDATE",
        )
      ).rows[0]?.value || [];
    await c.query(
      "INSERT INTO settings(key,value) VALUES('embedded_competitions_history',$1::jsonb) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value",
      [JSON.stringify([...versions, current].slice(-10))],
    );
    await auditTx(c, actor, "competitions.updated", null, {
      revision: snapshot.revision,
      ids: batch.entries.map((e) => e.id),
      note: batch.note,
    });
    return {
      revision: snapshot.revision,
      updated: batch.entries.length,
      total: snapshot.entries.length,
    };
  });
}
export async function setCompetitionHidden(
  id: string,
  hidden: boolean,
  revision: number,
  actor: string,
) {
  return tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(8493035)");
    const current: CompetitionSnapshot =
      (
        await c.query("SELECT value FROM settings WHERE key=$1 FOR UPDATE", [
          COMPETITION_KEY,
        ])
      ).rows[0]?.value || empty();
    if (current.revision !== revision)
      throw new ApiError(409, "Danh sách đã thay đổi. Tải lại để tiếp tục.");
    const item = current.entries.find((e) => e.id === id);
    if (!item) throw new ApiError(404, "Không tìm thấy cuộc thi.");
    item.hidden = hidden;
    current.revision++;
    await c.query("UPDATE settings SET value=$2::jsonb WHERE key=$1", [
      COMPETITION_KEY,
      JSON.stringify(current),
    ]);
    await auditTx(
      c,
      actor,
      hidden ? "competitions.hidden" : "competitions.shown",
      id,
      { revision: current.revision },
    );
    return { ok: true, revision: current.revision };
  });
}
