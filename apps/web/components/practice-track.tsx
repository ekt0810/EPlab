"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export const practiceTracks = [
  {
    id: "embedded",
    base: "/nhung-c",
    label: "Lập trình nhúng C",
    count: 12,
    course: "lap-trinh-nhung-c",
    title: "Viết mã, kiểm tra, nộp bài.",
    description:
      "12 bài từ cơ bản, trung cấp đến nâng cao: C nền tảng, giao thức, scheduler, phục hồi lỗi và đồ án. Học kiến thức cần dùng, chạy các ca kiểm tra trên máy hoặc board rồi nộp mã nguồn để người chủ trì chấm.",
    accept: ".c,.h,.txt,.md",
  },
  {
    id: "kicad",
    base: "/kicad",
    label: "KiCad",
    count: 12,
    course: "thiet-ke-mach-kicad",
    title: "Đọc đề, làm mạch, nhận góp ý.",
    description:
      "12 bài từ cơ bản, trung cấp đến nâng cao: mạch LED, PCB, phân tích đường hồi và đồ án STM32. Mỗi bài có đầu ra, các bước thực hiện và bảng tiêu chí để người chủ trì chấm.",
    accept: "",
  },
  {
    id: "solidworks",
    base: "/solidworks",
    label: "SOLIDWORKS",
    count: 12,
    course: "thiet-ke-solidworks",
    title: "Đọc giáo trình, dựng hình, nộp thiết kế.",
    description:
      "12 bài từ cơ bản đến nâng cao: Sketch, Part, Assembly, cấu hình tham số, Sheet Metal và đồ án. Tự kiểm tra kích thước, nộp file và ảnh để người chủ trì trực tiếp nhận xét.",
    accept: ".sldprt,.sldasm,.slddrw,.step,.stp,.pdf,.txt,.md",
  },
];
export function usePracticeTrack() {
  const path = usePathname();
  const t =
    practiceTracks.find(
      (t) => path.startsWith(t.base + "/") || path === "/quan-tri" + t.base,
    ) || practiceTracks[1];
  return { ...t, api: `/api/${t.id}`, adminApi: `/api/admin/${t.id}` };
}
export function PracticeTrackTabs({ admin = false }: { admin?: boolean }) {
  const t = usePracticeTrack();
  return (
    <nav
      className="practice-nav practice-track-tabs"
      aria-label="Chọn môn thực hành"
    >
      {practiceTracks.map((x) => (
        <Link
          key={x.id}
          href={admin ? `/quan-tri${x.base}` : `${x.base}/thuc-hanh`}
          className={x.id === t.id ? "selected" : ""}
        >
          {x.label}
        </Link>
      ))}
    </nav>
  );
}
