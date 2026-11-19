"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check,
  ArrowRight,
  Copy,
  ShieldCheck,
  BookOpen,
  Monitor,
  CheckCircle2,
  Clock3,
  Save,
} from "lucide-react";
import { api, useApi, money, date, setCsrf } from "../lib/api";
import { useAuth } from "./context";
import { Empty, Loading, Notice, PageTitle, Field } from "./ui";
import { PasswordInput } from "./password-input";
export function Profile() {
  const requestedTab = useSearchParams().get("tab");
  const { user, loading, refresh } = useAuth(),
    router = useRouter();
  const progress = useApi<any[]>(user ? "/api/classroom/progress" : null),
    sessions = useApi<any[]>(user ? "/api/auth/sessions" : null);
  const [tab, setTab] = useState("learning"),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [mfa, setMfa] = useState<any>(null),
    [codes, setCodes] = useState<string[]>([]),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (
      requestedTab &&
      ["learning", "profile", "security"].includes(requestedTab)
    )
      setTab(requestedTab);
  }, [requestedTab]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (!user)
    return (
      <Empty
        title="Không gian học tập của riêng bạn"
        description="Đăng nhập để xem tiến độ, ghi chú và thông tin tài khoản."
        href="/dang-nhap"
        label="Đăng nhập"
      />
    );
  if (user.mfaEnabled && !user.mfaVerified)
    return (
      <Empty
        title="Cần xác thực hai bước"
        description="Hoàn tất mã xác thực để tiếp tục."
        href="/dang-nhap"
        label="Nhập mã xác thực"
      />
    );
  return (
    <>
      <PageTitle
        eyebrow="TÀI KHOẢN CỦA TÔI"
        title={`Chào ${user.name}.`}
        description="Tiếp tục từ nơi bạn dừng lại, theo nhịp của riêng mình."
      />
      <div className="account-banner">
        <div className="avatar large">{user.name[0]}</div>
        <div>
          <h3>{user.name}</h3>
          <span>{user.email}</span>
        </div>
        <span className={`badge ${user.active ? "free" : "draft"}`}>
          {user.role === "admin"
            ? "Người chủ trì · miễn phí"
            : user.active
              ? "Đã có quyền học đầy đủ"
              : "Tài khoản miễn phí"}
        </span>
        {!user.active && (
          <Link href="/tham-gia-lab" className="btn primary small">
            Tham gia Lab <ArrowRight size={15} />
          </Link>
        )}
      </div>
      {user.role === "student" && !user.active && (
        <Notice>
          Tài khoản của bạn đã sử dụng được. Học các bài miễn phí và lưu tiến độ
          ngay; gửi yêu cầu tham gia Lab để được admin cấp quyền học đầy đủ.{" "}
          <Link href="/hoc-thu">Chọn bài miễn phí →</Link>
        </Notice>
      )}
      <div className="filter-tabs account-tabs">
        {[
          ["learning", "Tiến độ học"],
          ["profile", "Hồ sơ"],
          ["security", "Bảo mật & phiên"],
        ].map(([v, t]) => (
          <button
            className={tab === v ? "selected" : ""}
            key={v}
            onClick={() => setTab(v)}
          >
            {t}
          </button>
        ))}
      </div>
      {error && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}
      {tab === "learning" ? (
        <div className="panel">
          {progress.loading ? (
            <Loading />
          ) : progress.error ? (
            <Notice type="error">{progress.error}</Notice>
          ) : progress.data?.length ? (
            <>
              <div className="section-heading">
                <h2>
                  {progress.data.filter((p) => p.completed).length} bài đã hoàn
                  thành
                </h2>
                <Link href="/">
                  Khám phá tiếp <ArrowRight size={16} />
                </Link>
              </div>
              {progress.data.map((p) => (
                <Link className="progress-row" href={p.href} key={p.slug}>
                  {p.completed ? (
                    <CheckCircle2 className="green-text" />
                  ) : (
                    <Clock3 />
                  )}
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.course_title}</p>
                  </div>
                  <span>{p.completed ? "Đã hoàn thành" : "Đang học"}</span>
                  <ArrowRight size={17} />
                </Link>
              ))}
            </>
          ) : (
            <Empty
              title="Bài học đầu tiên đang chờ bạn"
              description="Tiến độ giáo trình mới xuất hiện ở đây khi bạn học, lưu ghi chú hoặc hoàn thành bài trong Lớp học."
              href="/hoc-thu"
              label="Chọn một bài học thử"
            />
          )}
        </div>
      ) : tab === "profile" ? (
        <form
          className="panel form-narrow stack"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              await api("/api/auth/profile", "PATCH", {
                name: f.get("name"),
                phone: f.get("phone") || undefined,
              });
              await refresh();
              setMessage("Đã cập nhật hồ sơ.");
            });
          }}
        >
          <h2>Thông tin cá nhân</h2>
          <Field label="Tên hiển thị">
            <input
              name="name"
              defaultValue={user.name}
              required
              minLength={2}
              maxLength={80}
            />
          </Field>
          <Field label="Email đã xác minh">
            <input value={user.email} readOnly />
          </Field>
          <Field
            label="Số điện thoại / Zalo"
            hint="Chỉ bạn và admin xem số này để liên hệ hỗ trợ việc học."
          >
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={user.phone || ""}
              required={user.role === "student"}
              maxLength={32}
              placeholder="Bổ sung số điện thoại"
            />
          </Field>
          <button className="btn primary" disabled={busy}>
            <Save size={16} />
            Lưu thay đổi
          </button>
          <Link href="/tham-gia-lab">Xem trạng thái tham gia Lab →</Link>
        </form>
      ) : (
        <div className="security-grid">
          <form
            className="panel stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void run(async () => {
                await api("/api/auth/password", "POST", {
                  current: f.get("current"),
                  password: f.get("password"),
                });
                setCsrf(null);
                await refresh();
                router.push("/dang-nhap");
              });
            }}
          >
            <h2>Đổi mật khẩu</h2>
            <Field label="Mật khẩu hiện tại">
              <input
                type="password"
                name="current"
                autoComplete="current-password"
                required
              />
            </Field>
            <Field
              label="Mật khẩu mới"
              hint="Từ 8 ký tự; các phiên hiện tại sẽ được thu hồi."
            >
              <PasswordInput
                name="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
              />
            </Field>
            <button className="btn secondary" disabled={busy}>
              Cập nhật mật khẩu
            </button>
          </form>
          <div className="panel">
            <h2>
              <ShieldCheck size={20} />
              Xác thực hai bước
            </h2>
            {user.mfaEnabled ? (
              <Notice type="success">
                Xác thực hai bước EP LAB đã được bật.
              </Notice>
            ) : (
              <>
                <p>
                  Tùy chọn thêm một lớp bảo vệ. Bạn có thể sử dụng tài khoản
                  bằng email và mật khẩu mà không cần bật xác thực hai bước.
                </p>
                {!mfa ? (
                  <form
                    className="stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void run(async () =>
                        setMfa(
                          await api("/api/auth/mfa/setup", "POST", {
                            password: f.get("password"),
                          }),
                        ),
                      );
                    }}
                  >
                    <p>
                      Nhập mật khẩu đăng nhập EP LAB để tạo mã QR. Sau đó quét
                      QR bằng ứng dụng xác thực trên điện thoại và nhập mã 6 chữ
                      số để hoàn tất.
                    </p>
                    <Field label="Xác nhận mật khẩu">
                      <input
                        name="password"
                        type="password"
                        required
                        autoComplete="current-password"
                      />
                    </Field>
                    <button className="btn secondary" disabled={busy}>
                      Thiết lập xác thực hai bước
                    </button>
                  </form>
                ) : (
                  <form
                    className="stack"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      void run(async () => {
                        const r = await api("/api/auth/mfa/enable", "POST", {
                          code: f.get("code"),
                        });
                        setCodes(r.recoveryCodes);
                        setMfa(null);
                        await refresh();
                      });
                    }}
                  >
                    <img
                      className="mfa-qr"
                      src={mfa.qr}
                      alt="QR thiết lập ứng dụng xác thực"
                    />
                    <small>
                      Quét QR bằng ứng dụng xác thực trên điện thoại. Nhập mã 6
                      chữ số đang hiện trong ứng dụng, không phải mã gửi qua
                      email. Giữ bí mật mã thiết lập.
                    </small>
                    <Field label="Mã xác thực 6 chữ số">
                      <input
                        name="code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        pattern="[0-9]{6}"
                      />
                    </Field>
                    <button className="btn primary" disabled={busy}>
                      Bật xác thực hai bước
                    </button>
                  </form>
                )}
              </>
            )}
            {codes.length > 0 && (
              <div className="recovery">
                <Notice>
                  Lưu các mã này ở nơi riêng. Mỗi mã chỉ dùng một lần và chỉ
                  hiển thị lúc này.
                </Notice>
                <pre>{codes.join("\n")}</pre>
                <button
                  className="btn secondary small"
                  onClick={() => setCodes([])}
                >
                  Tôi đã lưu an toàn
                </button>
              </div>
            )}
          </div>
          <div className="panel span-two">
            <h2>Phiên đăng nhập</h2>
            {sessions.data?.map((s) => (
              <div className="session-row" key={s.id}>
                <Monitor size={21} />
                <div>
                  <strong>
                    {s.current
                      ? "Thiết bị hiện tại"
                      : "Một phiên đăng nhập khác"}
                  </strong>
                  <p>
                    {s.user_agent?.slice(0, 120) ||
                      "Không xác định trình duyệt"}
                  </p>
                  <small>Bắt đầu {date(s.created_at)}</small>
                </div>
                <button
                  className="btn secondary small"
                  onClick={() =>
                    run(async () => {
                      await api(`/api/auth/sessions/${s.id}`, "DELETE");
                      await sessions.reload();
                      if (s.current) await refresh();
                    })
                  }
                >
                  Đăng xuất phiên
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
