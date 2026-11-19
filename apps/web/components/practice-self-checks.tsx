"use client";
import { useEffect, useState } from "react";
export type SelfCheck = {
  index: number;
  status: "not_run" | "pass" | "fail";
  observed: string;
};
export const selfCheckLabels = {
  not_run: "Chưa kiểm tra",
  pass: "Đúng như mong đợi",
  fail: "Chưa đúng / còn vướng",
};
export function usePracticeDraft(key: string, definitions: string[][] = []) {
  const blank = () =>
    definitions.map((_, index): SelfCheck => ({
      index,
      status: "not_run",
      observed: "",
    }));
  const [notes, setNotes] = useState("");
  const [checks, setChecks] = useState<SelfCheck[]>(blank);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState("");
  const signature = JSON.stringify(definitions);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.notes === "string")
          setNotes(saved.notes.slice(0, 1500));
        if (saved.signature === signature && Array.isArray(saved.checks))
          setChecks(
            blank().map((c) => {
              const found = saved.checks.find((x: any) => x.index === c.index);
              return found &&
                ["not_run", "pass", "fail"].includes(found.status) &&
                typeof found.observed === "string"
                ? {
                    ...c,
                    status: found.status,
                    observed: found.observed.slice(0, 600),
                  }
                : c;
            }),
          );
      }
    } catch {
      setStatus("Không đọc được nháp trên thiết bị này.");
    }
    setReady(true);
  }, [key, signature]);
  useEffect(() => {
    if (!ready) return;
    try {
      if (
        !notes &&
        checks.every((c) => c.status === "not_run" && !c.observed)
      ) {
        localStorage.removeItem(key);
        setStatus("Ghi chú và tự kiểm tra sẽ được lưu nháp trên thiết bị này.");
      } else {
        localStorage.setItem(key, JSON.stringify({ notes, checks, signature }));
        setStatus("Đã lưu nháp ghi chú và tự kiểm tra trên thiết bị này.");
      }
    } catch {
      setStatus(
        "Trình duyệt không lưu được nháp. Giữ trang mở đến khi nộp xong.",
      );
    }
  }, [key, signature, notes, checks, ready]);
  return {
    notes,
    setNotes,
    checks,
    setChecks,
    ready,
    status,
    clear: () => {
      setNotes("");
      setChecks(blank());
    },
  };
}
export function PracticeSelfChecks({
  exercise,
  checks,
  onChange,
}: {
  exercise: any;
  checks: SelfCheck[];
  onChange: (v: SelfCheck[]) => void;
}) {
  const update = (index: number, patch: Partial<SelfCheck>) =>
    onChange(checks.map((c) => (c.index === index ? { ...c, ...patch } : c)));
  return (
    <section id="self-checks" className="exercise-checks practice-self-checks">
      <h2>2. Làm và tự kiểm tra</h2>
      <p>
        Thực hiện trong phần mềm của bạn, rồi ghi điều quan sát được. Có thể nộp
        cả ca chưa đạt để nhận góp ý; tự kiểm tra không thay thế điểm của người
        chấm.
      </p>
      <p className="badge">
        Đã kiểm tra {checks.filter((c) => c.status !== "not_run").length}/
        {checks.length} ca
      </p>
      {exercise.checks.map(([input, expected]: string[], index: number) => (
        <article key={index}>
          <details open={index === 0}>
            <summary>
              Kiểm tra {index + 1} · {selfCheckLabels[checks[index].status]}
            </summary>
            <p>
              <b>Thao tác / đầu vào:</b> {input}
            </p>
            <p>
              <b>Kết quả mong đợi:</b> {expected}
            </p>
            <label>
              Kết quả tự kiểm tra {index + 1}
              <select
                aria-label={`Kết quả tự kiểm tra ${index + 1}`}
                value={checks[index].status}
                onChange={(e) =>
                  update(index, {
                    status: e.target.value as SelfCheck["status"],
                  })
                }
              >
                {Object.entries(selfCheckLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Quan sát thực tế {index + 1}
              <textarea
                aria-label={`Quan sát thực tế ${index + 1}`}
                rows={2}
                maxLength={600}
                value={checks[index].observed}
                onChange={(e) => update(index, { observed: e.target.value })}
                placeholder="Kết quả chạy, kích thước đo được, lỗi còn gặp hoặc số ảnh minh chứng…"
              />
            </label>
          </details>
        </article>
      ))}
    </section>
  );
}
