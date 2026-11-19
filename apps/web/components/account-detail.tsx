"use client";
import { useState } from "react";
import { Mail, LockKeyhole, LogOut, FileText } from "lucide-react";
import { api, useApi, date, money } from "../lib/api";
import { Notice, Loading, ErrorBox, Field } from "./ui";
import { AccountHistory } from "./account-history";
export function AccountStatus({ user: u }: { user: any }) {
  const text = u.blocked
    ? "Đã khóa"
    : u.setup_pending
      ? "Chờ nhận tài khoản"
      : !u.verified
        ? "Chưa xác minh"
        : "Đã xác minh";
  return (
    <span
      className={`badge ${u.blocked ? "member" : u.verified ? "free" : "draft"}`}
    >
      {text}
    </span>
  );
}
const orderStatus: Record<string, string> = {
  pending: "Chờ đối soát",
  paid: "Đã thanh toán",
  expired: "Hết hạn",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn tiền",
};
export function AccountDetail({
  id,
  changed,
}: {
  id: string;
  changed: () => void;
}) {
  const profile = useApi<any>("/api/admin/accounts/" + id);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [revision, setRevision] = useState(0),
    [action, setAction] = useState<string | null>(null),
    [order, setOrder] = useState<any>(null);
  async function reload() {
    await profile.reload();
    setRevision((n) => n + 1);
    changed();
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (profile.loading && !profile.data) return <Loading />;
  if (profile.error)
    return <ErrorBox message={profile.error} retry={profile.reload} />;
  if (!profile.data) return null;
  const {
      user: u,
      orders,
      progress,
      sessions,
      submissions,
      creator,
    } = profile.data,
    isStudent = u.role === "student";
  const emailPurpose = u.setup_pending
    ? "invite"
    : u.verified
      ? "reset"
      : "verify";
  const emailLabel = u.setup_pending
    ? "Gửi lại thư mời"
    : u.verified
      ? "Gửi thư khôi phục mật khẩu"
      : "Gửi thư xác minh email";
  return (
    <div className="account-manager">
      <section className="panel account-profile">
        <div className="section-heading">
          <div>
            <h2>{u.name}</h2>
            <p className="account-email">{u.email}</p>
          </div>
          <div className="button-row">
            <AccountStatus user={u} />
            <span className="badge published">
              {isStudent
                ? u.active
                  ? "Đã có quyền học đầy đủ"
                  : "Tài khoản miễn phí"
                : `Người chủ trì ${u.admin_slot} · Miễn phí`}
            </span>
          </div>
        </div>
        <dl className="account-facts">
          <div>
            <dt>Số điện thoại / Zalo</dt>
            <dd>
              {u.phone ? (
                <>
                  <a href={`tel:${u.phone}`}>{u.phone}</a>
                  {" · "}
                  <a
                    href={`https://zalo.me/${u.phone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Mở Zalo
                  </a>
                </>
              ) : (
                "Chưa bổ sung"
              )}
            </dd>
          </div>
          <div>
            <dt>Ngày tạo</dt>
            <dd>{date(u.created_at)}</dd>
          </div>
          <div>
            <dt>Đăng nhập gần nhất</dt>
            <dd>{u.last_login_at ? date(u.last_login_at) : "Chưa ghi nhận"}</dd>
          </div>
          <div>
            <dt>Thư mời gần nhất</dt>
            <dd>{u.invited_at ? date(u.invited_at) : "Chưa ghi nhận"}</dd>
          </div>
          <div>
            <dt>Người tạo hồ sơ</dt>
            <dd>
              {creator
                ? `${creator.name} (${creator.email})`
                : "Đăng ký hoặc thiết lập ban đầu"}
            </dd>
          </div>
        </dl>
        {isStudent && (
          <div className="button-row">
            <button
              className="btn secondary"
              disabled={busy || u.blocked}
              onClick={() =>
                run(async () => {
                  const r = await api(
                    `/api/admin/accounts/${id}/email`,
                    "POST",
                    { purpose: emailPurpose },
                  );
                  setMessage(r.message);
                })
              }
            >
              <Mail size={18} />
              {emailLabel}
            </button>
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => setAction("block")}
            >
              <LockKeyhole size={18} />
              {u.blocked ? "Mở khóa" : "Khóa tài khoản"}
            </button>
            <button
              className="btn secondary"
              disabled={busy || !sessions.length}
              onClick={() => setAction("sessions")}
            >
              <LogOut size={18} />
              Đăng xuất mọi phiên
            </button>
          </div>
        )}
        <div className="button-row">
          <button
            className="btn secondary"
            disabled={busy}
            onClick={() => setAction("note")}
          >
            <FileText size={18} />
            Thêm ghi chú quản lý
          </button>
        </div>
      </section>
      {error && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}
      {action && (
        <form
          key={action}
          className="panel stack form-narrow"
          onSubmit={(e) => {
            e.preventDefault();
            const text = String(new FormData(e.currentTarget).get("reason"));
            void run(async () => {
              const r =
                action === "block"
                  ? await api(`/api/admin/users/${id}`, "PATCH", {
                      blocked: !u.blocked,
                      reason: text,
                    })
                  : action === "sessions"
                    ? await api(
                        `/api/admin/accounts/${id}/revoke-sessions`,
                        "POST",
                        { reason: text },
                      )
                    : await api(`/api/admin/accounts/${id}/notes`, "POST", {
                        note: text,
                      });
              setMessage(r.message);
              setAction(null);
            });
          }}
        >
          <h3>
            {action === "note"
              ? "Ghi chú quản lý"
              : action === "sessions"
                ? "Đăng xuất mọi phiên"
                : u.blocked
                  ? "Mở khóa tài khoản"
                  : "Khóa tài khoản"}
          </h3>
          {action === "block" && (
            <p>
              {u.blocked
                ? "Người tham gia có thể đăng nhập lại. Quyền học giữ theo giao dịch đã xác nhận."
                : "Người tham gia sẽ bị đăng xuất và tạm ngừng truy cập tài khoản. Hồ sơ và lịch sử vẫn được giữ."}
            </p>
          )}
          <Field
            label={action === "note" ? "Nội dung ghi chú" : "Lý do thực hiện"}
          >
            <textarea name="reason" required minLength={5} maxLength={1000} />
          </Field>
          <div className="button-row">
            <button className="btn primary" disabled={busy}>
              {busy ? "Đang lưu…" : "Xác nhận và lưu lịch sử"}
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setAction(null)}
              disabled={busy}
            >
              Hủy
            </button>
          </div>
        </form>
      )}
      {isStudent && (
        <section className="panel">
          <h2>Quyền học & tham gia Lab</h2>
          <p>
            {u.active
              ? "Tài khoản đã có quyền học đầy đủ."
              : "Học viên gửi yêu cầu tại mục Tham gia Lab; người chủ trì xét duyệt trong tab Tham gia Lab ở trang quản trị."}
          </p>
          <p>Không thu phí tham gia. Các quyền học đã có được giữ nguyên.</p>
          {orders.length > 0 && (
            <details>
              <summary>Lịch sử giao dịch trước khi chuyển sang Lab</summary>
              {orders.map((o: any) => (
                <p key={o.id}>
                  {o.code} · {money(o.amount)} · {orderStatus[o.status]} ·{" "}
                  {date(o.created_at)}
                </p>
              ))}
            </details>
          )}
        </section>
      )}
      <section className="panel">
        <h2>Tiến độ học & bài nộp</h2>
        <div className="account-progress">
          {progress.map((c: any) => (
            <article key={c.id}>
              <h3>{c.title}</h3>
              <p>
                {c.completed} bài hoàn thành · {c.started} bài có tiến độ
              </p>
              <small>
                {c.last_activity
                  ? "Cập nhật " + date(c.last_activity)
                  : "Chưa có tiến độ được lưu"}
              </small>
            </article>
          ))}
        </div>
        <p>
          {submissions.total} bài nộp · {submissions.pending} bài chờ người chủ
          trì chấm.
        </p>
      </section>
      <section className="panel">
        <h2>Phiên đăng nhập còn hiệu lực ({sessions.length})</h2>
        {sessions.length ? (
          <ul className="account-sessions">
            {sessions.map((s: any, i: number) => (
              <li key={i}>
                <strong>
                  {s.user_agent || "Thiết bị không cung cấp thông tin"}
                </strong>
                <small>
                  Bắt đầu {date(s.created_at)} · Hết hạn {date(s.expires_at)}
                </small>
              </li>
            ))}
          </ul>
        ) : (
          <p>Không có phiên đăng nhập còn hiệu lực.</p>
        )}
      </section>
      <AccountHistory id={id} revision={revision} />
    </div>
  );
}
