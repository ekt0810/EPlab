"use client";
import { useState } from "react";
import { Plus, Search, ArrowRight, X } from "lucide-react";
import { api, useApi, date } from "../lib/api";
import { Field, Notice, Loading, ErrorBox } from "./ui";
import { AccountDetail, AccountStatus } from "./account-detail";

export function AdminAccounts({ changed }: { changed: () => void }) {
  const [search, setSearch] = useState({
      q: "",
      role: "all",
      state: "all",
      page: 1,
    }),
    [draft, setDraft] = useState(""),
    [creating, setCreating] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [revision, setRevision] = useState(0),
    [message, setMessage] = useState("");
  function reload() {
    setRevision((n) => n + 1);
    changed();
  }
  if (selected)
    return (
      <>
        <button className="btn secondary" onClick={() => setSelected(null)}>
          ← Danh sách tài khoản
        </button>
        {message && <Notice>{message}</Notice>}
        <AccountDetail key={selected} id={selected} changed={reload} />
      </>
    );
  const query = new URLSearchParams({
    ...search,
    page: String(search.page),
  }).toString();
  return (
    <section className="account-manager">
      <div className="section-heading">
        <div>
          <h2>Quản lý tài khoản</h2>
          <p className="muted">
            Tạo hồ sơ, cấp quyền sau đối soát và theo dõi lịch sử từng người.
          </p>
        </div>
        <button className="btn primary" onClick={() => setCreating(!creating)}>
          <Plus size={18} />
          Tạo tài khoản
        </button>
      </div>
      <Notice>
        Mọi người được tạo tài khoản miễn phí và học các bài miễn phí. Admin
        duyệt yêu cầu tham gia Lab để cấp quyền học đầy đủ ba môn và hỗ trợ. Hai
        người chủ trì có sẵn quyền quản trị. Học viên được mời tự đặt mật khẩu
        qua thư mời.
      </Notice>
      {creating && (
        <CreateAccount
          close={() => setCreating(false)}
          created={(id, message) => {
            setMessage(message);
            setCreating(false);
            reload();
            setSelected(id);
          }}
        />
      )}
      <form
        className="panel account-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch({ ...search, q: draft.trim(), page: 1 });
        }}
      >
        <Field label="Tìm tài khoản">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={200}
            placeholder="Tên, email hoặc số điện thoại"
            type="search"
          />
        </Field>
        <Field label="Vai trò">
          <select
            value={search.role}
            onChange={(e) =>
              setSearch({ ...search, role: e.target.value, page: 1 })
            }
          >
            <option value="all">Tất cả vai trò</option>
            <option value="student">Người tham gia</option>
            <option value="admin">Người chủ trì</option>
          </select>
        </Field>
        <Field label="Trạng thái">
          <select
            value={search.state}
            onChange={(e) =>
              setSearch({ ...search, state: e.target.value, page: 1 })
            }
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="invited">Chờ nhận tài khoản</option>
            <option value="unverified">Chưa xác minh</option>
            <option value="unpaid">Tài khoản miễn phí</option>
            <option value="active">Đã có quyền học đầy đủ</option>
            <option value="blocked">Đã khóa</option>
          </select>
        </Field>
        <button className="btn secondary">
          <Search size={18} />
          Tìm
        </button>
      </form>
      <AccountList
        key={query + revision}
        query={query}
        page={search.page}
        turn={(page) => setSearch({ ...search, page })}
        open={(id) => {
          setMessage("");
          setSelected(id);
        }}
      />
    </section>
  );
}
function CreateAccount({
  close,
  created,
}: {
  close: () => void;
  created: (id: string, message: string) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      className="panel stack form-narrow"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError("");
        try {
          const r = await api("/api/admin/accounts", "POST", {
            name: f.get("name"),
            phone: f.get("phone"),
            email: f.get("email"),
            note: f.get("note"),
          });
          created(r.id, r.message);
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="section-heading">
        <h3>Tạo tài khoản người tham gia</h3>
        <button
          type="button"
          className="icon-button"
          aria-label="Đóng tạo tài khoản"
          onClick={close}
        >
          <X />
        </button>
      </div>
      {error && <Notice type="error">{error}</Notice>}
      <Field label="Họ và tên">
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          autoComplete="off"
        />
      </Field>
      <Field label="Email nhận thư mời">
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
        />
      </Field>
      <Field label="Số điện thoại / Zalo học viên">
        <input
          name="phone"
          type="tel"
          inputMode="tel"
          required
          maxLength={32}
          autoComplete="off"
        />
      </Field>
      <Field
        label="Ghi chú tạo hồ sơ"
        hint="Ví dụ: Người tham gia lớp KiCad tháng 11."
      >
        <textarea name="note" required minLength={5} maxLength={1000} />
      </Field>
      <p>
        Thư mời có hiệu lực 30 phút. Admin không xem hoặc đặt hộ mật khẩu của
        người tham gia.
      </p>
      <button className="btn primary" disabled={busy}>
        {busy ? "Đang tạo và gửi thư…" : "Tạo hồ sơ & gửi thư mời"}
      </button>
    </form>
  );
}
function AccountList({
  query,
  page,
  turn,
  open,
}: {
  query: string;
  page: number;
  turn: (page: number) => void;
  open: (id: string) => void;
}) {
  const list = useApi<any>("/api/admin/accounts?" + query);
  if (list.loading) return <Loading />;
  if (list.error) return <ErrorBox message={list.error} retry={list.reload} />;
  const total = list.data?.total || 0;
  return (
    <>
      <p className="muted">{total} tài khoản phù hợp</p>
      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Tài khoản</th>
              <th>Vai trò & quyền học</th>
              <th>Trạng thái</th>
              <th>Đăng nhập gần nhất</th>
              <th>Quản lý</th>
            </tr>
          </thead>
          <tbody>
            {list.data?.items.map((u: any) => (
              <tr key={u.id}>
                <td>
                  <strong>{u.name}</strong>
                  <small>{u.email}</small>
                  <small>{u.phone || "Chưa bổ sung số điện thoại"}</small>
                  <small>Tạo ngày {date(u.created_at)}</small>
                </td>
                <td>
                  {u.role === "admin"
                    ? `Người chủ trì ${u.admin_slot}`
                    : "Người tham gia"}
                  <small>
                    {u.role === "admin"
                      ? "Miễn phí"
                      : u.active
                        ? "Đã có quyền học đầy đủ"
                        : "Tài khoản miễn phí"}
                  </small>
                </td>
                <td>
                  <AccountStatus user={u} />
                </td>
                <td>
                  {u.last_login_at ? date(u.last_login_at) : "Chưa ghi nhận"}
                </td>
                <td>
                  <button
                    className="btn secondary small"
                    onClick={() => open(u.id)}
                  >
                    Hồ sơ & lịch sử <ArrowRight size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!total && (
          <p className="account-empty">
            Không có tài khoản phù hợp với bộ lọc.
          </p>
        )}
      </div>
      <div className="account-pagination">
        <button
          className="btn secondary"
          disabled={page === 1}
          onClick={() => turn(page - 1)}
        >
          Trang trước
        </button>
        <span>
          Trang {page}/{Math.max(1, Math.ceil(total / 25))}
        </span>
        <button
          className="btn secondary"
          disabled={page * 25 >= total}
          onClick={() => turn(page + 1)}
        >
          Trang sau
        </button>
      </div>
    </>
  );
}
