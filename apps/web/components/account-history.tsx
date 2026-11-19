"use client";
import { useState } from "react";
import { useApi, date, money } from "../lib/api";
import { Field, Loading, ErrorBox } from "./ui";
const labels: Record<string, string> = {
  "user.recovery_requested": "Yêu cầu khôi phục tài khoản",
  "user.verification_requested": "Yêu cầu gửi lại thư xác minh",
  "user.created": "Admin tạo hồ sơ",
  "user.registered": "Tự đăng ký tài khoản",
  "user.invite_sent": "Gửi thư mời nhận tài khoản",
  "user.verify_sent": "Gửi thư xác minh",
  "user.reset_sent": "Gửi thư khôi phục mật khẩu",
  "user.email_failed": "Gửi email chưa thành công",
  "user.invitation_accepted": "Nhận tài khoản và đặt mật khẩu",
  "user.verified": "Xác minh email",
  "user.password_reset": "Đặt lại mật khẩu",
  "user.password_changed": "Đổi mật khẩu",
  "user.profile_updated": "Cập nhật hồ sơ",
  "user.phone_updated": "Cập nhật số điện thoại liên hệ",
  "user.blocked": "Khóa tài khoản",
  "user.unblocked": "Mở khóa tài khoản",
  "user.note": "Ghi chú của người chủ trì",
  "lab.requested": "Gửi yêu cầu tham gia Lab",
  "lab.approved": "Duyệt và cấp quyền học Lab",
  "lab.rejected": "Chưa duyệt yêu cầu Lab",
  "lab.revoked": "Thu hồi quyền thành viên Lab",
  login: "Đăng nhập",
  "login.failed": "Đăng nhập không thành công",
  logout: "Đăng xuất",
  "session.revoked": "Thu hồi một phiên đăng nhập",
  "session.renewed": "Đổi mã phiên sau xác thực",
  "sessions.revoked": "Admin đăng xuất mọi phiên",
  "mfa.enabled": "Bật xác thực hai bước",
  "order.created": "Tạo đơn kích hoạt",
  "order.reported": "Báo đã chuyển khoản",
  "order.cancelled": "Hủy đơn kích hoạt",
  "payment.approved": "Xác nhận thanh toán và cấp quyền",
  "payment.refunded": "Ghi nhận hoàn tiền và thu hồi quyền",
};
function detail(a: any) {
  const m = a.metadata || {},
    parts = [];
  if (m.note) parts.push(m.note);
  if (m.reason)
    parts.push(
      m.reason === "credentials"
        ? "Thông tin đăng nhập chưa đúng"
        : m.reason === "blocked"
          ? "Tài khoản đang bị khóa"
          : m.reason === "reauthentication"
            ? "Xác thực lại mật khẩu"
            : m.reason === "mfa"
              ? "Xác thực hai bước"
              : m.reason,
    );
  if (m.reference) parts.push("Mã giao dịch: " + m.reference);
  if (m.amount) parts.push(money(m.amount));
  if (m.code) parts.push("Mã đơn: " + m.code);
  if (m.name) parts.push(`Tên: ${m.previousName || "—"} → ${m.name}`);
  if (m.device) parts.push(m.device);
  if (m.count !== undefined) parts.push(`${m.count} phiên`);
  if (m.purpose)
    parts.push(
      (
        {
          invite: "Thư mời",
          verify: "Thư xác minh",
          reset: "Thư khôi phục",
        } as any
      )[m.purpose] || "Email tài khoản",
    );
  return parts.join(" · ") || "—";
}
export function AccountHistory({
  id,
  revision,
}: {
  id: string;
  revision: number;
}) {
  const [kind, setKind] = useState("all"),
    [page, setPage] = useState(1);
  return (
    <section className="panel account-history">
      <div className="section-heading">
        <div>
          <h2>Lịch sử tài khoản</h2>
          <p className="muted">
            Ghi nhận người thực hiện, thời gian và nội dung thay đổi.
          </p>
        </div>
        <Field label="Lọc lịch sử">
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">Tất cả hoạt động</option>
            <option value="account">Tài khoản & bảo mật</option>
            <option value="login">Đăng nhập & phiên</option>
            <option value="lab">Tham gia Lab & quyền học</option>
            <option value="payment">Giao dịch trước đây</option>
          </select>
        </Field>
      </div>
      <HistoryPage
        key={`${id}-${kind}-${page}-${revision}`}
        id={id}
        kind={kind}
        page={page}
        turn={setPage}
      />
    </section>
  );
}
function HistoryPage({
  id,
  kind,
  page,
  turn,
}: {
  id: string;
  kind: string;
  page: number;
  turn: (p: number) => void;
}) {
  const history = useApi<any>(
    `/api/admin/accounts/${id}/history?kind=${kind}&page=${page}`,
  );
  if (history.loading) return <Loading />;
  if (history.error)
    return <ErrorBox message={history.error} retry={history.reload} />;
  const total = history.data?.total || 0;
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Sự kiện</th>
              <th>Người thực hiện</th>
              <th>Chi tiết</th>
            </tr>
          </thead>
          <tbody>
            {history.data?.items.map((a: any) => (
              <tr key={a.id}>
                <td>{date(a.created_at)}</td>
                <td>{labels[a.action] || a.action}</td>
                <td>
                  {a.actor_name || "Hệ thống"}
                  {a.actor_email && <small>{a.actor_email}</small>}
                </td>
                <td className="history-detail">{detail(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!total && (
          <p className="account-empty">
            Chưa có hoạt động thuộc nhóm này. Thao tác mới sẽ được ghi lại tại
            đây.
          </p>
        )}
      </div>
      <div className="account-pagination">
        <button
          className="btn secondary small"
          disabled={page === 1}
          onClick={() => turn(page - 1)}
        >
          Mới hơn
        </button>
        <span>
          {total} hoạt động · Trang {page}/{Math.max(1, Math.ceil(total / 25))}
        </span>
        <button
          className="btn secondary small"
          disabled={page * 25 >= total}
          onClick={() => turn(page + 1)}
        >
          Cũ hơn
        </button>
      </div>
    </>
  );
}
