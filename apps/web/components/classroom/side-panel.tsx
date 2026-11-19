"use client";
import { useEffect, useState } from "react";
import {
  BookOpen,
  ExternalLink,
  MessageCircle,
  NotebookPen,
  Send,
  Volume2,
  Square,
} from "lucide-react";
import { api } from "../../lib/api";
import { baseFor, clock, type Track, type Detail, type Message } from "./types";
import Link from "next/link";
import { ClassroomAnswer } from "./answer-card";
import { ClassroomVideo, VideoMetadata } from "./video-player";

export function ClassroomPanel({
  track,
  detail,
  note,
  setNote,
  save,
  saving,
  signedIn,
}: {
  track: Track;
  detail: Detail;
  note: string;
  setNote: (s: string) => void;
  save: () => void;
  saving: boolean;
  signedIn: boolean;
}) {
  const [tab, setTab] = useState(
      track === "solidworks" && detail.sources.length ? "sources" : "guide",
    ),
    [messages, setMessages] = useState(detail.messages),
    [question, setQuestion] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [video, setVideo] = useState(detail.sources[0]),
    [start, setStart] = useState(detail.sources[0]?.start || 0),
    [playing, setPlaying] = useState(false);
  async function ask(text: string = question) {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const message = await api<Message>(
        `/api/classroom/${track}/lessons/${detail.lesson.id}/chat`,
        "POST",
        { question: text },
      );
      setMessages((m) => [...m, message]);
      setQuestion("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <aside className="cr-panel">
      <div
        className="cr-panel-tabs"
        role="tablist"
        aria-label="Công cụ lớp học"
      >
        {[
          ["guide", "Hỏi giáo trình", MessageCircle],
          ["sources", "Video", BookOpen],
          ["notes", "Ghi chú", NotebookPen],
        ].map(([key, label, Icon]) => {
          const I = Icon as typeof BookOpen;
          return (
            <button
              key={key as string}
              role="tab"
              aria-selected={tab === key}
              className={tab === key ? "active" : ""}
              onClick={() => {
                setTab(key as string);
                setPlaying(false);
              }}
            >
              <I size={16} />
              {label as string}
            </button>
          );
        })}
      </div>
      <div className="cr-panel-body">
        {tab === "guide" && (
          <>
            <div className="cr-coach">
              <div className="cr-coach-avatar">EP</div>
              <div>
                <strong>Bạn hỏi, giáo trình trả lời</strong>
                <small>Học theo câu hỏi của bạn</small>
              </div>
            </div>
            <p className="cr-small">
              Đặt câu hỏi về môn học. Xem câu trả lời từ giáo trình và video
              liên quan ngay bên dưới.
            </p>
            <div className="cr-prompts">
              {[
                "Giải thích ý chính của bài",
                "Ví dụ thực hành của bài",
                "Những lỗi cần tránh trong bài",
              ].map((p) => (
                <button
                  key={p}
                  disabled={!signedIn || busy}
                  onClick={() => void ask(p)}
                >
                  {p}
                </button>
              ))}
            </div>
            {error && (
              <p className="cr-error" role="alert">
                {error}
              </p>
            )}
            {signedIn ? (
              <form
                className="cr-chat-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ask();
                }}
              >
                <textarea
                  aria-label="Câu hỏi về bài học"
                  placeholder={
                    track === "embedded"
                      ? "Ví dụ: Con trỏ là gì?"
                      : track === "solidworks"
                        ? "Ví dụ: Khi nào sketch được ràng buộc đầy đủ?"
                        : "Ví dụ: Vì sao cần điện trở hạn dòng cho LED?"
                  }
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  maxLength={2000}
                  rows={3}
                />
                <button
                  className="btn primary"
                  disabled={busy || question.trim().length < 3}
                >
                  <Send size={15} />
                  {busy ? "Đang tìm trong giáo trình…" : "Gửi câu hỏi"}
                </button>
              </form>
            ) : (
              <Link className="btn secondary" href="/dang-nhap">
                Đăng nhập để đặt câu hỏi
              </Link>
            )}
            <div className="cr-chat" aria-live="polite" aria-busy={busy}>
              {busy && (
                <p role="status">Đang tìm nội dung và video liên quan…</p>
              )}
              {messages.slice(-1).map((message) => (
                <ClassroomAnswer
                  key={message.id}
                  message={message}
                  track={track}
                />
              ))}
              {messages.length > 1 && (
                <details className="cr-qa-history">
                  <summary>Câu hỏi trước ({messages.length - 1})</summary>
                  {messages
                    .slice(0, -1)
                    .reverse()
                    .map((message) => (
                      <ClassroomAnswer
                        key={message.id}
                        message={message}
                        track={track}
                      />
                    ))}
                </details>
              )}
            </div>
            <Link className="cr-human-link" href={`${baseFor(track)}/trao-doi`}>
              Trao đổi với người chủ trì <ExternalLink size={13} />
            </Link>
          </>
        )}
        {tab === "sources" && (
          <>
            <h3>Video hướng dẫn & tài liệu</h3>
            <p className="cr-small">
              Bài giảng tiếng Việt do EP LAB biên soạn. Video thuộc tác giả gốc;
              các mốc chương theo nguồn công khai.
            </p>
            {detail.sources.length ? (
              <>
                <label className="cr-field">
                  Video tham khảo
                  <select
                    value={video?.id || ""}
                    onChange={(e) => {
                      const next = detail.sources.find(
                        (s) => s.id === e.target.value,
                      )!;
                      setVideo(next);
                      setStart(next.start || 0);
                      setPlaying(false);
                    }}
                  >
                    {detail.sources.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.title}
                      </option>
                    ))}
                  </select>
                </label>
                {video && (
                  <>
                    <VideoMetadata {...video} />
                    <ClassroomVideo
                      id={video.id}
                      title={video.title || "Video tham khảo"}
                      start={start}
                      playing={playing}
                      onPlay={() => setPlaying(true)}
                      label="Mở video gốc"
                    />
                    <p className="cr-small">{video.focus}</p>
                    <a
                      className="cr-source-external"
                      href={`https://www.youtube.com/watch?v=${video.id}&t=${Math.floor(start)}s`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Xem trên YouTube nếu video nhúng không phát{" "}
                      <ExternalLink size={14} />
                    </a>
                    {detail.lesson.visualGuide && (
                      <section
                        className="cr-watch-guide"
                        aria-label="Học theo video"
                      >
                        <h4>Quan sát khi xem</h4>
                        <ol>
                          {detail.lesson.visualGuide.watchFor.map((step) => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                        <p>
                          <strong>Dừng video và thử:</strong>{" "}
                          {detail.lesson.visualGuide.tryIt}
                        </p>
                        <small>
                          Có thể giảm tốc độ hoặc mở toàn màn hình trong trình
                          phát. Tên/vị trí nút lệnh có thể khác theo phiên bản.
                        </small>
                      </section>
                    )}
                    {video.chapters && video.chapters.length > 0 && (
                      <details>
                        <summary>Các chương trong video</summary>
                        <div className="cr-chapters">
                          {video.chapters
                            .filter(
                              (c) => !/\b(ad|outro|courses)\b/i.test(c.title),
                            )
                            .map((c) => (
                              <button
                                key={c.start_time}
                                onClick={() => {
                                  setStart(c.start_time);
                                  setPlaying(true);
                                }}
                              >
                                <span>{clock(c.start_time)}</span>
                                {c.title}
                              </button>
                            ))}
                        </div>
                      </details>
                    )}
                  </>
                )}
              </>
            ) : (
              <p>
                Bài này chưa có video đã đối chiếu. Hãy làm theo các bước thực
                hành và xem tài liệu gốc bên dưới.
              </p>
            )}
            <ul className="cr-documents">
              {detail.lesson.sources.map((s, i) => (
                <li key={s}>
                  <a href={s} target="_blank" rel="noreferrer">
                    Tài liệu {i + 1} · {new URL(s).hostname}{" "}
                    <ExternalLink size={12} />
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
        {tab === "notes" && (
          <>
            <h3>Sổ tay của bạn</h3>
            <p className="cr-small">
              Ghi dự đoán, kết quả và câu hỏi.{" "}
              {signedIn
                ? "Ghi chú được lưu riêng theo tài khoản."
                : "Đăng nhập để lưu; nội dung hiện tại chỉ nằm trong phiên này."}
            </p>
            <textarea
              className="cr-notebook"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={10000}
              rows={16}
              aria-label="Ghi chú bài học"
              placeholder="Tôi đã hiểu…\nTôi đã thử…\nKết quả khác dự đoán ở…"
            />
            <button
              className="btn primary"
              disabled={!signedIn || saving}
              onClick={save}
            >
              {saving ? "Đang lưu…" : "Lưu ghi chú"}
            </button>
            <p className="cr-small">{note.length}/10.000 ký tự</p>
            <h3>Tiêu chí tự đối chiếu</h3>
            <ul>
              {detail.lesson.rubric.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

export function Narration({ text }: { text: string }) {
  const [speaking, setSpeaking] = useState(false),
    [message, setMessage] = useState("");
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );
  return (
    <>
      <button
        className="cr-icon-button"
        aria-label={speaking ? "Dừng đọc" : "Đọc nội dung bài"}
        onClick={() => {
          if (!("speechSynthesis" in window)) {
            setMessage("Trình duyệt chưa hỗ trợ đọc nội dung.");
            return;
          }
          if (speaking) {
            window.speechSynthesis.cancel();
            setSpeaking(false);
            return;
          }
          const voices = window.speechSynthesis.getVoices();
          const voice = voices.find((v) => v.lang.startsWith("vi"));
          if (!voice) {
            setMessage(
              "Máy chưa có giọng tiếng Việt. Bạn vẫn đọc được toàn bộ bài giảng.",
            );
            return;
          }
          const u = new SpeechSynthesisUtterance(text);
          u.lang = "vi-VN";
          u.voice = voice;
          u.onend = () => setSpeaking(false);
          u.onerror = () => {
            setSpeaking(false);
            setMessage("Không phát được giọng đọc.");
          };
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(u);
          setSpeaking(true);
          setMessage("");
        }}
      >
        {speaking ? <Square size={17} /> : <Volume2 size={17} />}
      </button>
      {message && (
        <span className="cr-small" role="status">
          {message}
        </span>
      )}
    </>
  );
}
