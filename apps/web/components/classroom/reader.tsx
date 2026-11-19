"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  List,
  Save,
} from "lucide-react";
import { api, useApi } from "../../lib/api";
import { useAuth } from "../context";
import { Loading, ErrorBox } from "../ui";
import { ClassroomStage, makeScenes } from "./stage";
import { ClassroomPanel, Narration } from "./side-panel";
import { baseFor, type Course, type Detail, type Track } from "./types";

export function ClassroomReader({ track, id }: { track: Track; id: string }) {
  const detail = useApi<Detail>(`/api/classroom/${track}/lessons/${id}`),
    course = useApi<Course>(`/api/classroom/${track}`);
  if (detail.loading || course.loading) return <Loading />;
  if (detail.error || course.error || !detail.data || !course.data)
    return (
      <div className="cr-locked">
        <h1>Lớp học EP LAB</h1>
        <ErrorBox
          message={detail.error || course.error || "Chưa tải được bài học."}
          retry={() => {
            void detail.reload();
            void course.reload();
          }}
        />
        <div className="button-row">
          <Link className="btn primary" href="/tham-gia-lab">
            Tham gia Lab
          </Link>
          <Link className="btn secondary" href={`${baseFor(track)}/lop-hoc`}>
            Về lộ trình
          </Link>
        </div>
      </div>
    );
  return (
    <ClassroomSession
      key={`${track}-${id}`}
      track={track}
      initial={detail.data}
      course={course.data}
    />
  );
}
function ClassroomSession({
  track,
  initial,
  course,
}: {
  track: Track;
  initial: Detail;
  course: Course;
}) {
  const router = useRouter(),
    { user } = useAuth(),
    l = initial.lesson,
    scenes = makeScenes(l);
  const [scene, setScene] = useState(
      Math.min(initial.progress?.scene || 0, scenes.length - 1),
    ),
    [note, setNote] = useState(initial.progress?.note || ""),
    [checklist, setChecklist] = useState<number[]>(
      initial.progress?.checklist || [],
    ),
    [passed, setPassed] = useState(initial.progress?.quiz_passed || false),
    [completed, setCompleted] = useState(initial.progress?.completed || false);
  const [answer, setAnswer] = useState<number | null>(null),
    [result, setResult] = useState<{
      correct: boolean;
      explanation: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(""),
    [outline, setOutline] = useState(true);
  const queue = useRef(Promise.resolve()),
    mounted = useRef(true),
    snapshot = JSON.stringify({ scene, note, checklist, completed }),
    latest = useRef(snapshot),
    saved = useRef(snapshot);
  latest.current = snapshot;
  const endpoint = `/api/classroom/${track}/lessons/${l.id}`;
  function persist(value = latest.current) {
    if (!user) return Promise.resolve();
    const run = queue.current
      .catch(() => {})
      .then(async () => {
        if (mounted.current) setSaving(true);
        try {
          await api(endpoint + "/progress", "PUT", JSON.parse(value));
          saved.current = value;
          if (mounted.current && latest.current === value) {
            setStatus("Đã lưu vào tài khoản");
            setError("");
          }
        } catch (e) {
          if (mounted.current) {
            setError((e as Error).message);
            setStatus("Chưa lưu được");
          }
          throw e;
        } finally {
          if (mounted.current) setSaving(false);
        }
      });
    queue.current = run;
    return run;
  }
  useEffect(() => {
    mounted.current = true;
    if (window.innerWidth <= 900) setOutline(false);
    return () => {
      mounted.current = false;
      window.speechSynthesis?.cancel();
    };
  }, []);
  useEffect(() => {
    if (!user || snapshot === saved.current) return;
    setStatus("Có thay đổi chưa lưu");
    const t = setTimeout(() => {
      void persist().catch(() => {});
    }, 900);
    return () => clearTimeout(t);
  }, [snapshot, user?.id]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (user && latest.current !== saved.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [user]);
  useEffect(() => {
    window.speechSynthesis?.cancel();
  }, [scene]);
  async function navigate(href: string) {
    try {
      if (user && latest.current !== saved.current) await persist();
      router.push(href);
    } catch {}
  }
  async function submitQuiz() {
    setBusy(true);
    setError("");
    try {
      const r = await api<{
        correct: boolean;
        explanation: string;
        passed: boolean;
      }>(endpoint + "/quiz", "POST", { answer });
      setResult(r);
      setPassed(r.passed);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    setBusy(true);
    setError("");
    try {
      const value = JSON.stringify({ scene, note, checklist, completed: true });
      await persist(value);
      setCompleted(true);
      setStatus("Đã hoàn thành bài học");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const next =
      course.lessons[course.lessons.findIndex((x) => x.id === l.id) + 1],
    current = scenes[scene];
  return (
    <div className={`cr-room ${outline ? "" : "outline-closed"}`}>
      <header className="cr-room-header">
        <button
          className="cr-icon-button"
          aria-label="Về lộ trình lớp học"
          onClick={() => void navigate(`${baseFor(track)}/lop-hoc`)}
        >
          <ArrowLeft size={19} />
        </button>
        <div>
          <small>
            {course.title} / {l.id.toUpperCase()}
          </small>
          <strong>{l.title}</strong>
        </div>
        <span className="cr-session-badge">
          {completed ? (
            <>
              <Check size={14} />
              Đã hoàn thành
            </>
          ) : (
            "Đang học"
          )}
        </span>
        <button
          className="cr-icon-button"
          aria-label="Ẩn hiện mục lục"
          aria-expanded={outline}
          onClick={() => setOutline(!outline)}
        >
          <List size={20} />
        </button>
      </header>
      <aside className="cr-outline">
        <div className="cr-outline-title">
          LỘ TRÌNH LỚP HỌC <span>{course.lessons.length} bài</span>
        </div>
        {course.modules.map((m) => (
          <section key={m.id}>
            <h3>
              {String(m.id).padStart(2, "0")} / {m.title}
            </h3>
            {course.lessons
              .filter((x) => x.module === m.id)
              .map((x) => (
                <button
                  key={x.id}
                  className={x.id === l.id ? "active" : ""}
                  aria-current={x.id === l.id ? "page" : undefined}
                  onClick={() =>
                    void navigate(`${baseFor(track)}/lop-hoc/${x.id}`)
                  }
                >
                  <span>
                    {(x.id === l.id ? completed : x.progress?.completed) ? (
                      <Check size={12} />
                    ) : (
                      x.id.toUpperCase()
                    )}
                  </span>
                  {x.title}
                </button>
              ))}
          </section>
        ))}
      </aside>
      <section className="cr-center">
        <div className="cr-scene-bar">
          <span>
            BƯỚC {scene + 1} / {scenes.length}
          </span>
          <div>
            {scenes.map((s, i) => (
              <button
                key={i}
                className={scene === i ? "active" : ""}
                aria-label={`Bước ${i + 1}: ${s.title}`}
                aria-current={scene === i ? "step" : undefined}
                onClick={() => setScene(i)}
              />
            ))}
          </div>
          <Narration
            key={scene}
            text={current.title + ". " + (current.body || l.summary)}
          />
        </div>
        <div className="cr-stage-scroll">
          <ClassroomStage
            lesson={l}
            scene={current}
            checklist={checklist}
            onCheck={(i) => {
              setChecklist((x) =>
                x.includes(i) ? x.filter((n) => n !== i) : [...x, i],
              );
              setCompleted(false);
            }}
            answer={answer}
            setAnswer={(n) => {
              setAnswer(n);
              setResult(null);
            }}
            result={result}
            onQuiz={() => void submitQuiz()}
            busy={busy}
            signedIn={!!user}
          />
          {error && (
            <div role="alert" className="cr-error">
              {error}
              <button onClick={() => void persist().catch(() => {})}>
                Thử lưu lại
              </button>
            </div>
          )}
          {scene === scenes.length - 1 && (
            <div className="cr-finish">
              <p>
                {completed
                  ? "Bạn đã hoàn thành bài. Tiếp tục học hoặc chuyển sang phòng thực hành để nộp sản phẩm."
                  : `${passed ? "✓ Đã qua tự kiểm" : "Chưa qua tự kiểm"} · ${checklist.length}/${l.steps.length} bước thực hành đã xác nhận`}
              </p>
              {completed ? (
                <div className="button-row">
                  {next && (
                    <button
                      className="btn primary"
                      onClick={() =>
                        void navigate(`${baseFor(track)}/lop-hoc/${next.id}`)
                      }
                    >
                      Bài tiếp theo <ArrowRight size={16} />
                    </button>
                  )}
                  <Link
                    className="btn secondary"
                    href={`${baseFor(track)}/thuc-hanh${l.assignment ? "/" + l.assignment.id : ""}`}
                  >
                    {l.assignment
                      ? `Làm và nộp bài ${l.assignment.id.toUpperCase()}`
                      : "Phòng thực hành"}
                  </Link>
                </div>
              ) : (
                <button
                  className="btn primary"
                  disabled={
                    !user ||
                    !passed ||
                    checklist.length !== l.steps.length ||
                    busy
                  }
                  onClick={() => void finish()}
                >
                  <Check size={17} />
                  Hoàn thành bài học
                </button>
              )}
            </div>
          )}
        </div>
        <div className="cr-player-bar">
          <button disabled={scene === 0} onClick={() => setScene((s) => s - 1)}>
            <ChevronLeft size={18} />
            Trước
          </button>
          <span role="status">
            {user
              ? saving
                ? "Đang lưu…"
                : status || "Tiến độ theo tài khoản"
              : "Học thử · đăng nhập để lưu"}
          </span>
          <button
            disabled={scene === scenes.length - 1}
            onClick={() => setScene((s) => s + 1)}
          >
            Tiếp <ChevronRight size={18} />
          </button>
        </div>
      </section>
      <ClassroomPanel
        track={track}
        detail={initial}
        note={note}
        setNote={setNote}
        save={() => void persist().catch(() => {})}
        saving={saving}
        signedIn={!!user}
      />
    </div>
  );
}
