"use client";
import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Search } from "lucide-react";
import { useApi } from "../../lib/api";
import { Loading, ErrorBox } from "../ui";
import { plain, clock, baseFor, type Track, type Source } from "./types";
import { VideoMetadata } from "./video-player";

export function SourceLibrary({ track }: { track: Track }) {
  const { data, loading, error, reload } = useApi<{
    checkedAt: string;
    method: string;
    videos: Source[];
    documents: string[];
    counts: {
      total: number;
      selected: number;
      unavailable: number;
      excluded: number;
    };
  }>(`/api/classroom/${track}/sources`);
  const [query, setQuery] = useState(""),
    [kind, setKind] = useState("selected"),
    [language, setLanguage] = useState("all");
  if (loading) return <Loading />;
  if (error || !data) return <ErrorBox message={error} retry={reload} />;
  const visible = data.videos.filter(
    (v) =>
      plain(
        (v.title || v.id) + " " + v.reason + " " + (v.channel || ""),
      ).includes(plain(query)) &&
      (language === "all" || v.language === language) &&
      (kind === "all" ||
        (kind === "selected"
          ? !["excluded", "unavailable"].includes(v.kind)
          : v.kind === kind)),
  );
  return (
    <section className="cr-source-library">
      <div className="cr-source-summary">
        <h2>Nguồn rõ ràng, học theo chủ đề</h2>
        <p>{data.method}</p>
        {track === "solidworks" ? (
          <p>
            {data.counts.selected} video thao tác gắn với{" "}
            {new Set(data.videos.flatMap((v) => v.lessonIds || [])).size} bài
            học. {data.videos.filter((v) => v.language === "vi").length} video
            tiếng Việt; các video tiếng Anh có hướng dẫn quan sát bằng tiếng
            Việt trong bài. Chọn liên kết bài để vừa xem vừa làm theo.
          </p>
        ) : (
          <div className="cr-metrics">
            <span>{data.counts.total} mục khảo sát</span>
            <span>{data.counts.selected} nguồn được giữ</span>
            <span>{data.counts.excluded} mục ngoài phạm vi</span>
            <span>{data.counts.unavailable} mục thiếu dữ liệu công khai</span>
          </div>
        )}
      </div>
      {!!data.videos.length && (
        <>
          <div className="cr-filters">
            <label>
              <Search size={17} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Tìm nguồn video"
                placeholder="Tìm nguồn video…"
              />
            </label>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              aria-label="Lọc loại nguồn"
            >
              <option value="selected">Nguồn được giữ</option>
              <option value="all">Toàn bộ khảo sát</option>
              {track === "kicad" && (
                <>
                  <option value="kicad">Dùng KiCad trực tiếp</option>
                  <option value="pcb">Kiến thức PCB chuyển giao</option>
                  <option value="bringup">Bring-up & debug</option>
                </>
              )}
              {track === "solidworks" && (
                <option value="solidworks">Thao tác SOLIDWORKS</option>
              )}
              {track === "embedded" && <option value="c">Playlist C</option>}
              <option value="excluded">Ngoài phạm vi</option>
              <option value="unavailable">Chưa truy cập được</option>
            </select>
            {track === "solidworks" && (
              <select
                aria-label="Lọc ngôn ngữ video"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="all">Tất cả ngôn ngữ</option>
                <option value="vi">Tiếng Việt</option>
                <option value="en">Tiếng Anh</option>
              </select>
            )}
          </div>
          <div className="cr-source-list">
            {visible.map((v) => (
              <article key={v.id}>
                <div>
                  <span className="cr-tag">
                    {
                      (
                        {
                          kicad: "KiCad trực tiếp",
                          pcb: "PCB / phần cứng",
                          bringup: "Bring-up tùy chọn",
                          c: "Playlist C",
                          solidworks: "Thao tác SOLIDWORKS",
                          excluded: "Ngoài phạm vi",
                          unavailable: "Chưa xác minh nội dung",
                        } as Record<string, string>
                      )[v.kind]
                    }
                  </span>
                  <h3>
                    {v.title || `Mục không có tiêu đề công khai · ${v.id}`}
                  </h3>
                  <VideoMetadata
                    language={v.language}
                    channel={v.channel}
                    softwareVersion={v.softwareVersion}
                  />
                  <p>{v.reason}</p>
                  <small>
                    {v.duration ? clock(v.duration) : "Chưa có thời lượng"} ·{" "}
                    {v.lessonIds?.length
                      ? `${v.lessonIds.length} bài liên quan`
                      : "Tài liệu mở rộng / không dùng làm bài"}
                  </small>
                  {track === "solidworks" && !!v.lessonIds?.length && (
                    <div className="cr-source-lessons">
                      {v.lessonIds.map((id) => (
                        <Link key={id} href={`${baseFor(track)}/lop-hoc/${id}`}>
                          Học bài {id.toUpperCase()} →
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
                <a
                  href={v.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Mở nguồn ${v.title || v.id}`}
                >
                  <ExternalLink size={18} />
                </a>
              </article>
            ))}
          </div>
          {!visible.length && <p>Không có nguồn khớp bộ lọc.</p>}
        </>
      )}
      <h3>Tài liệu kỹ thuật đối chiếu</h3>
      <ul className="cr-documents">
        {data.documents.map((u) => (
          <li key={u}>
            <a href={u} target="_blank" rel="noreferrer">
              {new URL(u).hostname} ·{" "}
              {decodeURIComponent(u.split("/").pop() || u)}{" "}
              <ExternalLink size={12} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
