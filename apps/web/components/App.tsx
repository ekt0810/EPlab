"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  FlaskConical,
  Files,
  UserRound,
  ShieldCheck,
  Menu,
  X,
  Search,
  LogOut,
  Cpu,
  CircuitBoard,
  Box,
  Trophy,
  Presentation,
} from "lucide-react";
import { AuthProvider, useAuth } from "./context";
import { api, setCsrf, useApi } from "../lib/api";
import {
  subjects,
  subjectForPath,
  subjectSection,
  subjectSections,
  lessonHref,
} from "../lib/subjects";
import { Legal } from "./catalog";
import { Lesson } from "./lesson";
import { AuthPage } from "./auth-pages";
import { Profile } from "./account";
import { LabMembership } from "./lab-membership";
import { Admin } from "./admin";
import { PracticeExercises, PracticeExercise } from "./practice-exercises";
import {
  MyAssignments,
  MySubmissions,
  SubmissionDetail,
} from "./practice-submissions";
import { PracticeConversations } from "./practice-conversations";
import { PracticeAdmin } from "./practice-admin";
import { Empty, Loading, ErrorBox } from "./ui";
import { Brand } from "./brand";
import { ThemeSwitcher } from "./theme-switcher";
import { SubjectNav } from "./subject-nav";
import { SubjectHome } from "./subject-home";
import { ClassroomLibrary } from "./classroom/library";
import { ClassroomReader } from "./classroom/reader";
import { Competitions } from "./competitions";

function LegacyDestination({
  lesson,
  href,
}: {
  lesson?: string;
  href?: string;
}) {
  const router = useRouter(),
    params = useSearchParams();
  const intro = useApi(lesson ? `/api/lessons/${lesson}/intro` : null);
  const target =
    href ||
    (intro.data ? lessonHref(intro.data.category, intro.data.slug) : null);
  useEffect(() => {
    if (target) {
      const [targetPath, targetQuery] = target.split("?");
      const query = new URLSearchParams(params.toString());
      new URLSearchParams(targetQuery).forEach((value, key) =>
        query.set(key, value),
      );
      router.replace(targetPath + (query.size ? "?" + query.toString() : ""));
    }
  }, [target, router, params]);
  return intro.error ? (
    <ErrorBox message={intro.error} retry={intro.reload} />
  ) : (
    <Loading />
  );
}
function Workspace() {
  const pathname = usePathname(),
    router = useRouter(),
    params = useSearchParams();
  const { user, refresh } = useAuth();
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState("");
  const subject = subjectForPath(pathname),
    active = subjectSection(pathname);
  const icons = [BookOpen, FlaskConical];
  const links = subject
    ? subjectSections.map((s, i) => ({
        href: subject.base + "/" + s.key,
        title: s.label,
        icon: icons[i],
        active: active === s.key,
      }))
    : [
        {
          href: "/",
          title: "Chọn môn học",
          icon: LayoutDashboard,
          active: pathname === "/",
        },
        {
          href: "/hoc-thu",
          title: "Học thử miễn phí",
          icon: BookOpen,
          active: pathname === "/hoc-thu",
        },
      ];
  let page: React.ReactNode;
  if (pathname === "/") page = <SubjectHome />;
  else if (subject && pathname === subject.base + "/lop-hoc")
    page = <ClassroomLibrary track={subject.id} />;
  else if (
    subject &&
    /^\/(kicad|nhung-c|solidworks)\/lop-hoc\/[a-z]{1,3}\d{2}$/.test(pathname)
  )
    page = <ClassroomReader track={subject.id} id={pathname.split("/")[3]} />;
  else if (pathname === "/cuoc-thi") page = <Competitions />;
  else if (
    subject &&
    (pathname === subject.base || pathname === subject.base + "/tong-quan")
  )
    page = <LegacyDestination href={subject.base + "/lop-hoc"} />;
  else if (subject && pathname === subject.base + "/bai-hoc")
    page = <LegacyDestination href={subject.base + "/lop-hoc"} />;
  else if (pathname === "/kicad/bai-hoc/video")
    page = <LegacyDestination href="/kicad/lop-hoc?tab=resources" />;
  else if (subject && pathname.startsWith(subject.base + "/bai-hoc/"))
    page = <Lesson slug={pathname.split("/")[3]} subject={subject} />;
  else if (subject && pathname === subject.base + "/tai-lieu")
    page = <LegacyDestination href={subject.base + "/lop-hoc?tab=resources"} />;
  else if (pathname === "/hoc-thu") page = <SubjectHome previews />;
  else if (pathname === "/khoa-hoc") page = <LegacyDestination href="/" />;
  else if (pathname.startsWith("/khoa-hoc/"))
    page = subject ? (
      <LegacyDestination href={subject.base + "/lop-hoc"} />
    ) : (
      <Empty
        title="Không tìm thấy môn học"
        description="Chọn một môn trong EP LAB."
        href="/"
        label="Chọn môn"
      />
    );
  else if (pathname.startsWith("/bai-hoc/"))
    page = <LegacyDestination lesson={pathname.split("/")[2]} />;
  else if (pathname === "/giao-trinh") {
    const s = subjects.find((x) => x.id === params.get("mon"));
    page = s ? (
      <LegacyDestination href={s.base + "/lop-hoc?tab=resources"} />
    ) : (
      <SubjectHome />
    );
  } else if (pathname === "/kicad/giao-trinh")
    page = <LegacyDestination href="/kicad/lop-hoc" />;
  else if (pathname === "/kicad/video")
    page = <LegacyDestination href="/kicad/lop-hoc?tab=resources" />;
  else if (pathname === "/lo-trinh") page = <LegacyDestination href="/" />;
  else if (/^\/(kicad|nhung-c|solidworks)\/thuc-hanh$/.test(pathname))
    page = <PracticeExercises />;
  else if (/^\/(kicad|nhung-c|solidworks)\/thuc-hanh\//.test(pathname))
    page = <PracticeExercise id={pathname.split("/")[3]} />;
  else if (/^\/(kicad|nhung-c|solidworks)\/bai-duoc-giao$/.test(pathname))
    page = <MyAssignments />;
  else if (/^\/(kicad|nhung-c|solidworks)\/bai-nop$/.test(pathname))
    page = <MySubmissions />;
  else if (/^\/(kicad|nhung-c|solidworks)\/bai-nop\//.test(pathname))
    page = <SubmissionDetail id={pathname.split("/")[3]} />;
  else if (/^\/(kicad|nhung-c|solidworks)\/trao-doi$/.test(pathname))
    page = <PracticeConversations />;
  else if (/^\/quan-tri\/(kicad|nhung-c|solidworks)$/.test(pathname))
    page = <PracticeAdmin />;
  else if (
    [
      "/dang-nhap",
      "/dang-ky",
      "/quen-mat-khau",
      "/xac-minh",
      "/dat-lai-mat-khau",
      "/nhan-tai-khoan",
    ].includes(pathname)
  )
    page = <AuthPage mode={pathname} />;
  else if (pathname === "/tai-khoan") page = <Profile />;
  else if (pathname === "/kich-hoat")
    page = <LegacyDestination href="/tham-gia-lab" />;
  else if (pathname === "/tham-gia-lab") page = <LabMembership />;
  else if (pathname === "/quan-tri") page = <Admin />;
  else if (["/dieu-khoan", "/quyen-rieng-tu", "/lien-he"].includes(pathname))
    page = <Legal mode={pathname} />;
  else
    page = (
      <Empty
        title="Không tìm thấy trang"
        description="Đường dẫn này không còn tồn tại."
        href="/"
        label="Chọn môn học"
      />
    );
  return (
    <div
      className={`workspace ${/\/lop-hoc\/[^/]+$/.test(pathname) ? "is-classroom" : ""}`}
    >
      <a className="skip" href="#main">
        Đến nội dung chính
      </a>
      {open && <div className="overlay" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "is-open" : ""}`}>
        <Link className="brand" href="/" onClick={() => setOpen(false)}>
          <Brand />
        </Link>
        <button
          className="mobile-close icon-button"
          aria-label="Đóng menu"
          onClick={() => setOpen(false)}
        >
          <X />
        </button>
        <div className="nav-caption">
          {subject ? subject.short.toUpperCase() : "KHÔNG GIAN HỌC TẬP"}
        </div>
        <nav aria-label="Menu chính">
          {links.map((l) => (
            <Link
              key={l.href}
              className={`nav-link ${l.active ? "active" : ""}`}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <l.icon size={20} />
              {l.title}
            </Link>
          ))}
        </nav>
        <div className="nav-caption second">
          {subject ? "ĐỔI MÔN" : "BA LĨNH VỰC"}
        </div>
        <nav className="track-nav" aria-label="Các môn học">
          {subjects.map((s, i) => {
            const Icon = [Cpu, CircuitBoard, Box][i];
            return (
              <Link
                key={s.id}
                href={s.base + "/lop-hoc"}
                className={s.id === subject?.id ? "current" : ""}
                onClick={() => setOpen(false)}
              >
                <Icon size={20} />
                {s.short}
              </Link>
            );
          })}
        </nav>
        <div className="nav-caption second">CƠ HỘI THỰC HÀNH</div>
        <Link
          className={`nav-link ${pathname === "/cuoc-thi" ? "active" : ""}`}
          href="/cuoc-thi"
          aria-current={pathname === "/cuoc-thi" ? "page" : undefined}
          onClick={() => setOpen(false)}
        >
          <Trophy size={20} />
          Cuộc thi Embedded
        </Link>
        <div className="sidebar-bottom">
          <div className="nav-caption">TÀI KHOẢN & HỖ TRỢ</div>
          {user?.role === "admin" && (
            <Link
              className="nav-link"
              href="/quan-tri"
              onClick={() => setOpen(false)}
            >
              <ShieldCheck size={20} />
              Quản trị hệ thống
            </Link>
          )}
          <Link
            className="nav-link"
            href="/tham-gia-lab"
            onClick={() => setOpen(false)}
          >
            <FlaskConical size={20} />
            Tham gia Lab
          </Link>
          <Link
            className="nav-link"
            href={user ? "/tai-khoan" : "/dang-nhap"}
            onClick={() => setOpen(false)}
          >
            <UserRound size={20} />
            {user ? "Tài khoản của tôi" : "Đăng nhập"}
          </Link>
          {!user && (
            <Link
              className="nav-link"
              href="/dang-ky"
              onClick={() => setOpen(false)}
            >
              <UserRound size={20} />
              Đăng ký miễn phí
            </Link>
          )}
          <Link
            className="nav-link"
            href="/lien-he"
            onClick={() => setOpen(false)}
          >
            Liên hệ EP LAB
          </Link>
          <div className="side-foot">EP LAB · Học để làm</div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <button
            className="mobile-toggle icon-button"
            aria-label="Mở menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Menu />
          </button>
          <Link className="topbar-home" href="/">
            EP LAB
          </Link>
          <form
            className="search-box"
            onSubmit={(e) => {
              e.preventDefault();
              router.push(
                `${subject ? subject.base + "/lop-hoc" : "/"}?q=${encodeURIComponent(search)}`,
              );
            }}
          >
            <Search size={19} />
            <input
              aria-label={subject ? "Tìm bài trong môn" : "Tìm khóa học"}
              placeholder={
                subject ? `Tìm bài ${subject.short}…` : "Tìm môn học…"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="search-submit" aria-label="Tìm kiếm">
              ↵
            </button>
          </form>
          <ThemeSwitcher />
          {user ? (
            <div className="user-menu">
              <Link
                href="/tai-khoan"
                className="avatar"
                aria-label="Tài khoản của tôi"
              >
                {user.name.slice(0, 1).toUpperCase()}
              </Link>
              <span>{user.name}</span>
              <button
                className="icon-button"
                aria-label="Đăng xuất"
                onClick={async () => {
                  await api("/api/auth/logout", "POST", {});
                  setCsrf(null);
                  await refresh();
                  router.push("/");
                }}
              >
                <LogOut size={19} />
              </button>
            </div>
          ) : (
            <Link className="btn dark small" href="/dang-nhap">
              Đăng nhập
            </Link>
          )}
        </header>
        <main id="main" key={pathname + params.toString()}>
          {subject && <SubjectNav subject={subject} />}
          <div className={subject ? "subject-content" : ""}>{page}</div>
        </main>
        <footer>
          <span>© {new Date().getFullYear()} EP LAB · Embedded PTIT Lab</span>
          <div>
            <Link href="/quyen-rieng-tu">Quyền riêng tư</Link>
            <Link href="/dieu-khoan">Điều khoản</Link>
            <Link href="/lien-he">Liên hệ</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}
export default function App() {
  return (
    <AuthProvider>
      <Workspace />
    </AuthProvider>
  );
}
