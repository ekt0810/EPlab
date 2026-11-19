"use client";
import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  CheckCircle2,
  LockKeyhole,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { api, useApi } from "../lib/api";
import { Loading, ErrorBox, PageTitle, Notice } from "./ui";
import { PracticeNav } from "./practice-nav";
export function KicadCurriculum() {
  const { data, error, loading, reload } = useApi("/api/kicad/catalog"),
    [module, setModule] = useState(0);
  return (
    <>
      <PageTitle
        eyebrow="KICAD · GIÁO TRÌNH EP LAB"
        title="Học từng bước, kiểm tra từng phần."
        description="24 bài học tiếng Việt trong 8 chương. Đọc kiến thức, thực hành trong KiCad, tự kiểm tra và gửi bài để người chủ trì nhận xét."
      />
      <PracticeNav />
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : (
        <>
          <div className="practice-summary">
            <span>
              <BookOpen size={18} /> {data.lessons.length} bài học
            </span>
            <span>
              <CheckCircle2 size={18} />{" "}
              {data.lessons.filter((l: any) => l.quiz_passed).length}/24 bài tự
              kiểm tra đúng
            </span>
            <Link href="/kicad/thuc-hanh">
              12 bài thực hành <ArrowRight size={16} />
            </Link>
          </div>
          <div className="filters">
            <label>
              Chọn chương{" "}
              <select
                value={module}
                onChange={(e) => setModule(Number(e.target.value))}
              >
                <option value={0}>Tất cả chương</option>
                {data.modules.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.id}. {m.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="practice-modules">
            {data.modules
              .filter((m: any) => !module || m.id === module)
              .map((m: any) => (
                <section className="panel practice-module" key={m.id}>
                  <span className="eyebrow">
                    CHƯƠNG {m.id} · {m.level}
                  </span>
                  <h2>{m.title}</h2>
                  <p>{m.subtitle}</p>
                  {data.lessons
                    .filter((l: any) => l.module === m.id)
                    .map((l: any) => (
                      <Link
                        className="practice-lesson-row"
                        href={`/bai-hoc/${l.slug}`}
                        key={l.id}
                      >
                        {l.quiz_passed ? (
                          <CheckCircle2 size={19} />
                        ) : l.accessible ? (
                          <BookOpen size={19} />
                        ) : (
                          <LockKeyhole size={19} />
                        )}
                        <div>
                          <h3>{l.title}</h3>
                          <p>{l.summary}</p>
                        </div>
                        <ArrowRight size={17} />
                      </Link>
                    ))}
                </section>
              ))}
          </div>
        </>
      )}
    </>
  );
}
export function KicadReading({ study }: { study: any }) {
  return (
    <div className="prose practice-reading">
      {study.concepts.map(([title, body]: string[]) => (
        <section key={title}>
          <h2>{title}</h2>
          <p>{body}</p>
        </section>
      ))}
      <h2>Thực hành ngay trong KiCad</h2>
      <ol>
        {study.steps.map((s: string) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <div className="practice-note">
        <h3>Lỗi thường gặp</h3>
        <ul>
          {study.mistakes.map((s: string) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <h3>Tài liệu để đối chiếu</h3>
      <div className="button-row">
        {study.sources.map((href: string, i: number) => (
          <a key={href} href={href} target="_blank" rel="noopener noreferrer">
            {["KiCad · Bắt đầu", "Schematic Editor", "PCB Editor"][i]}{" "}
            <ExternalLink size={13} />
          </a>
        ))}
      </div>
    </div>
  );
}
export function KicadQuiz({
  study,
  slug,
  onPassed,
}: {
  study: any;
  slug: string;
  onPassed: () => void;
}) {
  const [answer, setAnswer] = useState<number | null>(null),
    [result, setResult] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const r = await api(`/api/kicad/lessons/${slug}/quiz`, "POST", {
            answer,
          });
          setResult(r);
          if (r.correct) onPassed();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <span className="eyebrow">TỰ KIỂM TRA KIẾN THỨC</span>
      <h2>{study.quiz.question}</h2>
      <fieldset className="practice-options">
        <legend>Chọn một đáp án</legend>
        {study.quiz.options.map((o: string, i: number) => (
          <label key={o}>
            <input
              type="radio"
              name="answer"
              checked={answer === i}
              onChange={() => {
                setAnswer(i);
                setResult(null);
              }}
            />
            {o}
          </label>
        ))}
      </fieldset>
      {result && (
        <Notice type={result.correct ? "success" : "info"}>
          <b>
            {result.correct
              ? "Đúng rồi. Tiến độ đã được lưu."
              : "Chưa đúng, hãy đọc lại và thử lại."}
          </b>
          <p>{result.explanation}</p>
        </Notice>
      )}
      {error && <Notice type="error">{error}</Notice>}
      <button disabled={answer === null || busy} className="btn primary">
        {busy ? "Đang kiểm tra…" : "Kiểm tra đáp án"}
      </button>
      {study.exerciseId && (
        <Link
          href={`/kicad/thuc-hanh/${study.exerciseId}`}
          className="btn secondary"
        >
          Làm bài thực hành <ArrowRight size={16} />
        </Link>
      )}
    </form>
  );
}
export function KicadVideoLibrary() {
  const { data, error, loading, reload } = useApi("/api/kicad/library"),
    [query, setQuery] = useState(""),
    [category, setCategory] = useState("all"),
    [chosen, setChosen] = useState<string | null>(null);
  const params = useSearchParams();
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const current = data.videos.find(
      (v: any) => v.id === (chosen || params.get("video")),
    ),
    list = data.videos.filter(
      (v: any) =>
        (category === "all" || v.category === category) &&
        v.title.toLowerCase().includes(query.toLowerCase()),
    );
  return (
    <>
      <PageTitle
        eyebrow="KICAD · VIDEO THAM KHẢO"
        title="Thư viện Phil’s Lab"
        description="Video ở kênh gốc; giáo trình và bài tập EP LAB được tổ chức riêng. Chọn mốc chương để xem đúng phần cần học."
      />
      <PracticeNav />
      <div className="filters">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm tên video hoặc phiên bản…"
          aria-label="Tìm video"
        />
        <select
          aria-label="Chủ đề video"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Tất cả chủ đề</option>
          <option>KiCad</option>
          <option>Thiết kế phần cứng</option>
        </select>
      </div>
      {current && (
        <section className="panel practice-video-detail">
          <h2>{current.title}</h2>
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn primary"
          >
            Xem tại Phil’s Lab <ExternalLink size={16} />
          </a>
          {current.chapters?.length > 0 && (
            <details open>
              <summary>
                Mở đúng phần cần học · {current.chapters.length} mốc
              </summary>
              <div className="practice-video-chapters">
                {current.chapters.map((c: any) => (
                  <a
                    key={c.start_time}
                    href={`${current.url}&t=${Math.floor(c.start_time)}s`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <code>
                      {Math.floor(c.start_time / 60)}:
                      {String(Math.floor(c.start_time % 60)).padStart(2, "0")}
                    </code>
                    {c.title}
                  </a>
                ))}
              </div>
            </details>
          )}
        </section>
      )}
      <div className="practice-grid">
        {list.map((v: any) => (
          <button
            key={v.id}
            className="panel practice-video-card"
            onClick={() => {
              setChosen(v.id);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          >
            <img
              src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`}
              alt=""
              loading="lazy"
            />
            <span className="eyebrow">
              {v.category}
              {v.kind === "announcement" ? " · Giới thiệu khóa học" : ""}
            </span>
            <h3>{v.title}</h3>
            <span>
              {Math.floor(v.duration / 60)} phút
              {v.chapters?.length ? ` · ${v.chapters.length} mốc chương` : ""}
            </span>
          </button>
        ))}
      </div>
      {!list.length && <p>Không có video khớp từ khóa.</p>}
      <p className="muted">
        Danh sách nhập từ web KiCad EP Lab, đối chiếu nguồn ngày{" "}
        {data.checkedAt}. Khả năng xem phụ thuộc kênh gốc.{" "}
        <a href={data.channelUrl} target="_blank" rel="noopener noreferrer">
          Mở kênh Phil’s Lab
        </a>
        .
      </p>
    </>
  );
}
