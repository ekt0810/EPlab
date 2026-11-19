"use client";
import Link from "next/link";
import { useState } from "react";
import {
  ExternalLink,
  Play,
  FileDown,
  CheckCircle2,
  ArrowRight,
  LockKeyhole,
  BookOpen,
  Save,
} from "lucide-react";
import { useApi, api } from "../lib/api";
import { useAuth } from "./context";
import { Loading, Notice, Empty, ErrorBox } from "./ui";
import { CourseArt } from "./catalog";
import { KicadReading, KicadQuiz } from "./practice-learning";
import { DocumentLesson } from "./document-lesson";
import { practiceTracks } from "./practice-track";
import { lessonHref, type Subject } from "../lib/subjects";
import { LessonIntro, LessonOutline, LessonPager } from "./lesson-intro";
export function Lesson({ slug, subject }: { slug: string; subject: Subject }) {
  const intro = useApi(`/api/lessons/${slug}/intro`);
  const course = useApi(
    intro.data ? `/api/courses/${intro.data.course_slug}` : null,
  );
  const { user } = useAuth();
  if (intro.loading) return <Loading />;
  if (intro.error)
    return <ErrorBox message={intro.error} retry={intro.reload} />;
  const l = intro.data;
  if (l.category !== subject.id)
    return (
      <Empty
        title="Bài học thuộc môn khác"
        description={l.course_title}
        href={lessonHref(l.category, l.slug)}
        label="Mở đúng môn học"
      />
    );
  return (
    <>
      <Link className="back-link" href={subject.base + "/lop-hoc"}>
        ← Danh sách bài học {subject.short}
      </Link>
      <LessonIntro lesson={l} personal={!!user} />
      {l.accessible ? (
        <ReadableLesson slug={slug} />
      ) : (
        <div className="lesson-layout">
          <div>
            <section className="panel lesson-locked-body">
              <LockKeyhole size={30} />
              <h2>
                {l.status !== "published"
                  ? "Nội dung đang được chuẩn bị"
                  : "Mở nội dung đầy đủ"}
              </h2>
              <p>
                {l.status !== "published"
                  ? "Bài này chưa được bàn giao và không được tính là nội dung đã có khi kích hoạt."
                  : "Học các bài miễn phí trước. Gửi yêu cầu tham gia Lab để được admin cấp quyền học đầy đủ ba môn và hỗ trợ, không thu phí."}
              </p>
              <div className="button-row">
                {l.status === "published" && (
                  <Link className="btn primary" href="/tham-gia-lab">
                    Tham gia Lab
                  </Link>
                )}
                {!user && (
                  <Link className="btn secondary" href="/dang-ky">
                    Đăng ký miễn phí
                  </Link>
                )}
                {!user && (
                  <Link className="btn secondary" href="/dang-nhap">
                    Đã có tài khoản? Đăng nhập
                  </Link>
                )}
                <Link
                  className="btn secondary"
                  href={subject.base + "/lop-hoc?access=free"}
                >
                  Học bài miễn phí
                </Link>
              </div>
            </section>
            <LessonPager course={course.data} current={slug} />
          </div>
          <LessonOutline course={course.data} current={slug} />
        </div>
      )}
    </>
  );
}
function ReadableLesson({ slug }: { slug: string }) {
  const lesson = useApi(`/api/lessons/${slug}`);
  const course = useApi(
    lesson.data ? `/api/courses/${lesson.data.course_slug}` : null,
  );
  const { user } = useAuth();
  const [tab, setTab] = useState("content"),
    [note, setNote] = useState<string | null>(null),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [answer, setAnswer] = useState("");
  if (lesson.loading) return <Loading />;
  if (lesson.error)
    return (
      <div className="locked">
        <LockKeyhole size={38} />
        <h1>
          {lesson.error.includes("biên soạn")
            ? "Bài học đang được biên soạn"
            : "Nội dung dành cho người tham gia"}
        </h1>
        <p>{lesson.error}</p>
        <div className="button-row">
          <Link href="/hoc-thu" className="btn secondary">
            Khám phá bài học thử
          </Link>
          {!lesson.error.includes("biên soạn") && (
            <Link
              href={user ? "/tham-gia-lab" : "/dang-nhap"}
              className="btn primary"
            >
              {user ? "Xem quyền tham gia Lab" : "Đăng nhập"}
              <ArrowRight size={17} />
            </Link>
          )}
        </div>
      </div>
    );
  const l = lesson.data;
  let videoId = "";
  try {
    const u = new URL(l.video_url);
    videoId =
      u.hostname === "youtu.be"
        ? u.pathname.slice(1)
        : u.searchParams.get("v") || "";
  } catch {}
  async function save(completed: boolean) {
    setBusy(true);
    setError("");
    try {
      await api(`/api/progress/${slug}`, "PUT", {
        completed,
        note: note ?? l.progress?.note ?? "",
      });
      setMessage("Đã lưu tiến độ và ghi chú.");
      await lesson.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {practiceTracks
        .filter((t) => t.id === l.category && t.id !== "kicad")
        .map((t) => (
          <div className="button-row" key={t.id}>
            <Link className="btn secondary" href={`${t.base}/thuc-hanh`}>
              Làm bài tập {t.label}
            </Link>
            <Link className="btn secondary" href={`${t.base}/bai-nop`}>
              Bài nộp của tôi
            </Link>
          </div>
        ))}
      {user?.role === "admin" && (
        <Notice type="success">
          Quyền chủ trì: xem toàn bộ bài học miễn phí.
          {(l.status === "draft" || l.course_status === "draft") &&
            " Bạn đang xem bản nháp, chưa mở cho người tham gia."}
        </Notice>
      )}
      <div className="lesson-layout">
        <div>
          {l.category === "solidworks" || l.document_resource_id ? (
            <DocumentLesson lesson={l} />
          ) : l.study ? (
            <div className="panel practice-study-intro">
              <BookOpen size={28} />
              <div>
                <h2>Giáo trình KiCad EP LAB</h2>
                <p>Đọc bài, tự kiểm tra và thực hành cùng người chủ trì.</p>
                <Link href="/kicad/giao-trinh">Xem 8 chương giáo trình →</Link>
              </div>
            </div>
          ) : (
            <div className="video-box">
              {l.video_type === "youtube" && l.embed_verified && videoId ? (
                <iframe
                  title={l.title}
                  src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <>
                  <CourseArt type={l.category} />
                  <div className="reference-video">
                    <span className="circle-play">
                      <Play size={28} fill="currentColor" />
                    </span>
                    <h3>
                      {l.video_url
                        ? "Video từ tác giả gốc"
                        : "Phòng thực hành EP LAB"}
                    </h3>
                    <p>
                      {l.video_url
                        ? "Mở video tại nguồn, rồi trở lại để thực hành và ghi chú."
                        : "Đọc hướng dẫn, tự thực hành và đối chiếu kết quả."}
                    </p>
                    {l.video_url && (
                      <a
                        className="btn white"
                        href={l.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Xem video gốc <ExternalLink size={16} />
                      </a>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
          <div className="lesson-source">
            <span>
              <b>{l.author}</b> · {l.language}
            </span>
            {l.source_url && (
              <a href={l.source_url} target="_blank" rel="noopener noreferrer">
                Nguồn <ExternalLink size={13} />
              </a>
            )}
          </div>
          {l.software_version &&
            !l.document_resource_id &&
            l.audience !== "host" &&
            !/giáo trình/i.test(l.software_version) && (
              <p className="version-note">{l.software_version}</p>
            )}
          <div className="lesson-tabs">
            {[
              ["content", "Nội dung bài học"],
              ["exercise", "Bài tập"],
              ["resources", `Tài liệu (${l.resources.length})`],
              ["notes", "Ghi chú của tôi"],
              ...(l.study
                ? [
                    ["quiz", "Tự kiểm tra"],
                    ["videos", "Video tham khảo"],
                  ]
                : []),
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
          <div className="panel lesson-content">
            {tab === "quiz" && l.study ? (
              <KicadQuiz
                key={slug}
                study={l.study}
                slug={slug}
                onPassed={() =>
                  lesson.setData((old: any) => ({
                    ...old,
                    progress: { ...old.progress, completed: true },
                  }))
                }
              />
            ) : tab === "videos" && l.study ? (
              <>
                <h2>Video gốc Phil’s Lab</h2>
                <p>
                  Video tham khảo được xem miễn phí tại nguồn. Giáo trình tiếng
                  Việt là nội dung riêng của EP LAB.
                </p>
                <div className="stack">
                  {l.study.videoIds.map((id: string) => (
                    <Link
                      className="btn secondary"
                      key={id}
                      href={`/kicad/video?video=${id}`}
                    >
                      Xem video và mốc chương <ExternalLink size={16} />
                    </Link>
                  ))}
                </div>
              </>
            ) : tab === "content" && l.study ? (
              <KicadReading study={l.study} />
            ) : tab === "content" ? (
              <>
                <h2>Nội dung bài học</h2>
                <div className="prose">
                  {l.content.split("\n\n").map((p: string, i: number) => (
                    <p
                      key={i}
                      className={
                        p.includes("uint32_t") || p.includes("#include")
                          ? "code-paragraph"
                          : ""
                      }
                    >
                      {p}
                    </p>
                  ))}
                </div>
              </>
            ) : tab === "exercise" ? (
              <>
                <h2>Đến lượt bạn thực hành</h2>
                {l.study?.exerciseId && (
                  <Link
                    className="btn primary"
                    href={`/kicad/thuc-hanh/${l.study.exerciseId}`}
                  >
                    Mở đề bài và nộp bài <ArrowRight size={16} />
                  </Link>
                )}
                <p className="preserve">
                  {l.exercise || "Bài tập sẽ được cập nhật."}
                </p>
                {user && (
                  <button
                    className="btn secondary"
                    onClick={async () => {
                      try {
                        setAnswer(
                          (await api(`/api/lessons/${slug}/answer`)).answer ||
                            "Bài này chưa có đáp án tham khảo.",
                        );
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    Xem gợi ý sau khi tự làm
                  </button>
                )}
                {answer && <div className="answer preserve">{answer}</div>}
              </>
            ) : tab === "resources" ? (
              l.resources.length ? (
                <div>
                  {l.resources.map((r: any) => (
                    <a
                      className="resource-row"
                      href={`/api/files/${r.id}`}
                      key={r.id}
                    >
                      <FileDown size={20} />
                      <span>
                        {r.name}
                        <small>{(Number(r.size) / 1024).toFixed(1)} KB</small>
                      </span>
                      <ArrowRight size={16} />
                    </a>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Bài này chưa có tệp đính kèm"
                  description="Bạn vẫn có thể thực hành theo hướng dẫn và bài tập ở trên."
                />
              )
            ) : user ? (
              <>
                <h2>Điều bạn muốn ghi nhớ</h2>
                <textarea
                  className="notes-input"
                  aria-label="Ghi chú riêng"
                  value={note ?? l.progress?.note ?? ""}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ghi lại câu hỏi, lỗi gặp phải hoặc điều vừa hiểu…"
                  maxLength={10000}
                />
                <button
                  className="btn secondary"
                  disabled={busy}
                  onClick={() => save(!!l.progress?.completed)}
                >
                  <Save size={16} />
                  Lưu ghi chú riêng
                </button>
              </>
            ) : (
              <Empty
                title="Giữ lại những điều đã học"
                description="Đăng nhập để lưu ghi chú riêng và tiến độ học của bạn."
                href="/dang-nhap"
                label="Đăng nhập"
              />
            )}
          </div>
          {error && <Notice type="error">{error}</Notice>}
          {message && <Notice type="success">{message}</Notice>}
          <LessonPager course={course.data} current={slug} />
          <div className="completion">
            {user ? (
              <>
                <span>
                  {l.progress?.completed
                    ? "Bạn đã hoàn thành bài này."
                    : "Đã xem và thực hành xong?"}
                </span>
                <button
                  className={`btn ${l.progress?.completed ? "secondary" : "primary"}`}
                  disabled={busy}
                  onClick={() => save(!l.progress?.completed)}
                >
                  <CheckCircle2 size={17} />
                  {l.progress?.completed
                    ? "Đánh dấu chưa hoàn thành"
                    : "Hoàn thành bài học"}
                </button>
              </>
            ) : (
              <Link href="/dang-nhap">
                Đăng nhập để lưu hành trình học <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </div>
        <LessonOutline course={course.data} current={slug} />
      </div>
    </>
  );
}
