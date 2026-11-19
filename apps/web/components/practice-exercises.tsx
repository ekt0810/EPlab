"use client";
import { usePracticeTrack } from "./practice-track";
import Link from "next/link";
import { ExerciseGuide } from "./exercise-guide";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowRight, FlaskConical } from "lucide-react";
import { useAuth } from "./context";
import { useApi, date } from "../lib/api";
import { Loading, ErrorBox, PageTitle } from "./ui";
import { PracticeNav, PracticeLocked } from "./practice-nav";
import { PracticeUpload } from "./practice-upload";
import { PracticeSelfChecks, usePracticeDraft } from "./practice-self-checks";
import { PracticeNext, exerciseStatus, statusLabels } from "./practice-next";
export function PracticeExercises() {
  const track = usePracticeTrack();
  const params = useSearchParams(),
    { user } = useAuth();
  const { data, error, loading, reload } = useApi<any[]>(
      `${track.api}/exercises`,
    ),
    [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [module, setModule] = useState(0),
    [level, setLevel] = useState(() => {
      const requested = params.get("level") || "all";
      return ["basic", "intermediate", "advanced", "all"].includes(requested)
        ? requested
        : "all";
    });
  return (
    <>
      <PageTitle
        eyebrow={`${track.label} · PHÒNG THỰC HÀNH`}
        title={track.title}
        description={track.description}
      />
      <PracticeNav />
      {data && user?.active && <PracticeNext exercises={data} />}
      <section
        className="pathway-levels"
        aria-label="Lộ trình cơ bản đến nâng cao"
      >
        {[
          {
            id: "basic",
            label: "Cơ bản",
            goal: "Làm quen công cụ và xây nền tảng.",
          },
          {
            id: "intermediate",
            label: "Trung cấp",
            goal: "Kết hợp kỹ năng, tự kiểm tra kết quả.",
          },
          {
            id: "advanced",
            label: "Nâng cao",
            goal: "Giải quyết lỗi, thiết kế hệ thống và bàn giao đồ án.",
          },
        ].map((x, i) => {
          const items = data?.filter((e) => e.level === x.id) || [];
          return (
            <button
              type="button"
              className={`panel pathway-level ${level === x.id ? "selected" : ""}`}
              key={x.id}
              onClick={() => {
                setLevel(x.id);
                setModule(0);
              }}
            >
              <span>BƯỚC {i + 1}</span>
              <h2>{x.label}</h2>
              <p>{x.goal}</p>
              <b>
                {user
                  ? `${items.filter((e) => e.passed).length}/${items.length} bài đã đạt`
                  : `${items.length} bài thực hành`}
              </b>
            </button>
          );
        })}
      </section>
      <p className="practice-note">
        Đi từ cơ bản → trung cấp → nâng cao. Bài trước là gợi ý chuẩn bị; người
        chủ trì có thể giao bài phù hợp với trình độ của bạn.
      </p>
      <div className="filters practice-filters">
        <label>
          Tìm bài tập
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tên bài hoặc mã bài…"
          />
        </label>
        {user && (
          <label>
            Trạng thái
            <select
              aria-label="Trạng thái"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Tất cả trạng thái</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Mức độ
          <select
            aria-label="Mức độ"
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              setModule(0);
            }}
          >
            <option value="all">Tất cả mức độ</option>
            <option value="basic">Cơ bản</option>
            <option value="intermediate">Trung cấp</option>
            <option value="advanced">Nâng cao</option>
          </select>
        </label>
        <label>
          Chương thực hành{" "}
          <select
            value={module}
            onChange={(e) => setModule(Number(e.target.value))}
          >
            <option value={0}>Tất cả chương</option>
            {Array.from(new Set(data?.map((e) => e.module) || []))
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  Chương {n}
                </option>
              ))}
          </select>
        </label>
      </div>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : (
        <div className="practice-grid">
          {!data?.some(
            (e) =>
              (!module || e.module === module) &&
              (level === "all" || e.level === level) &&
              (status === "all" || exerciseStatus(e) === status) &&
              `${e.id} ${e.title} ${e.brief}`
                .toLocaleLowerCase("vi")
                .includes(query.trim().toLocaleLowerCase("vi")),
          ) && (
            <p className="practice-empty">
              Không có bài phù hợp. Hãy đổi từ khóa hoặc bộ lọc.
            </p>
          )}
          {data
            ?.filter(
              (e) =>
                (!module || e.module === module) &&
                (level === "all" || e.level === level) &&
                (status === "all" || exerciseStatus(e) === status) &&
                `${e.id} ${e.title} ${e.brief}`
                  .toLocaleLowerCase("vi")
                  .includes(query.trim().toLocaleLowerCase("vi")),
            )
            .map((e) => (
              <Link
                className="panel practice-exercise-card"
                href={`${track.base}/thuc-hanh/${e.id}`}
                key={e.id}
              >
                <FlaskConical size={26} />
                <span className="eyebrow">
                  BÀI {e.id.slice(1)} · CHƯƠNG {e.module}
                </span>
                <h2>{e.title}</h2>
                <span className="badge">
                  {!user
                    ? "Cần được duyệt tham gia Lab để làm và nộp bài"
                    : statusLabels[exerciseStatus(e)]}
                </span>
                <p>{e.brief}</p>
                <div>
                  <span>
                    {e.difficulty} · Khoảng {e.minutes} phút
                  </span>
                  <ArrowRight size={18} />
                </div>
              </Link>
            ))}
        </div>
      )}
    </>
  );
}
export function ReferenceDiagram({ type }: { type: string }) {
  if (type !== "led")
    return (
      <p className="practice-note">
        Làm theo đề và đối chiếu từng tiêu chí. Giữ file thiết kế gốc để trao
        đổi với người chủ trì khi ảnh chưa đủ rõ.
      </p>
    );
  return (
    <figure className="practice-schematic">
      <svg
        viewBox="0 0 600 150"
        role="img"
        aria-label="Sơ đồ ví dụ nguồn 5 V qua điện trở 1 kiloohm và LED về GND"
      >
        <g fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M50 65h100m70 0h100m32 0h178v35m-15 0h30m-24 7h18m-13 7h8" />
          <rect x="150" y="53" width="70" height="24" />
          <path d="M320 50l30 15-30 15zM352 50v30M352 42l15-15m-2 0h4v4M364 48l15-15m-2 0h4v4" />
        </g>
        <g fill="currentColor" fontSize="16">
          <text x="35" y="40">
            +5 V
          </text>
          <text x="155" y="40">
            R1 1 kΩ
          </text>
          <text x="318" y="110">
            D1 LED
          </text>
          <text x="501" y="140">
            GND
          </text>
        </g>
      </svg>
      <figcaption>Ví dụ nguyên lý · Vf LED giả định 2 V · I ≈ 3 mA</figcaption>
    </figure>
  );
}
export function PracticeExercise({ id }: { id: string }) {
  const track = usePracticeTrack();
  const { user, loading: authLoading } = useAuth(),
    allowed = !!user?.active;
  const { data, error, loading, reload } = useApi(
      allowed ? `${track.api}/exercises/${id}` : null,
    ),
    assigned = useApi<any[]>(user ? `${track.api}/assignments` : null),
    params = useSearchParams(),
    assignmentId = params.get("assignment");
  if (authLoading) return <Loading />;
  if (!allowed)
    return (
      <>
        <PracticeNav />
        <PracticeLocked />
      </>
    );
  if (loading || (!data && !error)) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const assignment = assigned.data?.find((a) => a.id === assignmentId);
  return (
    <ExerciseWorkspace
      key={`${user!.id}:${id}:${assignmentId || "self"}`}
      id={id}
      data={data}
      userId={user!.id}
      assignmentId={assignmentId}
      assignment={assignment}
    />
  );
}
function ExerciseWorkspace({
  id,
  data,
  userId,
  assignmentId,
  assignment,
}: {
  id: string;
  data: any;
  userId: string;
  assignmentId: string | null;
  assignment: any;
}) {
  const track = usePracticeTrack();
  const draft = usePracticeDraft(
    `eplab:practice:${userId}:${track.id}:${id}:${assignmentId || "self"}`,
    data.checks,
  );
  if (!draft.ready) return <Loading />;
  return (
    <>
      <PageTitle
        eyebrow={`${track.label} · THỰC HÀNH ${id.slice(1)} · CHƯƠNG ${data.module}`}
        title={data.title}
        description={data.brief}
      />
      <PracticeNav />
      <div className="panel pathway-prerequisites">
        <strong>
          {data.difficulty} · Bài {data.order || id.slice(1)}
        </strong>
        <p>
          Gợi ý chuẩn bị:{" "}
          {data.prerequisites?.length
            ? data.prerequisites.map((x: string) => (
                <Link key={x} href={`${track.base}/thuc-hanh/${x}`}>
                  {x.toUpperCase()} →{" "}
                </Link>
              ))
            : "Bắt đầu từ bài này."}
        </p>
        <Link
          className="btn secondary"
          href={`${track.base}/trao-doi?exercise=${id}`}
        >
          Trao đổi với người chủ trì
        </Link>
      </div>
      {assignment && (
        <section className="panel practice-assignment-note">
          <h2>Yêu cầu người chủ trì giao</h2>
          <p className="preserve">
            {assignment.instructions || "Làm theo đề bài và tiêu chí bên dưới."}
          </p>
          <p>
            {assignment.due_at
              ? `Hạn nộp: ${date(assignment.due_at)}`
              : "Không đặt hạn nộp"}
            {assignment.closed ? " · Đã đóng nhận bài" : ""}
          </p>
          {assignment.due_at && new Date(assignment.due_at) < new Date() && (
            <p>
              Đã qua hạn. Bạn vẫn có thể nộp bổ sung nếu người chủ trì chưa đóng
              bài.
            </p>
          )}
        </section>
      )}
      <nav className="practice-steps" aria-label="Các bước làm bài">
        <a href="#read-task">1. Đọc đề và ôn bài</a>
        <a href="#self-checks">2. Làm và tự kiểm tra</a>
        <a href="#submit-work">3. Nộp bài và nhận góp ý</a>
      </nav>
      <div className="practice-layout">
        <article id="read-task" className="panel practice-article">
          {track.id === "kicad" && <ReferenceDiagram type={data.reference} />}
          <ExerciseGuide exercise={data} />
          <h2>Bạn cần thực hiện</h2>
          <ol>
            {data.steps.map((s: string) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {data.extension && (
            <section className="exercise-checks">
              <h2>{data.extension.title}</h2>
              <ol>
                {data.extension.steps.map((s: string) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </section>
          )}
          <PracticeSelfChecks
            exercise={data}
            checks={draft.checks}
            onChange={draft.setChecks}
          />
          <h2>Bằng chứng cần nộp</h2>
          <ul>
            {data.deliverables.map((s: string) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <details className="practice-report">
            <summary>Bảng tiêu chí · 100 điểm</summary>
            <div className="practice-rubric">
              {data.criteria.map((c: any) => (
                <div key={c.id}>
                  <b>{c.id.toUpperCase()}</b>
                  <p>{c.text}</p>
                  <span>{c.points}đ</span>
                </div>
              ))}
            </div>
          </details>
          <p className="practice-note">
            Mốc đạt: {data.passScore}/100 và đủ bằng chứng cho mọi tiêu chí.
            Người chủ trì đọc bằng chứng và quyết định kết quả từng tiêu chí.
            Ghi rõ ca tự kiểm tra đã làm và phần chưa hoàn thành.
          </p>
        </article>
        <aside>
          <PracticeUpload
            id={id}
            assignmentId={assignmentId}
            assignment={assignment}
            notes={draft.notes}
            onNotes={draft.setNotes}
            checks={draft.checks}
            draftStatus={draft.status}
            onSaved={draft.clear}
          />
        </aside>
      </div>
    </>
  );
}
