"use client";
import Link from "next/link";
import { useState } from "react";
import { api, useApi, date } from "../lib/api";
import { useAuth } from "./context";
import { PageTitle, Field, Notice, Loading, ErrorBox } from "./ui";
import { SupportContact } from "./support-contact";
const tracks: Record<string, string> = {
  embedded: "Lập trình nhúng C",
  kicad: "KiCad",
  solidworks: "SOLIDWORKS",
};
const states: Record<string, string> = {
  pending: "Đang chờ duyệt",
  approved: "Đã được duyệt",
  rejected: "Chưa được duyệt",
  revoked: "Đã thu hồi quyền Lab",
};
export function LabMembership() {
  const { user, loading, refresh } = useAuth();
  const list = useApi<any>(user ? "/api/lab/membership" : null);
  const [selected, setSelected] = useState(Object.keys(tracks)),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (loading) return <Loading />;
  const request = list.data?.request,
    active = list.data?.active ?? (user?.role === "admin" || user?.active);
  return (
    <>
      <PageTitle
        eyebrow="CỘNG ĐỒNG EP LAB"
        title="Tham gia Lab"
        description="Học cùng người chủ trì, thực hành theo lộ trình và nhận hỗ trợ trong quá trình làm sản phẩm. Tham gia miễn phí, quyền học đầy đủ được admin xét duyệt."
      />
      <section className="panel">
        <h2>Học đầy đủ ba lĩnh vực · Không thu phí tham gia</h2>
        <ul>
          <li>
            Bài học và giáo trình dành cho người tham gia ở Nhúng C, KiCad và
            SOLIDWORKS.
          </li>
          <li>
            Thực hành từ cơ bản đến nâng cao, nộp bài và nhận nhận xét của người
            chủ trì.
          </li>
          <li>Trao đổi và nhận hỗ trợ trong mục thảo luận của từng môn.</li>
        </ul>
        <p className="muted">
          Quyền học áp dụng cho học liệu đã xuất bản; không bao gồm tài liệu nội
          bộ người chủ trì, thiết bị hoặc bản quyền phần mềm.
        </p>
      </section>
      {!user ? (
        <section className="panel">
          <h2>Bắt đầu với tài khoản EP LAB</h2>
          <p>
            Tạo tài khoản, xác minh email rồi gửi yêu cầu tham gia Lab. Trong
            lúc chờ, bạn vẫn học được các bài miễn phí.
          </p>
          <div className="button-row">
            <Link className="btn primary" href="/dang-ky">
              Tạo tài khoản miễn phí
            </Link>
            <Link className="btn secondary" href="/dang-nhap">
              Đã có tài khoản · Đăng nhập
            </Link>
          </div>
        </section>
      ) : list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : !list.data && list.loading ? (
        <Loading />
      ) : (
        <section className="panel stack form-narrow">
          <h2>
            {active
              ? "Bạn đã có quyền học đầy đủ"
              : request
                ? states[request.status]
                : "Gửi yêu cầu tham gia"}
          </h2>
          <div className="lab-own-contact" aria-label="Thông tin của bạn">
            <h3>Thông tin của bạn</h3>
            <p>
              Người chủ trì dùng thông tin trong tài khoản để liên hệ hỗ trợ
              bạn.
            </p>
            <dl>
              <div>
                <dt>Họ tên</dt>
                <dd>{user.name}</dd>
              </div>
              <div>
                <dt>Số điện thoại của bạn</dt>
                <dd>{user.phone || "Chưa bổ sung"}</dd>
              </div>
              <div>
                <dt>Email tài khoản của bạn</dt>
                <dd>{user.email}</dd>
              </div>
            </dl>
            <Link href="/tai-khoan?tab=profile">
              Cập nhật hồ sơ và số điện thoại →
            </Link>
          </div>
          {request && (
            <>
              <p>
                Gửi ngày {date(request.created_at)} · Cập nhật{" "}
                {date(request.updated_at)}
              </p>
              <p>
                <b>Môn quan tâm:</b>{" "}
                {request.tracks.map((t: string) => tracks[t]).join(", ")}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{request.message}</p>
              {request.decision_note && (
                <Notice>
                  <b>Phản hồi của người chủ trì:</b> {request.decision_note}
                </Notice>
              )}
            </>
          )}
          {active ? (
            <>
              <p>
                Bạn có thể học các khóa đã xuất bản, đọc giáo trình, nộp bài và
                gửi câu hỏi cho người chủ trì.
              </p>
              <Link className="btn primary" href="/">
                Chọn môn để học
              </Link>
            </>
          ) : request?.status === "pending" ? (
            <Notice>
              Yêu cầu đã được lưu. Người chủ trì sẽ xem xét và liên hệ qua thông
              tin trong tài khoản; bạn không cần chuyển khoản.
            </Notice>
          ) : !user.verified ? (
            <Notice>
              Xác minh email trước khi gửi yêu cầu.{" "}
              <Link href="/tai-khoan">Mở tài khoản để kiểm tra</Link>.
            </Notice>
          ) : !user.phone ? (
            <Notice>
              <Link href="/tai-khoan?tab=profile">
                Thêm số điện thoại liên hệ
              </Link>{" "}
              trước khi gửi yêu cầu.
            </Notice>
          ) : (
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setError("");
                try {
                  await api("/api/lab/membership", "POST", {
                    tracks: selected,
                    message,
                  });
                  await list.reload();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <fieldset>
                <legend>Môn bạn quan tâm</legend>
                {Object.entries(tracks).map(([id, name]) => (
                  <label className="checkbox" key={id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, id]
                            : selected.filter((x) => x !== id),
                        )
                      }
                    />
                    {name}
                  </label>
                ))}
              </fieldset>
              <Field
                label="Mục tiêu học tập"
                hint="Chia sẻ nền tảng hiện tại, điều bạn muốn học hoặc sản phẩm muốn làm (10–1.000 ký tự)."
              >
                <textarea
                  required
                  rows={5}
                  minLength={10}
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </Field>
              <p className="muted">
                Chọn môn quan tâm giúp người chủ trì hỗ trợ; khi được duyệt bạn
                có quyền học cả ba môn.
              </p>
              {error && <Notice type="error">{error}</Notice>}
              <button
                className="btn primary"
                disabled={busy || selected.length === 0}
              >
                {busy
                  ? "Đang gửi…"
                  : request
                    ? "Gửi lại yêu cầu"
                    : "Gửi yêu cầu tham gia Lab"}
              </button>
            </form>
          )}
          <div className="button-row">
            <button
              className="btn secondary"
              disabled={list.loading}
              onClick={async () => {
                await list.reload();
                await refresh();
              }}
            >
              Kiểm tra trạng thái mới nhất
            </button>
            {!active && (
              <Link className="btn secondary" href="/hoc-thu">
                Học miễn phí trong lúc chờ
              </Link>
            )}
          </div>
        </section>
      )}
      <SupportContact />
    </>
  );
}
export function LabMembershipAdmin({ changed }: { changed: () => void }) {
  const [status, setStatus] = useState("pending"),
    [query, setQuery] = useState(""),
    [page, setPage] = useState(1),
    [editing, setEditing] = useState<any>(null),
    [decision, setDecision] = useState("approved"),
    [note, setNote] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const list = useApi<any>(
    `/api/admin/lab-memberships?status=${status}&page=${page}&query=${encodeURIComponent(query)}`,
  );
  return (
    <section className="panel stack">
      <h2>Duyệt tham gia Lab</h2>
      <p>
        Xem mục tiêu và thông tin liên hệ, sau đó cấp quyền học đầy đủ ba môn
        hoặc gửi phản hồi. Không thu phí và không tạo đơn thanh toán.
      </p>
      <div className="button-row">
        <Field label="Trạng thái yêu cầu">
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tất cả</option>
            {Object.entries(states).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tìm người tham gia">
          <input
            type="search"
            maxLength={150}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Tên, email hoặc số điện thoại"
          />
        </Field>
        <button className="btn secondary" onClick={() => void list.reload()}>
          Tải lại
        </button>
      </div>
      {error && <Notice type="error">{error}</Notice>}
      {list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : list.loading ? (
        <Loading />
      ) : (
        <>
          <p aria-live="polite">{list.data?.total ?? 0} yêu cầu phù hợp</p>
          {list.data?.items.map((r: any) => (
            <article className="panel stack" key={r.user_id}>
              <h3>
                {r.name} · {states[r.status]}
              </h3>
              <p>
                {r.email} · {r.phone || "Chưa có số điện thoại"} ·{" "}
                {date(r.updated_at)}
              </p>
              <p>
                <b>Môn quan tâm:</b>{" "}
                {r.tracks.map((t: string) => tracks[t]).join(", ")}
              </p>
              <p style={{ whiteSpace: "pre-wrap" }}>{r.message}</p>
              {(r.blocked || !r.verified) && (
                <Notice type="error">
                  {r.blocked
                    ? "Tài khoản đang bị khóa."
                    : "Tài khoản chưa xác minh email."}{" "}
                  Không thể cấp quyền lúc này.
                </Notice>
              )}
              {r.decision_note && (
                <p>
                  <b>Phản hồi đã gửi trên hệ thống:</b> {r.decision_note}
                </p>
              )}
              {["pending", "approved"].includes(r.status) && (
                <button
                  className="btn secondary"
                  onClick={() => {
                    setEditing(r);
                    setDecision(
                      r.status === "approved" ? "revoked" : "approved",
                    );
                    setNote("");
                    setError("");
                  }}
                >
                  {r.status === "pending"
                    ? "Xét duyệt yêu cầu"
                    : "Thu hồi quyền thành viên Lab"}
                </button>
              )}
              {editing?.user_id === r.user_id && (
                <form
                  className="stack"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setBusy(true);
                    setError("");
                    try {
                      await api(
                        `/api/admin/lab-memberships/${r.user_id}`,
                        "PATCH",
                        { status: decision, revision: editing.revision, note },
                      );
                      setEditing(null);
                      await list.reload();
                      changed();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {r.status === "pending" && (
                    <Field label="Quyết định">
                      <select
                        value={decision}
                        onChange={(e) => setDecision(e.target.value)}
                      >
                        <option value="approved">
                          Duyệt · cấp quyền học đầy đủ
                        </option>
                        <option value="rejected">
                          Chưa duyệt · gửi phản hồi
                        </option>
                      </select>
                    </Field>
                  )}
                  {decision === "revoked" && (
                    <Notice>
                      Thu hồi quyền do Lab cấp. Nếu tài khoản đã có quyền học từ
                      trước, quyền cũ vẫn được giữ.
                    </Notice>
                  )}
                  <Field label="Phản hồi cho học viên">
                    <textarea
                      required
                      minLength={3}
                      maxLength={1000}
                      rows={3}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </Field>
                  <div className="button-row">
                    <button
                      className="btn primary"
                      disabled={
                        busy ||
                        (decision === "approved" && (r.blocked || !r.verified))
                      }
                    >
                      {busy
                        ? "Đang lưu…"
                        : decision === "approved"
                          ? "Duyệt và cấp quyền"
                          : decision === "revoked"
                            ? "Xác nhận thu hồi quyền Lab"
                            : "Lưu phản hồi chưa duyệt"}
                    </button>
                    <button
                      type="button"
                      className="btn secondary"
                      disabled={busy}
                      onClick={() => setEditing(null)}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              )}
            </article>
          ))}
          <div className="button-row">
            <button
              className="btn secondary"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              Trang trước
            </button>
            <span>Trang {page}</span>
            <button
              className="btn secondary"
              disabled={!list.data || page * 30 >= list.data.total}
              onClick={() => setPage(page + 1)}
            >
              Trang sau
            </button>
          </div>
        </>
      )}
    </section>
  );
}
