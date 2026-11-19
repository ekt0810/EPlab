"use client";
import { usePracticeTrack } from "./practice-track";
import { useAuth } from "./context";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function PracticeNav() {
  const track = usePracticeTrack(),
    path = usePathname(),
    { user } = useAuth();
  if (
    path.includes("/bai-hoc") ||
    path.includes("/video") ||
    path.includes("/giao-trinh")
  )
    return (
      <p className="hub-source">
        <Link href={track.base + "/lop-hoc"}>← Lớp học {track.label}</Link>
      </p>
    );
  return (
    <nav className="practice-nav" aria-label="Hoạt động thực hành">
      {[
        [`${track.base}/thuc-hanh`, "Danh sách bài tập"],
        [`${track.base}/bai-duoc-giao`, "Bài được giao"],
        [`${track.base}/bai-nop`, "Bài nộp của tôi"],
        [`${track.base}/trao-doi`, "Trao đổi"],
        ...(user?.role === "admin"
          ? [[`/quan-tri${track.base}`, "Giao bài & chấm bài"]]
          : []),
      ].map(([href, title]) => (
        <Link
          key={href}
          href={href}
          className={
            path === href || path.startsWith(href + "/") ? "selected" : ""
          }
        >
          {title}
        </Link>
      ))}
    </nav>
  );
}
export function PracticeLocked() {
  return (
    <section className="panel empty">
      <h2>Nội dung dành cho người tham gia</h2>
      <p>
        Đăng nhập tài khoản đã có quyền học để học và nộp bài. Hai người chủ trì
        được truy cập miễn phí.
      </p>
      <div className="button-row">
        <Link className="btn primary" href="/dang-nhap">
          Đăng nhập
        </Link>
        <Link className="btn secondary" href="/tham-gia-lab">
          Xem quyền học
        </Link>
      </div>
    </section>
  );
}
