"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { api, money } from "../lib/api";
import { Field, Notice } from "./ui";
export function OrderApproval({
  order,
  close,
  saved,
}: {
  order: any;
  close: () => void;
  saved: () => void;
}) {
  const refund = order.status === "paid";
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="panel stack form-narrow"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError("");
        setBusy(true);
        try {
          if (refund) {
            await api("/api/auth/reauth", "POST", {
              password: f.get("password"),
              code: f.get("code") || undefined,
            });
            await api(`/api/admin/orders/${order.id}/refund`, "POST", {
              reference: f.get("reference"),
              note: f.get("note"),
              confirmed: true,
            });
          } else
            await api(`/api/admin/orders/${order.id}/approve`, "POST", {
              reference: f.get("reference"),
              note: f.get("note"),
              amount: Number(f.get("amount")),
              accountNumber: f.get("accountNumber"),
              confirmed: true,
            });
          saved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="section-heading">
        <h2>
          {refund
            ? "Ghi nhận khoản hoàn đã thực hiện"
            : "Đối soát tiền thực nhận"}
        </h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Đóng đối soát"
          onClick={close}
        >
          <X />
        </button>
      </div>
      <p>
        {order.code} · {order.email} · {money(order.amount)}
      </p>
      {error && <Notice type="error">{error}</Notice>}
      <Notice>
        {refund
          ? "Biểu mẫu này không gửi tiền từ ngân hàng. Chỉ ghi nhận sau khi khoản hoàn đã thành công; quyền học sẽ bị thu hồi."
          : "Kiểm tra sao kê ngân hàng trước khi duyệt. Không dựa riêng vào ảnh biên lai."}
      </Notice>
      {!refund && (
        <>
          <Field label="Số tiền thực nhận">
            <input
              name="amount"
              type="number"
              required
              min="1"
              defaultValue={order.amount}
            />
          </Field>
          <Field label="Số tài khoản nhận trên giao dịch">
            <input
              name="accountNumber"
              required
              defaultValue={order.bank_snapshot.accountNumber}
            />
          </Field>
        </>
      )}
      <Field
        label={refund ? "Mã giao dịch hoàn tiền" : "Mã giao dịch ngân hàng"}
      >
        <input name="reference" required minLength={5} maxLength={100} />
      </Field>
      <Field label="Ghi chú đối soát">
        <textarea name="note" required minLength={5} maxLength={1000} />
      </Field>
      {refund && (
        <>
          <Field label="Mật khẩu người chủ trì">
            <input name="password" type="password" required />
          </Field>
          <Field label="Mã MFA (nếu đã bật)">
            <input name="code" />
          </Field>
        </>
      )}
      <label className="checkbox">
        <input type="checkbox" required />
        Tôi đã kiểm tra giao dịch thực tế trên tài khoản ngân hàng
      </label>
      <button className="btn primary" disabled={busy}>
        {busy
          ? "Đang xử lý…"
          : refund
            ? "Ghi nhận hoàn tiền và thu hồi quyền"
            : "Xác nhận tiền và kích hoạt"}
      </button>
    </form>
  );
}
