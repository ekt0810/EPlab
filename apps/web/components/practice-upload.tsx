"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Upload, ArrowRight } from "lucide-react";
import { usePracticeTrack } from "./practice-track";
import { api } from "../lib/api";
import { Notice } from "./ui";
import type { SelfCheck } from "./practice-self-checks";
export function PracticeUpload({
  id,
  assignmentId,
  assignment,
  notes,
  onNotes,
  checks,
  draftStatus,
  onSaved,
}: {
  id: string;
  assignmentId: string | null;
  assignment: any;
  notes: string;
  onNotes: (s: string) => void;
  checks: SelfCheck[];
  draftStatus: string;
  onSaved: () => void;
}) {
  const track = usePracticeTrack();
  const [files, setFiles] = useState<File[]>([]),
    [attachments, setAttachments] = useState<File[]>([]),
    [previews, setPreviews] = useState<string[]>([]),
    [report, setReport] = useState(""),
    [errorSubmit, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState<any>(null);
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach(URL.revokeObjectURL);
  }, [files]);
  return (
    <form
      id="submit-work"
      className="panel stack practice-upload"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          if (checks.some((c) => c.status !== "not_run" && !c.observed.trim()))
            throw new Error(
              "Ghi kết quả thực tế cho mỗi ca đã kiểm tra ở bước 2.",
            );
          if (files.length < 1 || files.length > 2)
            throw new Error("Chọn 1–2 ảnh bài làm.");
          if (files.some((f) => f.size > 5 * 1024 * 1024))
            throw new Error("Mỗi ảnh tối đa 5 MB.");
          if (
            track.id !== "kicad" &&
            (!attachments.length || attachments.length > 6)
          )
            throw new Error("Chọn 1–6 tệp bài làm theo đề.");
          if (
            attachments.some((f) => f.size > 5 * 1024 * 1024) ||
            attachments.reduce((n, f) => n + f.size, 0) > 15 * 1024 * 1024
          )
            throw new Error("Mỗi tệp tối đa 5 MB, tổng tệp tối đa 15 MB.");
          const f = new FormData(e.currentTarget);
          f.delete("attachmentPicker");
          attachments.forEach((file) => f.append("attachments", file));
          f.delete("imagePicker");
          f.delete("reportFile");
          f.set("exerciseId", id);
          f.set("selfChecks", JSON.stringify(checks));
          if (assignmentId) f.set("assignmentId", assignmentId);
          files.forEach((file) => f.append("images", file));
          setSaved(await api(`${track.api}/submissions`, "POST", f));
          onSaved();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Upload size={26} />
      <h2>3. Nộp bài và nhận góp ý</h2>
      <p className="practice-note" role="status">
        {draftStatus} Ảnh và tệp cần chọn lại sau khi tải lại trang.
      </p>
      <p>
        Ảnh bài làm và kết quả kiểm tra rõ chữ. Nhận 1–2 ảnh PNG/JPEG/WebP, tối
        đa 5 MB/ảnh.
      </p>
      <label>
        Chọn ảnh bài làm
        <input
          type="file"
          name="imagePicker"
          accept="image/png,image/jpeg,image/webp"
          multiple
          required
          onChange={(e) => {
            setFiles(Array.from(e.target.files || []));
            setSaved(null);
          }}
        />
      </label>
      {previews.length > 0 && (
        <div className="practice-image-previews">
          {previews.map((url, i) => (
            <figure key={url}>
              <img src={url} alt={`Xem trước ảnh bài làm ${i + 1}`} />
              <figcaption>{files[i]?.name}</figcaption>
            </figure>
          ))}
        </div>
      )}
      {track.id !== "kicad" && (
        <div className="stack practice-attachments">
          <label>
            Tệp bài làm
            <input
              type="file"
              name="attachmentPicker"
              aria-label="Tệp bài làm"
              accept={track.accept}
              multiple
              required
              onChange={(e) => {
                setAttachments(Array.from(e.target.files || []));
                setSaved(null);
              }}
            />
          </label>
          <p>
            {track.id === "embedded"
              ? "Nộp .c/.h; ghi lệnh build và kết quả trong .txt/.md. Cần ít nhất một file .c."
              : "Nộp SLDPRT/SLDASM/SLDDRW hoặc STEP theo đề; kèm PDF/văn bản nếu cần. Với Assembly, gửi đủ các Part cùng tên."}
          </p>
          <p>
            Tối đa 6 tệp; 5 MB/tệp, tổng 15 MB. Không cần nén ZIP. Tệp chỉ chủ
            bài và người chủ trì được tải.
          </p>
          {attachments.length > 0 && (
            <ul>
              {attachments.map((f, i) => (
                <li key={i}>
                  {f.name} · {(f.size / 1024).toFixed(1)} KB
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <label>
        Ghi chú bài làm
        <textarea
          name="notes"
            aria-label="Ghi chú bài làm"
          value={notes}
          onChange={(e) => onNotes(e.target.value)}
          required
          minLength={15}
          maxLength={1500}
          rows={5}
          placeholder="Nêu việc đã làm, phiên bản thiết kế, kết quả kiểm tra và phần cần góp ý."
        />
      </label>
      {track.id === "kicad" && (
        <details className="practice-report">
          <summary>Báo cáo ERC/DRC JSON (tùy chọn)</summary>
          <label>
            Chọn báo cáo JSON
            <input
              type="file"
              name="reportFile"
              accept=".json,application/json"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (f.size > 100000) {
                  setError("Báo cáo tối đa 100 KB.");
                  return;
                }
                setReport(await f.text());
              }}
            />
          </label>
          <label>
            Dán JSON xuất từ KiCad
            <textarea
              name="report"
              value={report}
              onChange={(e) => setReport(e.target.value)}
              maxLength={100000}
              rows={5}
            />
          </label>
          <p>
            Hệ thống tổng hợp số lỗi và cảnh báo từ báo cáo bạn cung cấp. Người
            chủ trì kiểm tra và quyết định điểm.
          </p>
        </details>
      )}
      {errorSubmit && <Notice type="error">{errorSubmit}</Notice>}
      <button className="btn primary" disabled={busy || assignment?.closed}>
        {busy ? "Đang lưu…" : "Gửi bài để người chủ trì chấm"}
      </button>
      {saved && (
        <Notice type="success">
          {saved.duplicate
            ? "Bài này đã được lưu trước đó."
            : "Đã lưu bài. Chờ người chủ trì chấm."}
          <p>
            <Link href={`${track.base}/bai-nop/${saved.id}`}>
              Xem bài nộp và nhận xét <ArrowRight size={16} />
            </Link>
          </p>
        </Notice>
      )}
    </form>
  );
}
