"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { baseFor, type Message, type Track } from "./types";
import { ClassroomVideo, VideoMetadata } from "./video-player";

type Video = NonNullable<NonNullable<Message["evidence"]>["videos"]>[number];
function AnswerVideo({ video }: { video: Video }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="cr-answer-video">
      <strong>{video.title}</strong>
      <VideoMetadata {...video} />
      <p className="cr-small">{video.focus}</p>
      <ClassroomVideo
        {...video}
        playing={playing}
        onPlay={() => setPlaying(true)}
        label="Xem video ví dụ"
      />
      {video.chapter && <p className="cr-small">Chương: {video.chapter}</p>}
      <a
        className="cr-source-external"
        href={`https://www.youtube.com/watch?v=${video.id}&t=${Math.floor(video.start)}s`}
        target="_blank"
        rel="noreferrer"
      >
        Mở trên YouTube <ExternalLink size={13} />
      </a>
    </div>
  );
}

export function ClassroomAnswer({
  message,
  track,
}: {
  message: Message;
  track: Track;
}) {
  const evidence = message.evidence;
  const references = (evidence?.references || []).filter(
    (reference, index, all) =>
      all.findIndex((r) => r.lessonId === reference.lessonId) === index,
  );
  return (
    <article className="cr-answer-card">
      <p className="cr-chat-question">
        <strong>Bạn hỏi</strong>
        <br />
        {message.question}
      </p>
      <div className="cr-chat-answer">
        <span>
          {message.mode === "ai"
            ? "PHẢN HỒI AI ĐÃ LƯU"
            : "TRẢ LỜI TỪ GIÁO TRÌNH"}
        </span>
        <p>{message.answer}</p>
      </div>
      {!!evidence?.references?.length && (
        <div className="cr-answer-references">
          <h4>Đọc trong giáo trình</h4>
          <ul>
            {references.map((reference, i) => (
              <li key={`${reference.lessonId}-${i}`}>
                <Link href={`${baseFor(track)}/lop-hoc/${reference.lessonId}`}>
                  {reference.lessonId.toUpperCase()} · {reference.lessonTitle}
                </Link>
                <small>
                  {evidence.references
                    ?.filter((r) => r.lessonId === reference.lessonId)
                    .map((r) => r.section)
                    .join(" · ")}
                </small>
              </li>
            ))}
          </ul>
        </div>
      )}
      {evidence?.matched && (
        <div className="cr-answer-media">
          <h4>Video liên quan đến bài</h4>
          {evidence.videos?.length ? (
            evidence.videos.map((video) => (
              <AnswerVideo key={video.id} video={video} />
            ))
          ) : (
            <p className="cr-small">
              Chưa có video đã đối chiếu cho nội dung này. Bạn có thể xem tài
              liệu gốc dưới đây hoặc làm theo các bước trong bài.
            </p>
          )}
          {!!evidence.documents?.length && (
            <details>
              <summary>Tài liệu gốc của bài</summary>
              <ul className="cr-documents">
                {evidence.documents.map((url, i) => (
                  <li key={url}>
                    <a href={url} target="_blank" rel="noreferrer">
                      Tài liệu {i + 1} · {new URL(url).hostname}{" "}
                      <ExternalLink size={12} />
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </article>
  );
}
