"use client";
import Link from "next/link";
import { AdminAccounts } from "./admin-accounts";
import { CompetitionsAdmin } from "./competitions";
import { LabMembershipAdmin } from "./lab-membership";
import { SupportContact } from "./support-contact";
import { useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  BookOpen,
  FlaskConical,
  ShieldCheck,
  Settings,
  FileText,
  Save,
  Upload,
  X,
  LockKeyhole,
  Play,
} from "lucide-react";
import { api, useApi, money, date } from "../lib/api";
import { useAuth } from "./context";
import { PageTitle, Empty, Loading, Notice, Field } from "./ui";
type Kind = "courses" | "chapters" | "lessons";
const defaults: Record<Kind, Record<string, any>> = {
  courses: {
    slug: "",
    category: "embedded",
    title: "",
    description: "",
    level: "Cơ bản",
    status: "draft",
    position: 0,
  },
  chapters: { course_id: "", title: "", position: 0 },
  lessons: {
    chapter_id: "",
    slug: "",
    title: "",
    summary: "",
    objectives: "",
    prerequisites: "",
    level: "basic",
    listed: false,
    audience: "student",
    content: "",
    exercise: "",
    answer: "",
    status: "draft",
    preview: false,
    position: 0,
    duration_minutes: null,
    software_version: "",
    video_url: null,
    video_type: "none",
    author: "EP LAB",
    language: "Tiếng Việt",
    source_url: null,
    rights: "owned",
    embed_verified: false,
  },
};
const names: Record<string, string> = {
  courses: "Khóa học",
  chapters: "Chương",
  lessons: "Bài học",
  users: "Tài khoản",
  settings: "Cấu hình",
  audit: "Nhật ký",
  competitions: "Cuộc thi",
  lab: "Tham gia Lab",
};
export function Admin() {
  const { user, loading } = useAuth();
  const allowed =
    user?.role === "admin" &&
    user.verified &&
    (!user.mfaEnabled || user.mfaVerified);
  const overview = useApi(allowed ? "/api/admin/overview" : null);
  const [tab, setTab] = useState("overview"),
    [editing, setEditing] = useState<any>(null),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const list = useApi<any[]>(
    allowed &&
      tab !== "overview" &&
      tab !== "settings" &&
      tab !== "users" &&
      tab !== "competitions" &&
      tab !== "lab"
      ? `/api/admin/${tab}`
      : null,
  );
  async function run(fn: () => Promise<void>) {
    setError("");
    setMessage("");
    setBusy(true);
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
        title="Đăng nhập quản trị"
        description="Khu vực dành riêng cho hai người chủ trì EP LAB."
        href="/dang-nhap"
        label="Đăng nhập"
      />
    );
  if (user.role !== "admin")
    return (
      <Empty
        title="Bạn không có quyền quản trị"
        description="Tài khoản người tham gia không được truy cập khu vực này."
        href="/"
        label="Về không gian học"
      />
    );
  if (!allowed)
    return (
      <Empty
        title="Hoàn tất xác thực hai bước"
        description="Tài khoản này đã bật xác thực hai bước. Nhập mã để hoàn tất đăng nhập."
        href="/dang-nhap"
        label="Hoàn tất đăng nhập"
      />
    );
  const stats = overview.data?.counts;
  return (
    <>
      <div className="button-row">
        <Link className="btn secondary" href="/quan-tri/nhung-c">
          Giao bài và chấm bài C
        </Link>
        <Link className="btn secondary" href="/quan-tri/kicad">
          Giao bài và chấm bài KiCad
        </Link>
        <Link className="btn secondary" href="/quan-tri/solidworks">
          Giao bài và chấm bài SOLIDWORKS
        </Link>
      </div>
      <PageTitle
        eyebrow="QUẢN TRỊ EP LAB"
        title="Không gian điều hành"
        description="Quản lý học liệu, duyệt tham gia Lab và hỗ trợ người học."
      />
      <div className="admin-tabs">
        {[
          "overview",
          "courses",
          "chapters",
          "lessons",
          "users",
          "competitions",
          "lab",
          "settings",
          "audit",
        ].map((t) => (
          <button
            key={t}
            className={tab === t ? "selected" : ""}
            onClick={() => {
              setTab(t);
              setEditing(null);
              setError("");
              setMessage("");
            }}
          >
            {t === "overview" ? "Tổng quan" : names[t]}
          </button>
        ))}
      </div>
      {error && <Notice type="error">{error}</Notice>}
      {message && <Notice type="success">{message}</Notice>}
      {tab === "overview" ? (
        <>
          <div className="stats-grid">
            {[
              [Users, "Người tham gia", stats?.students ?? "—"],
              [BookOpen, "Bài đã xuất bản", stats?.published ?? "—"],
              [FlaskConical, "Yêu cầu chờ duyệt", stats?.pending ?? "—"],
              [ShieldCheck, "Người chủ trì", `${stats?.admins ?? "—"} / 2`],
            ].map(([Icon, title, value], i) => {
              const I = Icon as typeof Users;
              return (
                <div className="panel stat" key={i}>
                  <I size={22} />
                  <span>{title as string}</span>
                  <strong>{String(value)}</strong>
                </div>
              );
            })}
          </div>
          <section className="panel">
            <h2>Tham gia Lab để học và được hỗ trợ</h2>
            <p>
              Không thu phí tham gia. Có {stats?.lab_members ?? 0} yêu cầu đã
              được duyệt. Admin xem mục tiêu học tập và cấp quyền cho người tham
              gia.
            </p>
            <div className="button-row">
              <button className="btn primary" onClick={() => setTab("lab")}>
                Duyệt yêu cầu tham gia Lab
              </button>
              <button
                className="btn secondary"
                onClick={() => setTab("lessons")}
              >
                Quản lý bài học
              </button>
            </div>
          </section>
        </>
      ) : tab === "settings" ? (
        overview.data && (
          <SettingsForm
            initial={overview.data.settings}
            onSave={() => {
              void overview.reload();
              setMessage("Đã lưu cấu hình.");
            }}
          />
        )
      ) : tab === "lab" ? (
        <LabMembershipAdmin changed={() => void overview.reload()} />
      ) : tab === "competitions" ? (
        <CompetitionsAdmin />
      ) : tab === "users" ? (
        <AdminAccounts changed={() => void overview.reload()} />
      ) : list.loading ? (
        <Loading />
      ) : list.error ? (
        <Notice type="error">{list.error}</Notice>
      ) : ["courses", "chapters", "lessons"].includes(tab) ? (
        <>
          <div className="section-heading">
            <h2>{names[tab]}</h2>
            <button
              className="btn primary small"
              onClick={() => setEditing({ ...defaults[tab as Kind] })}
            >
              <Plus size={16} />
              Thêm {names[tab].toLowerCase()}
            </button>
          </div>
          {editing && (
            <EntityEditor
              key={`${tab}-${editing.id || "new"}`}
              kind={tab as Kind}
              initial={editing}
              close={() => setEditing(null)}
              saved={() => {
                setEditing(null);
                void list.reload();
                void overview.reload();
                setMessage("Đã lưu nội dung.");
              }}
            />
          )}
          <div className="panel table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tiêu đề</th>
                  <th>Trạng thái</th>
                  <th>Thứ tự</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {list.data?.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <strong>{row.title}</strong>
                      {row.slug && <small>{row.slug}</small>}
                    </td>
                    <td>
                      <span
                        className={`badge ${row.status === "published" ? "free" : "draft"}`}
                      >
                        {row.status === "published"
                          ? "Đã xuất bản"
                          : row.status
                            ? "Bản nháp"
                            : "Chương"}
                        {row.preview ? " · Học thử" : ""}
                      </span>
                    </td>
                    <td>{row.position}</td>
                    <td>
                      <div className="button-row">
                        {row.slug &&
                          (tab === "lessons" || tab === "courses") && (
                            <Link
                              className="icon-button"
                              aria-label={`Xem ${row.title}`}
                              title="Mở nội dung với quyền chủ trì"
                              href={`/${tab === "lessons" ? "bai-hoc" : "khoa-hoc"}/${row.slug}`}
                            >
                              <Play size={17} />
                            </Link>
                          )}
                        <button
                          className="icon-button"
                          aria-label={`Sửa ${row.title}`}
                          onClick={() => setEditing(row)}
                        >
                          <Pencil size={17} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`Xóa ${row.title}`}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Xóa “${row.title}”? Nội dung đã xóa không được khôi phục tự động.`,
                              )
                            )
                              void run(async () => {
                                await api(
                                  `/api/admin/${tab}/${row.id}`,
                                  "DELETE",
                                );
                                await list.reload();
                                setMessage("Đã xóa nội dung.");
                              });
                          }}
                        >
                          <Trash2 size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === "audit" ? (
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Người thực hiện</th>
                <th>Thao tác</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.map((a) => (
                <tr key={a.id}>
                  <td>{date(a.created_at)}</td>
                  <td>{a.actor || "Hệ thống"}</td>
                  <td>{a.action}</td>
                  <td>
                    <code>{JSON.stringify(a.metadata)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
function EntityEditor({
  kind,
  initial,
  close,
  saved,
}: {
  kind: Kind;
  initial: any;
  close: () => void;
  saved: () => void;
}) {
  const [values, setValues] = useState<Record<string, any>>({
      ...defaults[kind],
      ...initial,
    }),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const parents = useApi<any[]>(
      kind === "chapters"
        ? "/api/admin/courses"
        : kind === "lessons"
          ? "/api/admin/chapters"
          : null,
    ),
    resources = useApi<any[]>(
      kind === "lessons" && initial.id
        ? `/api/admin/lessons/${initial.id}/resources`
        : null,
    );
  const courses = useApi<any[]>(
    kind === "lessons" ? "/api/admin/courses" : null,
  );
  const parentCourse = parents.data?.find(
    (p) => p.id === values.chapter_id,
  )?.course_id;
  const isSolidworks = courses.data?.some(
    (c) => c.id === parentCourse && c.category === "solidworks",
  );
  const set = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }));
  const text = (k: string, label: string, large = false) => (
    <Field key={k} label={label}>
      {large ? (
        <textarea
          value={values[k] ?? ""}
          rows={k === "content" ? 9 : 3}
          onChange={(e) => set(k, e.target.value)}
        />
      ) : (
        <input
          value={values[k] ?? ""}
          onChange={(e) => set(k, e.target.value)}
          required={["title", "slug"].includes(k)}
        />
      )}
    </Field>
  );
  const select = (k: string, label: string, options: [string, string][]) => (
    <Field key={k} label={label}>
      <select
        value={values[k] ?? ""}
        onChange={(e) => set(k, e.target.value)}
        required
      >
        <option value="" disabled>
          Chọn…
        </option>
        {options.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <section className="panel editor">
      <div className="section-heading">
        <h2>
          {initial.id ? "Chỉnh sửa" : "Tạo"} {names[kind].toLowerCase()}
        </h2>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Đóng chỉnh sửa"
        >
          <X />
        </button>
      </div>
      {error && <Notice type="error">{error}</Notice>}
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          try {
            const body: Record<string, any> = {};
            for (const k of Object.keys(defaults[kind])) body[k] = values[k];
            if (kind === "lessons") {
              body.video_url = body.video_url || null;
              body.source_url = body.source_url || null;
              if (isSolidworks) {
                body.video_type = "none";
                body.video_url = null;
                body.embed_verified = false;
              }
            }
            await api(
              `/api/admin/${kind}${initial.id ? "/" + initial.id : ""}`,
              initial.id ? "PUT" : "POST",
              body,
            );
            saved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          {text("title", "Tiêu đề")}
          {kind !== "chapters" &&
            text("slug", "Đường dẫn ngắn (chữ không dấu, nối bằng dấu -)")}
          {kind === "courses" && (
            <>
              {select("category", "Lĩnh vực", [
                ["embedded", "Lập trình nhúng C"],
                ["kicad", "KiCad"],
                ["solidworks", "SOLIDWORKS"],
              ])}
              {text("level", "Trình độ")}
            </>
          )}
          {kind === "chapters" &&
            select(
              "course_id",
              "Thuộc khóa học",
              (parents.data || []).map((p) => [p.id, p.title]),
            )}
          {kind === "lessons" &&
            select(
              "chapter_id",
              "Thuộc chương",
              (parents.data || []).map((p) => [p.id, p.title]),
            )}
          <Field label="Thứ tự">
            <input
              type="number"
              min="0"
              max="9999"
              value={values.position}
              onChange={(e) => set("position", Number(e.target.value))}
            />
          </Field>
          {kind !== "chapters" &&
            select("status", "Xuất bản", [
              ["draft", "Bản nháp"],
              ["published", "Đã xuất bản"],
            ])}
        </div>
        {kind === "courses" && text("description", "Mô tả", true)}
        {kind === "lessons" && (
          <>
            {text("summary", "Giới thiệu ngắn công khai", true)}
            <div className="form-grid">
              {select("level", "Cấp độ bài học", [
                ["basic", "Cơ bản"],
                ["intermediate", "Trung cấp"],
                ["advanced", "Nâng cao"],
                ["all", "Từ cơ bản đến nâng cao"],
              ])}
              {select("audience", "Đối tượng truy cập", [
                ["student", "Người tham gia"],
                ["host", "Chỉ người chủ trì"],
              ])}
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={values.listed}
                onChange={(e) => set("listed", e.target.checked)}
              />
              Công khai tên và mục tiêu khi còn nháp, với nhãn “Sắp ra mắt”
            </label>
            <p className="muted">
              Bản nháp mặc định được ẩn. Tài liệu dành riêng cho người chủ trì
              luôn được bảo vệ.
            </p>
            <div className="form-grid">
              {text("objectives", "Mục tiêu bài học", true)}
              {text("prerequisites", "Kiến thức đầu vào", true)}
            </div>
            {text("content", "Nội dung bài học (văn bản thuần)", true)}
            {text("exercise", "Bài tập thực hành", true)}
            {text("answer", "Gợi ý / đáp án riêng", true)}
            {isSolidworks && (
              <Notice>
                Học theo giáo trình PDF và người chủ trì trực tiếp hướng dẫn.
                Tài liệu đính kèm được quản lý phía dưới.
              </Notice>
            )}
            <div className="form-grid">
              {!isSolidworks &&
                select("video_type", "Cách hiển thị video", [
                  ["none", "Không có video"],
                  ["reference", "Liên kết tham khảo mở ngoài"],
                  ["youtube", "Nhúng YouTube đã kiểm tra"],
                ])}
              {!isSolidworks && text("video_url", "URL video HTTPS")}
              {text("source_url", "Nguồn gốc học liệu")}
              {text("author", "Tác giả")}
              {text("language", "Ngôn ngữ")}
              {text("software_version", "Phiên bản phần mềm / ghi chú")}
              {select("rights", "Quyền sử dụng", [
                ["owned", "EP LAB biên soạn"],
                ["licensed", "Đã được cấp quyền"],
                ["public_reference", "Tham khảo công khai"],
                ["unverified", "Chưa xác minh"],
              ])}
              <Field label="Thời lượng đã xác minh (phút)">
                <input
                  type="number"
                  min="1"
                  value={values.duration_minutes ?? ""}
                  onChange={(e) =>
                    set(
                      "duration_minutes",
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                />
              </Field>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={values.preview}
                onChange={(e) => set("preview", e.target.checked)}
              />
              Cho phép khách xem học thử
            </label>
            {!isSolidworks && (
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={values.embed_verified}
                  onChange={(e) => set("embed_verified", e.target.checked)}
                />
                Đã kiểm tra video nhúng phát được trong trình duyệt
              </label>
            )}
          </>
        )}
        <div className="button-row">
          <button className="btn primary" disabled={busy}>
            <Save size={17} />
            {busy ? "Đang lưu…" : "Lưu nội dung"}
          </button>
          <button type="button" className="btn secondary" onClick={close}>
            Đóng
          </button>
        </div>
      </form>
      {kind === "lessons" && initial.id && (
        <div className="resource-admin">
          <h3>Tài liệu đính kèm</h3>
          <p className="muted">
            Tối đa 25 MB. Nhận C/H, KiCad, PDF, STEP/STL, SLDPRT/SLDASM và văn
            bản; tệp chỉ được tải qua kiểm tra quyền.
          </p>
          <input
            aria-label="Tải tài liệu lên"
            type="file"
            accept=".c,.h,.txt,.md,.kicad_sch,.kicad_pcb,.pdf,.step,.stp,.stl,.sldprt,.sldasm"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const form = new FormData();
              form.append("file", f);
              try {
                await api(
                  `/api/admin/lessons/${initial.id}/resources`,
                  "POST",
                  form,
                );
                await resources.reload();
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          />
          {resources.data?.map((r) => (
            <div className="resource-row" key={r.id}>
              <span>
                {r.name} · {(r.size / 1024).toFixed(1)} KB
              </span>
              <button
                className="icon-button danger"
                aria-label={`Xóa tài liệu ${r.name}`}
                onClick={async () => {
                  if (!window.confirm(`Xóa tài liệu ${r.name}?`)) return;
                  try {
                    await api(`/api/admin/resources/${r.id}`, "DELETE");
                    await resources.reload();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
function SettingsForm({
  initial,
  onSave,
}: {
  initial: any;
  onSave: () => void;
}) {
  return (
    <section className="panel">
      <h2>Thông tin Lab</h2>
      <p>
        EP LAB không thu phí tham gia. Học viên gửi yêu cầu; người chủ trì xét
        duyệt để cấp quyền học đầy đủ ba môn.
      </p>
      <SupportContact />
    </section>
  );
}
