"use client";
import { Play } from "lucide-react";
import { clock } from "./types";

export function VideoMetadata({
  language,
  channel,
  softwareVersion,
  duration,
}: {
  language?: "vi" | "en";
  channel?: string;
  softwareVersion?: string;
  duration?: number | null;
}) {
  const parts = [
    language === "vi" ? "Tiếng Việt" : language === "en" ? "Tiếng Anh" : null,
    channel,
    softwareVersion,
    duration ? clock(duration) : null,
  ].filter(Boolean);
  return parts.length ? (
    <p className="cr-video-metadata">{parts.join(" · ")}</p>
  ) : null;
}

export function ClassroomVideo({
  id,
  title,
  start,
  playing,
  onPlay,
  label,
}: {
  id: string;
  title: string;
  start: number;
  playing: boolean;
  onPlay: () => void;
  label: string;
}) {
  return (
    <div className="cr-video">
      {playing ? (
        <iframe
          title={title}
          src={`https://www.youtube-nocookie.com/embed/${id}?start=${Math.floor(start)}&rel=0&autoplay=1&playsinline=1`}
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          className="cr-video-poster"
          onClick={onPlay}
          aria-label={`${label}: ${title}`}
        >
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          <Play size={30} />
          <strong>{label}</strong>
          <span>Từ {clock(start)} · YouTube</span>
        </button>
      )}
    </div>
  );
}
