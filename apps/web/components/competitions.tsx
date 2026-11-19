"use client";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ExternalLink,
  Search,
  Trophy,
  RefreshCw,
} from "lucide-react";
import { useApi, api } from "../lib/api";
import { PageTitle, Loading, ErrorBox, Field, Notice } from "./ui";

type Status = "open" | "upcoming" | "needs_check" | "closed";
type Item = {
  id: string;
  title: string;
  organizer: string;
  summary: string;
  topics: string[];
  region: string;
  eligibility: string;
  eligibilityNote: string | null;
  format: string;
  location: string;
  deadlineAt: string | null;
  deadlineDate: string | null;
  deadlineLabel: string;
  eventPeriod: string;
  costNote: string;
  registrationUrl: string | null;
  registrationKind: string;
  registrationVerified: boolean;
  sourceUrl: string;
  rulesUrl: string | null;
  seasonYear: number | null;
  completedOn: string | null;
  resultsUrl: string | null;
  verifiedAt: string;
  status: Status;
  stale: boolean;
  hidden?: boolean;
};
type Listing = {
  items: Item[];
  revision: number;
  checkedAt: string | null;
  nextReviewAt: string | null;
  intervalDays: number;
  stale: boolean;
  scheduleActive?: boolean;
  schedule?: { active: boolean };
  counts: Record<Status, number>;
  completedCount: number;
};
const statuses: Record<Status, string> = {
  open: "Đang nhận hồ sơ",
  upcoming: "Sắp mở đăng ký",
  needs_check: "Cần kiểm tra hạn",
  closed: "Đã đóng đăng ký",
};
const topics: Record<string, string> = {
  embedded: "Lập trình nhúng",
  robotics: "Robotics",
  iot: "IoT / Edge AI",
  fpga: "FPGA / Vi mạch",
};
function vnDate(value: string | null, withTime = false) {
  return value
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        ...(withTime ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
      }).format(new Date(value))
    : "Chưa có thông tin";
}
function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
}
function SourceLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer external">
      {children}
      <ExternalLink size={15} aria-hidden="true" />
    </a>
  );
}
export function Competitions() {
  const list = useApi<Listing>("/api/competitions");
  const [query, setQuery] = useState(""),
    [state, setState] = useState("all"),
    [view, setView] = useState("all"),
    [region, setRegion] = useState("all"),
    [topic, setTopic] = useState("all");
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void list.reload();
    }, 60_000);
    return () => clearInterval(timer);
  }, [list.reload]);
  const items = useMemo(
    () =>
      list.data?.items.filter(
        (c) =>
          (state === "all" ||
            (state === "completed" ? !!c.completedOn : c.status === state)) &&
          (view === "all" ||
            (view === "current"
              ? c.status !== "closed"
              : c.seasonYear === 2026)) &&
          (region === "all" || c.region === region) &&
          (topic === "all" || c.topics.includes(topic)) &&
          normalize(
            c.title + " " + c.organizer + " " + c.eligibility + " " + c.summary,
          ).includes(normalize(query)),
      ) || [],
    [list.data, state, view, region, topic, query],
  );
  return (
    <>
      <PageTitle
        eyebrow="CƠ HỘI CHO SINH VIÊN"
        title="Cuộc thi IoT & Embedded"
        description="Khám phá cơ hội đang mở và các mùa thi năm 2026. Xem đối tượng tham gia, lịch trình, thể lệ và sản phẩm đã dự thi để chuẩn bị cho sân chơi phù hợp."
      />
      <section
        className="panel competition-update"
        aria-label="Tình trạng cập nhật"
      >
        <div>
          <RefreshCw size={20} />
          <strong>Rà soát mỗi 14 ngày</strong>
        </div>
        <p>
          Kiểm tra gần nhất: <b>{vnDate(list.data?.checkedAt || null, true)}</b>{" "}
          · Lần rà soát tiếp theo dự kiến:{" "}
          <b>{vnDate(list.data?.nextReviewAt || null)}</b>.
        </p>
        {list.data && !list.data.scheduleActive && (
          <p>
            Lịch tự động chưa được kích hoạt; thông tin hiện tại được kiểm tra
            theo ngày ghi trên từng cuộc thi.
          </p>
        )}
        {list.data?.stale && (
          <Notice type="error">
            Đã đến hạn rà soát. Các thông tin chưa được xác minh lại sẽ không
            được gắn nhãn đang nhận hồ sơ.
          </Notice>
        )}
        <p className="muted">
          Thông tin này miễn phí. Đăng ký trên website của ban tổ chức; tài
          khoản EP LAB không thay thế tài khoản dự thi. Hãy kiểm tra thể lệ và
          chi phí trước khi gửi hồ sơ.
        </p>
      </section>
      <div className="competition-stats" aria-label="Tổng quan cuộc thi">
        <span>
          <b>{list.data?.counts.open ?? "—"}</b> đang nhận hồ sơ
        </span>
        <span>
          <b>{list.data?.counts.upcoming ?? "—"}</b> sắp mở
        </span>
        <span>
          <b>{list.data?.counts.needs_check ?? "—"}</b> cần kiểm tra hạn
        </span>
        <span>
          <b>{list.data?.counts.closed ?? "—"}</b> đã đóng đăng ký
        </span>
        <span>
          <b>{list.data?.completedCount ?? "—"}</b> đã diễn ra
        </span>
      </div>
      <div
        className="competition-views"
        role="group"
        aria-label="Chọn nhóm cuộc thi"
      >
        {[
          ["all", "Tất cả cuộc thi"],
          ["current", "Cơ hội hiện tại"],
          ["2026", "Mùa thi 2026"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`btn ${view === key ? "primary" : "secondary"}`}
            aria-pressed={view === key}
            onClick={() => {
              setView(key);
              setState("all");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {(view === "2026" || state === "completed") && (
        <p className="competition-note">
          Các mùa đã diễn ra được giữ lại để tham khảo đề tài và thể lệ. “Đã
          đóng đăng ký” chưa có nghĩa là đã tổ chức xong; lịch mùa tiếp theo chỉ
          được thêm khi có thông báo chính thức.
        </p>
      )}
      <section className="panel competition-filters" aria-label="Lọc cuộc thi">
        <Field label="Tìm cuộc thi">
          <div className="competition-search">
            <Search size={18} />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tên, công nghệ hoặc đối tượng…"
              aria-label="Tìm cuộc thi"
              maxLength={150}
            />
          </div>
        </Field>
        <Field label="Trạng thái">
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="completed">Đã diễn ra · có tổng kết</option>
            {Object.entries(statuses).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Phạm vi">
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="all">Việt Nam & quốc tế</option>
            <option value="vietnam">Tổ chức tại Việt Nam</option>
            <option value="international">Quốc tế</option>
          </select>
        </Field>
        <Field label="Lĩnh vực">
          <select value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="all">Tất cả lĩnh vực</option>
            {Object.entries(topics).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </section>
      {list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : !list.data && list.loading ? (
        <Loading />
      ) : (
        <>
          <p className="muted" aria-live="polite">
            {items.length} cuộc thi phù hợp
          </p>
          {items.length === 0 ? (
            <section className="panel">
              <h2>Chưa có cuộc thi phù hợp bộ lọc</h2>
              <p>
                Thử đổi lĩnh vực, phạm vi hoặc xem các mùa đã đóng để chuẩn bị
                cho lần sau.
              </p>
            </section>
          ) : (
            <div className="competition-grid">
              {items.map((c) => (
                <CompetitionCard key={c.id} item={c} />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
function CompetitionCard({ item: c }: { item: Item }) {
  const joinable = c.status === "open" && c.registrationVerified;
  const button =
    c.registrationKind === "submission"
      ? "Nộp hồ sơ dự thi"
      : c.registrationKind === "organizer"
        ? "Đăng ký tại trang cuộc thi"
        : "Mở form đăng ký";
  return (
    <article className="panel competition-card">
      <div className="competition-card-top">
        <span
          className={`competition-status ${c.completedOn ? "completed" : c.status}`}
        >
          {c.completedOn ? `Đã diễn ra · ${c.seasonYear}` : statuses[c.status]}
        </span>
        <span>
          {c.region === "vietnam" ? "Việt Nam" : "Quốc tế"}
          {c.seasonYear ? ` · Mùa ${c.seasonYear}` : ""}
        </span>
      </div>
      <h2>{c.title}</h2>
      <p className="competition-organizer">{c.organizer}</p>
      <p>{c.summary}</p>
      <div className="competition-tags">
        {c.topics.map((t) => (
          <span key={t}>{topics[t]}</span>
        ))}
      </div>
      <dl className="competition-details">
        {c.completedOn && (
          <div>
            <dt>Ngày kết thúc / trao giải</dt>
            <dd>{vnDate(c.completedOn)}</dd>
          </div>
        )}
        <div>
          <dt>
            <CalendarDays size={17} />
            Hạn đăng ký / nộp hồ sơ
          </dt>
          <dd>
            {c.deadlineLabel}
            {c.deadlineAt && (
              <small>Giờ Việt Nam: {vnDate(c.deadlineAt, true)} (UTC+7)</small>
            )}
          </dd>
        </div>
        <div>
          <dt>Thời gian tham gia</dt>
          <dd>{c.eventPeriod}</dd>
        </div>
        <div>
          <dt>Ai có thể tham gia?</dt>
          <dd>{c.eligibility}</dd>
        </div>
        <div>
          <dt>Hình thức & địa điểm</dt>
          <dd>
            {
              {
                online: "Trực tuyến",
                "in-person": "Trực tiếp",
                hybrid: "Kết hợp",
              }[c.format]
            }{" "}
            · {c.location}
          </dd>
        </div>
        <div>
          <dt>Chi phí & chuẩn bị</dt>
          <dd>{c.costNote}</dd>
        </div>
      </dl>
      {c.eligibilityNote && (
        <p className="competition-note">{c.eligibilityNote}</p>
      )}
      {c.stale && !c.completedOn && (
        <p className="competition-note">
          Thông tin quá 14 ngày chưa được xác minh lại. Kiểm tra thông báo mới
          tại nguồn chính thức.
        </p>
      )}
      <div className="competition-actions">
        {c.registrationUrl &&
          c.status !== "closed" &&
          c.status !== "upcoming" && (
            <a
              className={`btn ${joinable ? "primary" : "secondary"}`}
              href={c.registrationUrl}
              target="_blank"
              rel="noopener noreferrer external"
            >
              {joinable ? button : "Xem đăng ký · xác nhận lại hạn"}
              <ExternalLink size={17} />
            </a>
          )}
        {c.resultsUrl && (
          <SourceLink href={c.resultsUrl}>Kết quả / tổng kết</SourceLink>
        )}
        {c.sourceUrl !== c.resultsUrl && (
          <SourceLink href={c.sourceUrl}>Nguồn chính thức</SourceLink>
        )}
        {c.rulesUrl &&
          c.rulesUrl !== c.sourceUrl &&
          c.rulesUrl !== c.resultsUrl && (
            <SourceLink href={c.rulesUrl}>Thể lệ / lịch trình</SourceLink>
          )}
      </div>
      <small className="competition-source">
        Đã đối chiếu ngày {vnDate(c.verifiedAt)} ·{" "}
        {new URL(c.sourceUrl).hostname}
      </small>
    </article>
  );
}
export function CompetitionsAdmin() {
  const list = useApi<Listing>("/api/admin/competitions"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState<string | null>(null);
  if (!list.data && list.loading) return <Loading />;
  if (list.error) return <ErrorBox message={list.error} retry={list.reload} />;
  return (
    <section className="panel">
      <h2>
        <Trophy size={22} /> Quản lý cuộc thi Embedded
      </h2>
      <p>
        Rà soát định kỳ 14 ngày · Kiểm tra gần nhất:{" "}
        {vnDate(list.data?.checkedAt || null, true)}.
      </p>
      <p>
        {list.data?.schedule?.active
          ? "Lịch tự động đã bật. Các cuộc thi bị ẩn sẽ được giữ ẩn khi cập nhật."
          : "Lịch tự động chưa được kích hoạt."}
      </p>
      {error && <Notice type="error">{error}</Notice>}
      <div className="competition-admin-list">
        {list.data?.items.map((c) => (
          <article key={c.id}>
            <div>
              <strong>{c.title}</strong>
              <p>
                {c.hidden
                  ? "Đang ẩn"
                  : c.completedOn
                    ? `Đã diễn ra · ${c.seasonYear}`
                    : statuses[c.status]}{" "}
                · Kiểm tra {vnDate(c.verifiedAt)}
              </p>
              <SourceLink href={c.sourceUrl}>Nguồn chính thức</SourceLink>
            </div>
            <button
              className="btn secondary small"
              disabled={busy !== null}
              onClick={async () => {
                setBusy(c.id);
                setError("");
                try {
                  await api(`/api/admin/competitions/${c.id}`, "PATCH", {
                    hidden: !c.hidden,
                    expectedRevision: list.data!.revision,
                  });
                  await list.reload();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === c.id
                ? "Đang lưu…"
                : c.hidden
                  ? "Hiện lại"
                  : "Ẩn cuộc thi"}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
