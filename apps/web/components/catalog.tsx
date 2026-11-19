"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Play,
  Check,
  LockKeyhole,
  ChevronDown,
  Cpu,
  CircuitBoard,
  Box,
  Layers,
  Code2,
  CheckCircle2,
  Compass,
} from "lucide-react";
import { useApi, categories, money } from "../lib/api";
import { useAuth } from "./context";
import { Loading, ErrorBox, PageTitle, Empty } from "./ui";
import { HandbookEntry } from "./handbooks";
import { SupportContact } from "./support-contact";
import { subjects, lessonHref } from "../lib/subjects";
export function CourseArt({ type }: { type: string }) {
  return (
    <div className={`course-art ${type}`} aria-hidden="true">
      {type === "embedded" ? (
        <>
          <div className="code-caption">
            <span />
            <span />
            <span />
            <em>main.c</em>
          </div>
          <div className="code-sample">
            <div>
              <i>01</i>
              <b>#include</b> &lt;stdint.h&gt;
            </div>
            <div>
              <i>02</i>
              <b>int</b> main(<b>void</b>) {"{"}
            </div>
            <div>
              <i>03</i>　 HAL_Init();
            </div>
            <div>
              <i>04</i>　 <b>while</b> (<em>1</em>) {"{"}
            </div>
            <div>
              <i>05</i>　　 <span>/* build something */</span>
            </div>
            <div>
              <i>06</i>　 {"}"}
            </div>
          </div>
          <Cpu className="art-icon" size={62} />
        </>
      ) : type === "kicad" ? (
        <>
          <svg viewBox="0 0 300 150">
            <g fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M0 36h67l20 20h40M0 110h65l20-20h42M300 30h-65l-25 25h-34M300 120h-58l-32-32h-34M150 0v43M150 101v49M40 0v21l44 44h43M270 150v-25l-37-37h-56" />
              <rect x="127" y="43" width="50" height="58" rx="3" />
              <path d="M133 39v-8m10 8v-8m10 8v-8m10 8v-8m10 8v-8M123 50h-8m8 10h-8m8 10h-8m8 10h-8m8 10h-8M181 50h8m-8 10h8m-8 10h8m-8 10h8m-8 10h8M133 105v8m10-8v8m10-8v8m10-8v8m10-8v8" />
              <circle cx="67" cy="36" r="3" />
              <circle cx="242" cy="120" r="3" />
            </g>
            <text
              x="152"
              y="77"
              textAnchor="middle"
              fill="currentColor"
              fontSize="10"
            >
              EP LAB
            </text>
          </svg>
          <span className="art-label">SCHEMATIC → PCB</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 300 150">
            <g fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="87" y="35" width="132" height="78" rx="8" />
              <rect x="99" y="47" width="108" height="54" rx="4" />
              <circle cx="108" cy="56" r="3" />
              <circle cx="198" cy="56" r="3" />
              <circle cx="108" cy="92" r="3" />
              <circle cx="198" cy="92" r="3" />
              <path d="M87 26V12m132 14V12M87 20h132M80 35H65m15 78H65M72 35v78M84 17l3 3-3 3m138-6-3 3 3 3M69 32l3 3 3-3m-6 84 3-3 3 3" />
              <path d="M145 68h16v13h-16zM152 61v-5m0 32v5m-14-18h-5m35 0h5" />
            </g>
            <text
              x="153"
              y="15"
              textAnchor="middle"
              fill="currentColor"
              fontSize="9"
            >
              55.00
            </text>
            <text
              x="60"
              y="78"
              textAnchor="middle"
              fill="currentColor"
              fontSize="9"
            >
              35
            </text>
          </svg>
          <span className="art-label">SKETCH → SẢN PHẨM</span>
        </>
      )}
    </div>
  );
}
export function CourseCard({ course }: { course: any }) {
  const cat = categories[course.category];
  return (
    <Link
      className="course-card"
      href={
        subjects.find((s) => s.id === course.category)?.base ||
        `/khoa-hoc/${course.slug}`
      }
    >
      <CourseArt type={course.category} />
      <div className="course-card-body">
        <span className={`category-label ${cat.color}`}>{cat.label}</span>
        <h3>{course.title}</h3>
        <p>{course.description}</p>
        <div className="course-meta">
          <span>
            <BookOpen size={14} />
            {course.lesson_count} bài đã xuất bản
          </span>
          <span className="level-dot">{course.level}</span>
        </div>
        <div className="course-bottom">
          <span>
            {course.category === "solidworks"
              ? "Giáo trình · Người chủ trì hướng dẫn"
              : `${course.preview_count} bài học thử miễn phí`}
          </span>
          <ArrowUpRight size={19} />
        </div>
      </div>
    </Link>
  );
}
export function PreviewList({ lessons }: { lessons: any[] }) {
  return (
    <div className="preview-list">
      {lessons.map((l, i) => (
        <Link
          className="preview-row"
          href={lessonHref(l.category, l.slug)}
          key={l.id}
        >
          <span className={`play-box ${categories[l.category].color}`}>
            {l.category === "solidworks" ? (
              <BookOpen size={17} />
            ) : (
              <Play size={17} fill="currentColor" />
            )}
          </span>
          <div>
            <span className="small-label">
              {categories[l.category].short} <i>·</i> Bài{" "}
              {(l.position ?? 0) + 1}
            </span>
            <h4>{l.title}</h4>
          </div>
          <span className="preview-language">
            {l.category === "solidworks"
              ? "Giới thiệu giáo trình"
              : l.language.startsWith("Tiếng Anh")
                ? "Video tiếng Anh"
                : "Tiếng Việt"}
          </span>
          <span className="badge free">Học thử</span>
          <ArrowUpRight size={17} />
        </Link>
      ))}
    </div>
  );
}
export function Home() {
  const courses = useApi<any[]>("/api/courses"),
    lessons = useApi<any[]>("/api/previews"),
    bill = useApi("/api/billing");
  return (
    <>
      <div className="welcome">
        <div>
          <span className="eyebrow">
            <span className="live-dot" /> CHÀO MỪNG ĐẾN EP LAB
          </span>
          <h1>
            Học kỹ thuật.
            <br />
            <span>Làm nên sản phẩm.</span>
          </h1>
          <p>
            Một không gian để học lập trình nhúng, thiết kế bo mạch
            <br className="desktop" /> và cơ khí — từng bước, qua thực hành.
          </p>
          <Link className="btn primary" href="/hoc-thu">
            Bắt đầu học miễn phí <ArrowRight size={17} />
          </Link>
        </div>
        <div className="learning-map">
          <div className="map-grid" />
          <div className="map-top">
            <span className="mono">BUILD YOUR NEXT IDEA</span>
            <span className="map-number">01 → 03</span>
          </div>
          <div className="map-step">
            <div className="map-step-icon">
              <Code2 size={24} />
            </div>
            <div>
              <small>01 / FIRMWARE</small>
              <strong>Viết dòng code đầu tiên</strong>
            </div>
            <span className="step-symbol">{"{ }"}</span>
          </div>
          <div className="map-step">
            <div className="map-step-icon">
              <CircuitBoard size={24} />
            </div>
            <div>
              <small>02 / HARDWARE</small>
              <strong>Đưa ý tưởng lên bo mạch</strong>
            </div>
            <span className="step-symbol">⌁</span>
          </div>
          <div className="map-step">
            <div className="map-step-icon">
              <Box size={24} />
            </div>
            <div>
              <small>03 / PRODUCT</small>
              <strong>Hoàn thiện hình hài sản phẩm</strong>
            </div>
            <CheckCircle2 size={19} />
          </div>
          <div className="map-footer">
            <span />
            <span>Mỗi kỹ năng, một bước tiến.</span>
          </div>
        </div>
      </div>
      <div className="quick-facts">
        <span>
          <Layers size={18} />
          <b>03</b> lĩnh vực kết nối
        </span>
        <span>
          <BookOpen size={18} />
          <b>{lessons.data?.length ?? "—"}</b> bài học thử miễn phí
        </span>
        <span>
          <CheckCircle2 size={18} />
          Lộ trình từ nền tảng đến thực hành
        </span>
      </div>
      <section>
        <div className="section-heading">
          <div>
            <span className="eyebrow">CHỌN ĐIỂM BẮT ĐẦU</span>
            <h2>Bạn muốn khám phá điều gì?</h2>
          </div>
          <Link href="/khoa-hoc">
            Tất cả khóa học <ArrowRight size={16} />
          </Link>
        </div>
        {courses.loading ? (
          <Loading />
        ) : courses.error ? (
          <ErrorBox message={courses.error} retry={courses.reload} />
        ) : (
          <div className="course-grid">
            {courses.data?.map((c) => (
              <CourseCard key={c.id} course={c} />
            ))}
          </div>
        )}
      </section>
      <div className="home-bottom">
        <section className="panel">
          <div className="section-heading compact">
            <div>
              <h2>Thử một bài học hôm nay</h2>
              <p>Không cần tài khoản. Bắt đầu bằng sự tò mò.</p>
            </div>
            <Link href="/hoc-thu" aria-label="Xem tất cả bài học thử">
              <ArrowUpRight size={20} />
            </Link>
          </div>
          {lessons.data && (
            <PreviewList lessons={lessons.data.filter((_, i) => i % 2 === 0)} />
          )}
        </section>
        <section className="membership-card">
          <div className="eyebrow">TÀI KHOẢN HỌC VIÊN</div>
          <h2>
            Mở rộng hành trình
            <br />
            của bạn.
          </h2>
          <div className="price">Miễn phí tham gia</div>
          <p>
            Lưu tiến độ, ghi chú và truy cập nội dung người tham gia đã xuất bản
            ở cả ba lĩnh vực.
          </p>
          <Link href="/tham-gia-lab">
            Xem quyền lợi tài khoản <ArrowRight size={17} />
          </Link>
        </section>
      </div>
    </>
  );
}
export function Catalog({ previews = false }: { previews?: boolean }) {
  const list = useApi<any[]>(previews ? "/api/previews" : "/api/courses");
  const [filter, setFilter] = useState("all"),
    [query, setQuery] = useState("");
  const searchParams = useSearchParams();
  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);
  const data =
    list.data?.filter(
      (c) =>
        (filter === "all" || c.category === filter) &&
        (c.title + " " + (c.description || ""))
          .toLowerCase()
          .includes(query.toLowerCase()),
    ) || [];
  return (
    <>
      <PageTitle
        eyebrow="THƯ VIỆN EP LAB"
        title={
          previews ? "Học thử. Không giới hạn tò mò." : "Khám phá các khóa học"
        }
        description={
          previews
            ? "Video nhập môn C nhúng, KiCad và phần giới thiệu giáo trình SOLIDWORKS, kèm hướng dẫn tiếng Việt."
            : "Chọn một kỹ năng để bắt đầu, rồi kết nối chúng thành sản phẩm."
        }
      />
      <div className="filters">
        <div className="filter-tabs">
          {[
            ["all", "Tất cả"],
            ["embedded", "Nhúng C"],
            ["kicad", "KiCad"],
            ["solidworks", "SOLIDWORKS"],
          ].map(([v, t]) => (
            <button
              className={filter === v ? "selected" : ""}
              onClick={() => setFilter(v)}
              key={v}
            >
              {t}
            </button>
          ))}
        </div>
        <input
          aria-label="Lọc theo tên"
          placeholder="Tìm theo tên bài hoặc khóa học…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {list.loading ? (
        <Loading />
      ) : list.error ? (
        <ErrorBox message={list.error} retry={list.reload} />
      ) : !data.length ? (
        <Empty
          title="Chưa tìm thấy nội dung"
          description="Thử từ khóa khác hoặc chọn tất cả lĩnh vực."
        />
      ) : previews ? (
        <div className="panel">
          <PreviewList lessons={data} />
        </div>
      ) : (
        <div className="course-grid">
          {data.map((c) => (
            <CourseCard course={c} key={c.id} />
          ))}
        </div>
      )}
    </>
  );
}
export function Course({ slug }: { slug: string }) {
  const { data: c, error, loading, reload } = useApi(`/api/courses/${slug}`);
  const { user } = useAuth();
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const allLessons = c.chapters.flatMap((ch: any) => ch.lessons);
  const first =
    (c.category === "solidworks" &&
      allLessons.find(
        (l: any) => l.slug === "eplab-giao-trinh-solidworks-v5" && l.accessible,
      )) ||
    (c.category === "solidworks" &&
      allLessons.find(
        (l: any) => l.slug === "solidworks-thuc-hanh" && l.accessible,
      )) ||
    allLessons.find((l: any) => l.accessible);
  return (
    <>
      <Link href="/khoa-hoc" className="back-link">
        ← Tất cả khóa học
      </Link>
      <div className="course-intro">
        <div>
          <span className={`category-label ${categories[c.category].color}`}>
            {categories[c.category].label}
          </span>
          <h1>{c.title}</h1>
          <p>{c.description}</p>
          <div className="intro-chips">
            <span>
              <BookOpen size={15} />
              {c.chapters.length} chương
            </span>
            <span>{c.level}</span>
            <span>Hướng dẫn tiếng Việt</span>
          </div>
          {first && (
            <Link className="btn primary" href={`/bai-hoc/${first.slug}`}>
              {c.category === "solidworks"
                ? first.preview
                  ? "Tìm hiểu cách học"
                  : "Đọc giáo trình"
                : user?.role === "admin"
                  ? "Mở bài học"
                  : user?.active
                    ? "Bắt đầu học"
                    : "Bắt đầu học thử"}{" "}
              {c.category === "solidworks" ? (
                <BookOpen size={16} />
              ) : (
                <Play size={16} />
              )}
            </Link>
          )}
        </div>
        <CourseArt type={c.category} />
      </div>
      {["embedded", "solidworks"].includes(c.category) && (
        <div className="panel practice-course-entry">
          <div>
            <h2>
              Bài tập và nộp bài{" "}
              {c.category === "embedded" ? "lập trình nhúng C" : "SOLIDWORKS"}
            </h2>
            <p>
              12 bài thực hành · Kiến thức cần dùng · Ca tự kiểm tra · Người chủ
              trì chấm thủ công
            </p>
          </div>
          <Link
            className="btn primary"
            href={`/${c.category === "embedded" ? "nhung-c" : "solidworks"}/thuc-hanh`}
          >
            Vào học và làm bài <ArrowRight size={16} />
          </Link>
          <Link
            className="btn secondary"
            href={`/${c.category === "embedded" ? "nhung-c" : "solidworks"}/bai-duoc-giao`}
          >
            Bài được giao
          </Link>
        </div>
      )}
      {c.category === "kicad" && (
        <div className="panel practice-course-entry">
          <div>
            <h2>Giáo trình & phòng thực hành KiCad</h2>
            <p>
              24 bài học · 12 bài thực hành · Tự kiểm tra · Người chủ trì chấm
              bài
            </p>
          </div>
          <Link className="btn primary" href="/kicad/giao-trinh">
            Vào giáo trình <ArrowRight size={16} />
          </Link>
          <Link className="btn secondary" href="/kicad/thuc-hanh">
            Xem bài tập
          </Link>
        </div>
      )}
      <HandbookEntry category={c.category} />
      <div className="two-col">
        <section>
          <h2>Nội dung & lộ trình</h2>
          <p className="muted">
            {c.category === "solidworks"
              ? "Đọc giáo trình theo từng phần, thực hành và trao đổi trực tiếp với người chủ trì."
              : "Các bài đang biên soạn được ghi rõ và chưa tính là nội dung đã xuất bản."}
          </p>
          {c.chapters.map((ch: any, i: number) => (
            <details className="chapter" key={ch.id} open>
              <summary>
                <span className="chapter-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <strong>{ch.title}</strong>
                <small>{ch.lessons.length} bài</small>
                <ChevronDown size={17} />
              </summary>
              {ch.lessons.map((l: any, j: number) => (
                <Link
                  className="curriculum-row"
                  href={lessonHref(l.category || c.category, l.slug)}
                  key={l.id}
                >
                  <span>{String(j + 1).padStart(2, "0")}</span>
                  {l.status === "draft" ? (
                    <Compass size={16} />
                  ) : l.accessible ? (
                    c.category === "solidworks" ? (
                      <BookOpen size={15} />
                    ) : (
                      <Play size={15} />
                    )
                  ) : (
                    <LockKeyhole size={15} />
                  )}
                  <div>{l.title}</div>
                  <span
                    className={`badge ${l.status === "draft" ? "draft" : l.preview ? "free" : "member"}`}
                  >
                    {user?.role === "admin" && l.accessible
                      ? l.status === "draft"
                        ? "Admin · Xem bản nháp"
                        : "Admin · Toàn quyền"
                      : l.status === "draft"
                        ? "Đang biên soạn"
                        : l.preview
                          ? "Học thử"
                          : l.accessible
                            ? "Đã mở khóa"
                            : "Người tham gia"}
                  </span>
                </Link>
              ))}
            </details>
          ))}
        </section>
        <aside className="panel course-aside">
          <h3>
            {user?.role === "admin"
              ? "Quyền truy cập người chủ trì"
              : c.category === "solidworks"
                ? "Học cùng người chủ trì"
                : "Học theo nhịp của bạn"}
          </h3>
          <p>
            {user?.role === "admin"
              ? "Bạn được xem toàn bộ bài học và tài liệu ở cả ba lĩnh vực, kể cả bản nháp. Không cần thanh toán hoặc kích hoạt."
              : c.category === "solidworks"
                ? "Giáo trình là tài liệu chính. Người chủ trì hướng dẫn thực hành và giải đáp trong buổi học."
                : "Xem bài nhập môn, thực hành từng bước và giữ lại những điều đã học."}
          </p>
          <ul className="checklist">
            <li>
              <Check size={17} />
              {c.category === "solidworks"
                ? "Giáo trình PDF EP LAB"
                : "Hai bài học thử miễn phí"}
            </li>
            <li>
              <Check size={17} />
              {c.category === "solidworks"
                ? "Người chủ trì trực tiếp hướng dẫn"
                : "Nguồn video được ghi rõ"}
            </li>
            <li>
              <Check size={17} />
              {c.category === "solidworks"
                ? "Mục lục và bài thực hành theo giáo trình"
                : "Bài tập và hướng dẫn tiếng Việt"}
            </li>
          </ul>
          <Link
            href={
              user?.role === "admin"
                ? "/quan-tri"
                : user
                  ? "/tham-gia-lab"
                  : "/dang-ky"
            }
            className="btn dark"
          >
            {user?.role === "admin"
              ? "Quản lý bài học"
              : user?.active
                ? "Tài khoản đã có quyền học"
                : "Tìm hiểu tài khoản người tham gia"}
            <ArrowRight size={16} />
          </Link>
        </aside>
      </div>
    </>
  );
}
export function Roadmap() {
  return (
    <>
      <PageTitle
        eyebrow="HỌC QUA THỰC HÀNH"
        title="Một sản phẩm. Ba chặng đường."
        description="Dự án liên môn dự kiến: trạm cảm biến với bo mạch và vỏ riêng. Lộ trình dưới đây giúp kết nối các kỹ năng; không phải tất cả bài đã xuất bản."
      />
      <div className="roadmap">
        {[
          {
            icon: Cpu,
            title: "Firmware đọc cảm biến",
            desc: "Hiểu C, đọc datasheet, giao tiếp cảm biến và quan sát dữ liệu qua UART.",
            href: "/khoa-hoc/lap-trinh-nhung-c",
            output:
              "Đầu ra dự kiến: mã nguồn, cấu hình chân và bản ghi thử nghiệm.",
          },
          {
            icon: CircuitBoard,
            title: "Bo mạch của chính bạn",
            desc: "Thiết kế schematic, lựa chọn footprint, bố trí PCB và kiểm tra trước khi xuất hồ sơ.",
            href: "/khoa-hoc/thiet-ke-mach-kicad",
            output:
              "Đầu ra dự kiến: project KiCad, báo cáo ERC/DRC và mô hình STEP.",
          },
          {
            icon: Box,
            title: "Một hình hài hoàn chỉnh",
            desc: "Thiết kế vỏ theo kích thước PCB, kiểm tra đầu nối và khả năng lắp ráp.",
            href: "/khoa-hoc/thiet-ke-solidworks",
            output:
              "Đầu ra dự kiến: mô hình part/assembly, bản vẽ và file STEP/STL.",
          },
        ].map((s, i) => (
          <article className="roadmap-step" key={s.title}>
            <span className="road-number">0{i + 1}</span>
            <s.icon size={35} />
            <div>
              <h2>{s.title}</h2>
              <p>{s.desc}</p>
              <small>{s.output}</small>
            </div>
            <Link href={s.href} className="btn secondary">
              Khám phá <ArrowRight size={16} />
            </Link>
          </article>
        ))}
      </div>
    </>
  );
}
export function Legal({ mode }: { mode: string }) {
  const contact = mode === "/lien-he",
    privacy = mode === "/quyen-rieng-tu";
  return (
    <>
      <PageTitle
        eyebrow="THÔNG TIN EP LAB"
        title={
          contact
            ? "Liên hệ & hỗ trợ"
            : privacy
              ? "Quyền riêng tư"
              : "Điều khoản học tập"
        }
      />
      <article className="panel prose legal">
        {contact ? (
          <>
            <h2>Trao đổi về hành trình học của bạn</h2>
            <SupportContact />
            <p>
              Cung cấp email tài khoản và mô tả câu hỏi học tập hoặc yêu cầu
              tham gia Lab để được hỗ trợ. Không gửi mật khẩu hoặc mã xác thực.
            </p>
          </>
        ) : privacy ? (
          <>
            <h2>Dữ liệu phục vụ việc học</h2>
            <p>
              EP LAB lưu email, tên, số điện thoại, mật khẩu đã băm, phiên đăng
              nhập, tiến độ, ghi chú và lịch sử tham gia Lab, quyền học. Dữ liệu
              được sử dụng để xác thực, cung cấp bài học và đối soát quyền truy
              cập.
            </p>
            <p>
              Số điện thoại do người học cung cấp chỉ hiển thị với chính người
              đó và quản trị viên, giúp EP LAB liên hệ hỗ trợ việc học qua điện
              thoại hoặc Zalo. EP LAB không công khai số điện thoại học viên
              trên danh sách khóa học.
            </p>
            <p>
              Lịch sử tài khoản lưu thời gian đăng nhập, thông tin trình duyệt
              của phiên và các thao tác tạo hồ sơ, gửi thư mời, khóa/mở khóa,
              xét duyệt của người chủ trì. Nhật ký dành cho quản trị viên để hỗ
              trợ và bảo vệ tài khoản; không lưu mật khẩu hoặc mã trong thư xác
              minh.
            </p>
            <h2>Video từ nguồn bên ngoài</h2>
            <p>
              Mở liên kết hoặc trình phát YouTube có thể gửi thông tin trình
              duyệt tới nhà cung cấp video. Bạn có thể đọc nội dung hướng dẫn
              trước khi lựa chọn mở video.
            </p>
            <h2>Quản lý tài khoản</h2>
            <p>
              Bạn có thể sửa tên và số điện thoại, thay mật khẩu, xem và thu hồi
              phiên trong trang tài khoản. Các yêu cầu khác về dữ liệu cần gửi
              tới kênh hỗ trợ của EP LAB. Thời hạn lưu dữ liệu và chính sách vận
              hành chi tiết sẽ được chủ website công bố trước khi mở dịch vụ
              công khai.
            </p>
          </>
        ) : (
          <>
            <h2>Tham gia Lab và quyền học</h2>
            <p>
              Đăng ký tài khoản và tham gia EP LAB không thu phí. Các bài học
              thử được xem công khai. Người học xác minh email, cung cấp số điện
              thoại và gửi yêu cầu; admin xét duyệt để cấp quyền học liệu đã
              xuất bản ở cả ba môn, nộp bài và nhận hỗ trợ. Quyền học không bao
              gồm tài liệu nội bộ người chủ trì, bản quyền phần mềm, thiết bị
              hoặc linh kiện.
            </p>
            <h2>Xét duyệt và hỗ trợ</h2>
            <p>
              Người chủ trì xem xét mục tiêu học tập, cấp quyền và phản hồi trên
              hệ thống. Người chủ trì có thể từ chối yêu cầu hoặc thu hồi quyền
              Lab, kèm lý do cho học viên.
            </p>
            <h2>Tài khoản và lịch sử đã có</h2>
            <p>
              Quyền học được cấp trước khi chuyển sang mô hình Lab vẫn được giữ.
              Lịch sử giao dịch trước đây được lưu để hỗ trợ tra cứu; website
              không tạo đơn thu phí tham gia mới.
            </p>
            <h2>Nguồn học liệu</h2>
            <p>
              Video công khai thuộc tác giả gốc và được ghi nguồn. Giá trị nội
              dung EP LAB nằm ở lộ trình, hướng dẫn, bài tập và tài liệu được
              quyền khai thác; không thu tiền chỉ để mở video miễn phí.
            </p>
          </>
        )}
      </article>
    </>
  );
}
