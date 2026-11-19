"use client";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ShieldCheck, Mail, KeyRound } from "lucide-react";
import { api, setCsrf } from "../lib/api";
import { useAuth } from "./context";
import { Field, Notice, Loading } from "./ui";
import { PasswordInput } from "./password-input";
import { SupportContact } from "./support-contact";
export function AuthPage({ mode }: { mode: string }) {
  const { user, refresh, mailMode, loading } = useAuth(),
    router = useRouter();
  const [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [token, setToken] = useState("");
  useEffect(() => {
    const t = new URLSearchParams(window.location.hash.slice(1)).get("token");
    if (t) {
      setToken(t);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);
  const mfa = mode === "/dang-nhap" && !!user?.mfaEnabled && !user.mfaVerified;
  const login = mode === "/dang-nhap";
  useEffect(() => {
    if (login && !loading && user && !mfa)
      router.replace(user.role === "admin" ? "/quan-tri" : "/");
  }, [login, loading, user, mfa, router]);
  const register = mode === "/dang-ky",
    forgot = mode === "/quen-mat-khau",
    verify = mode === "/xac-minh",
    reset = mode === "/dat-lai-mat-khau",
    invite = mode === "/nhan-tai-khoan";
  const title = invite
    ? "Nhận tài khoản EP LAB"
    : mfa
      ? "Xác thực hai bước"
      : register
        ? "Tạo tài khoản miễn phí"
        : forgot
          ? "Quên mật khẩu?"
          : verify
            ? "Xác minh email"
            : reset
              ? "Đặt mật khẩu mới"
              : "Đăng nhập EP LAB";
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (invite) {
        if (f.get("password") !== f.get("confirmPassword"))
          throw new Error("Hai lần nhập mật khẩu chưa khớp.");
        const r = await api("/api/auth/accept-invitation", "POST", {
          token,
          password: f.get("password"),
          acceptedTerms: f.get("terms") === "on",
        });
        setMessage(r.message);
      } else if (mfa) {
        await api("/api/auth/mfa/verify", "POST", { code: f.get("code") });
        await refresh();
      } else if (register) {
        const r = await api("/api/auth/register", "POST", {
          name: f.get("name"),
          phone: f.get("phone"),
          email: f.get("email"),
          password: f.get("password"),
        });
        setMessage(r.message);
      } else if (forgot) {
        const r = await api("/api/auth/forgot", "POST", {
          email: f.get("email"),
        });
        setMessage(r.message);
      } else if (verify) {
        const r = await api("/api/auth/verify", "POST", { token });
        setMessage(r.message);
      } else if (reset) {
        const r = await api("/api/auth/reset", "POST", {
          token,
          password: f.get("password"),
        });
        setMessage(r.message);
      } else {
        const r = await api("/api/auth/login", "POST", {
          email: f.get("email"),
          password: f.get("password"),
        });
        setCsrf(r.csrf);
        await refresh();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (login && (loading || (user && !mfa))) return <Loading />;
  return (
    <div className={`auth-layout${login ? " login-layout" : ""}`}>
      {!login && (
        <div className="auth-story">
          <span className="eyebrow">EP LAB / KHÔNG GIAN HỌC TẬP</span>
          <h1>
            Từ tò mò.
            <br />
            Đến tự tay
            <br />
            <span>làm được.</span>
          </h1>
          <p>
            Học một dòng code, nối một đường mạch,
            <br />
            tạo một chi tiết. Mỗi bước đều có ý nghĩa.
          </p>
          <div className="auth-story-bottom">
            <ShieldCheck size={23} />
            <span>
              Một tài khoản cho
              <br />
              <b>Nhúng C · KiCad · SOLIDWORKS</b>
            </span>
          </div>
        </div>
      )}
      <section className="auth-panel">
        <div className="auth-icon">{verify ? <Mail /> : <KeyRound />}</div>
        <h2>{title}</h2>
        <p>
          {invite
            ? "Tự đặt mật khẩu để nhận tài khoản và xác minh email. Gửi yêu cầu tham gia Lab để người chủ trì xét duyệt quyền học đầy đủ."
            : register
              ? "Đăng ký miễn phí, xác minh email rồi đăng nhập để học các bài miễn phí và lưu tiến độ. Tham gia Lab để được cấp quyền học đầy đủ và hỗ trợ."
              : mfa
                ? "Nhập mã từ ứng dụng xác thực hoặc một mã phục hồi."
                : forgot
                  ? "Chúng tôi sẽ gửi liên kết để bạn đặt lại mật khẩu."
                  : verify
                    ? "Xác nhận địa chỉ email để tiếp tục đăng nhập."
                    : login
                      ? "Nhập email và mật khẩu để tiếp tục."
                      : "Tạo mật khẩu mới cho tài khoản của bạn."}
        </p>
        {error && <Notice type="error">{error}</Notice>}
        {message && <Notice type="success">{message}</Notice>}
        {(reset || invite || verify) && message ? (
          <Link className="btn primary full" href="/dang-nhap">
            Tiếp tục đăng nhập
          </Link>
        ) : register && message ? (
          <div className="stack">
            <p>
              Tài khoản không cần thanh toán để sử dụng. Sau khi xác minh email,
              bạn có thể đăng nhập, học bài miễn phí và gửi yêu cầu tham gia
              Lab.
            </p>
            <Link className="btn primary full" href="/dang-nhap">
              Đăng nhập sau khi xác minh
            </Link>
            <Link className="btn secondary full" href="/hoc-thu">
              Xem bài miễn phí ngay
            </Link>
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            {mfa ? (
              <Field label="Mã xác thực">
                <input
                  name="code"
                  required
                  autoComplete="one-time-code"
                  placeholder="Mã 6 chữ số hoặc mã phục hồi"
                />
              </Field>
            ) : (
              <>
                {register && (
                  <Field label="Tên của bạn">
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                      placeholder="Nguyễn Văn A"
                    />
                  </Field>
                )}
                {!verify && !reset && !invite && (
                  <Field label="Email">
                    <input
                      name="email"
                      type="email"
                      required
                      autoComplete={login ? "username" : "email"}
                      autoCapitalize="none"
                      spellCheck={false}
                      placeholder="ban@example.com"
                    />
                  </Field>
                )}
                {register && (
                  <Field
                    label="Số điện thoại / Zalo"
                    hint="Số di động 10 số hoặc +84. Chỉ bạn và admin xem để hỗ trợ việc học qua Zalo."
                  >
                    <input
                      name="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      maxLength={32}
                      placeholder="Nhập số điện thoại của bạn"
                    />
                  </Field>
                )}
                {!forgot && !verify && (
                  <Field
                    label={reset || invite ? "Mật khẩu mới" : "Mật khẩu"}
                    hint={
                      register || reset || invite
                        ? "Từ 8 ký tự. Không bắt buộc chữ hoa hoặc ký tự đặc biệt."
                        : undefined
                    }
                  >
                    <PasswordInput
                      name="password"
                      required
                      minLength={register || reset || invite ? 8 : 1}
                      maxLength={128}
                      autoComplete={
                        register || reset || invite
                          ? "new-password"
                          : "current-password"
                      }
                      placeholder="Nhập mật khẩu của bạn"
                    />
                  </Field>
                )}
                {invite && (
                  <>
                    <Field label="Nhập lại mật khẩu">
                      <PasswordInput
                        name="confirmPassword"
                        minLength={8}
                        maxLength={128}
                        required
                        autoComplete="new-password"
                      />
                    </Field>
                    <label className="checkbox">
                      <input name="terms" type="checkbox" required />
                      Tôi đồng ý với{" "}
                      <Link href="/dieu-khoan" target="_blank">
                        điều khoản
                      </Link>{" "}
                      và{" "}
                      <Link href="/quyen-rieng-tu" target="_blank">
                        quyền riêng tư
                      </Link>
                      .
                    </label>
                    {!token && (
                      <Notice>
                        Thư mời thiếu mã. Hãy mở liên kết trong email hoặc yêu
                        cầu người chủ trì gửi lại.
                      </Notice>
                    )}
                  </>
                )}
                {verify && !token && (
                  <Notice>
                    Liên kết xác minh thiếu mã. Hãy mở liên kết trong email.
                  </Notice>
                )}
                {reset && !token && (
                  <Notice>
                    Liên kết khôi phục thiếu mã. Hãy yêu cầu gửi lại.
                  </Notice>
                )}
              </>
            )}
            {!register && !forgot && !verify && !reset && !invite && !mfa && (
              <Link className="form-link" href="/quen-mat-khau">
                Quên mật khẩu?
              </Link>
            )}
            <button
              className="btn primary full"
              disabled={
                busy ||
                ((verify || reset || invite) && !token) ||
                (invite && !!message)
              }
            >
              {busy
                ? "Đang xử lý…"
                : invite
                  ? "Nhận tài khoản và lưu mật khẩu"
                  : mfa
                    ? "Xác thực"
                    : register
                      ? "Tạo tài khoản miễn phí"
                      : forgot
                        ? "Gửi liên kết khôi phục"
                        : verify
                          ? "Xác minh email"
                          : reset
                            ? "Lưu mật khẩu mới"
                            : "Đăng nhập"}
              <ArrowRight size={17} />
            </button>
            {login && !mfa && (
              <small className="login-session-hint">
                Giữ đăng nhập tối đa 7 ngày trên trình duyệt này. Hãy đăng xuất
                nếu dùng máy chung.
              </small>
            )}
          </form>
        )}
        {register && (
          <small className="form-terms">
            Tạo tài khoản đồng nghĩa bạn đã đọc{" "}
            <Link href="/dieu-khoan">điều khoản</Link> và{" "}
            <Link href="/quyen-rieng-tu">quyền riêng tư</Link>.
          </small>
        )}
        {(login || register) && !mfa && (
          <div className="auth-switch">
            {register ? (
              <>
                Đã có tài khoản? <Link href="/dang-nhap">Đăng nhập</Link>
              </>
            ) : (
              <>
                Chưa có tài khoản? <Link href="/dang-ky">Đăng ký miễn phí</Link>
              </>
            )}
          </div>
        )}
        {register && <SupportContact />}
        {(message || verify || reset || invite) &&
          !((reset || invite || verify) && message) && (
            <Link className="form-link" href="/dang-nhap">
              Về trang đăng nhập
            </Link>
          )}
        {mailMode === "local" && (register || forgot) && (
          <small className="local-hint">
            Bản chạy local chưa gửi email ra ngoài. Thư thử được lưu riêng để
            người vận hành kiểm tra.
          </small>
        )}
      </section>
    </div>
  );
}
