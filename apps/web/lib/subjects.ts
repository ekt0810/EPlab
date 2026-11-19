export const subjects = [
  {
    id: "embedded",
    base: "/nhung-c",
    course: "lap-trinh-nhung-c",
    label: "Lập trình nhúng C",
    short: "Nhúng C",
    description:
      "Từ những dòng C đầu tiên đến firmware có tổ chức, kiểm tra được và phục hồi khi có lỗi.",
    audience:
      "Người mới học lập trình và người muốn dùng C để làm việc với vi điều khiển.",
    prerequisites:
      "Biết thao tác tệp trên máy tính. Phần nhập môn hướng dẫn nền tảng; các bài sau ghi rõ kiến thức cần chuẩn bị.",
    tools: [
      "Máy tính và trình soạn thảo mã",
      "Trình biên dịch C để chạy bài nền tảng",
      "Board vi điều khiển và bộ nạp khi học phần phần cứng",
    ],
    outcomes: [
      "Tổ chức hàm, dữ liệu, mảng, con trỏ và thao tác bit.",
      "Xây bộ đệm, máy trạng thái, bộ phân tích lệnh và tác vụ định kỳ.",
      "Kiểm tra lỗi, ghi lại bằng chứng và bàn giao đồ án firmware.",
    ],
    stages: [
      "Dữ liệu, hàm, bit và bộ đệm",
      "Máy trạng thái, giao tiếp và tích hợp",
      "Scheduler, cấu hình chịu lỗi và đồ án",
    ],
    source:
      "Video tham khảo công khai của Lập Trình Nhúng A-Z. Giáo trình, bài tập và phản hồi do EP LAB tổ chức.",
  },
  {
    id: "kicad",
    base: "/kicad",
    course: "thiet-ke-mach-kicad",
    label: "Thiết kế mạch KiCad",
    short: "KiCad",
    description:
      "Đọc yêu cầu, vẽ sơ đồ nguyên lý, bố trí PCB và kiểm tra bộ hồ sơ trước khi chế tạo.",
    audience:
      "Người bắt đầu thiết kế mạch và người muốn làm bo mạch cho dự án nhúng.",
    prerequisites:
      "Hiểu điện áp, dòng điện và các linh kiện cơ bản. Chuẩn bị KiCad theo phiên bản được ghi trong bài.",
    tools: [
      "KiCad và trình xem PDF",
      "Datasheet của các linh kiện sử dụng",
      "Thư mục lưu project, ảnh kiểm tra và hồ sơ xuất",
    ],
    outcomes: [
      "Đọc datasheet, chọn linh kiện và vẽ schematic có tổ chức.",
      "Gán footprint, bố trí PCB, chạy ERC/DRC và xử lý lỗi.",
      "Xuất Gerber, BOM và mô hình STEP, giải thích quyết định thiết kế.",
    ],
    stages: [
      "Project, linh kiện và schematic",
      "Footprint, PCB và hồ sơ sản xuất",
      "Đường hồi, kiểm tra thiết kế và đồ án",
    ],
    source:
      "Video tham khảo công khai của Phil’s Lab. Bài đọc tiếng Việt và bài thực hành là phần học liệu EP LAB.",
  },
  {
    id: "solidworks",
    base: "/solidworks",
    course: "thiet-ke-solidworks",
    label: "Thiết kế cơ khí SOLIDWORKS",
    short: "SOLIDWORKS",
    description:
      "Học qua giáo trình, dựng chi tiết và cụm lắp, tạo bản vẽ rồi nhận góp ý từ người chủ trì.",
    audience:
      "Người mới học CAD và người muốn thiết kế chi tiết, đồ gá hoặc vỏ cho sản phẩm điện tử.",
    prerequisites:
      "Biết thao tác máy tính và đọc kích thước cơ bản. Cần có quyền sử dụng SOLIDWORKS phù hợp.",
    tools: [
      "SOLIDWORKS với quyền sử dụng hợp lệ",
      "Giáo trình PDF EP LAB",
      "Thư mục lưu Part, Assembly, Drawing và file trao đổi",
    ],
    outcomes: [
      "Tạo sketch đủ ràng buộc và dựng mô hình tham số.",
      "Lắp ráp chi tiết, kiểm tra kích thước và xuất bản vẽ.",
      "Thực hiện cấu hình, Sheet Metal và đồ án thiết kế có hồ sơ bàn giao.",
    ],
    stages: [
      "Sketch, kích thước và Part",
      "Assembly, bản vẽ và cấu hình",
      "Sheet Metal, kiểm tra và đồ án",
    ],
    source:
      "Học theo giáo trình PDF EP LAB và buổi hướng dẫn trực tiếp của người chủ trì; không yêu cầu video.",
  },
] as const;
export type Subject = (typeof subjects)[number];
export const subjectSections = [
  { key: "lop-hoc", label: "Lớp học" },
  { key: "thuc-hanh", label: "Thực hành" },
] as const;
export function subjectForPath(path: string) {
  return subjects.find(
    (s) =>
      path === s.base ||
      path.startsWith(s.base + "/") ||
      path === "/khoa-hoc/" + s.course,
  );
}
export function subjectSection(path: string) {
  if (path.includes("/lop-hoc")) return "lop-hoc";
  if (/\/(thuc-hanh|bai-duoc-giao|bai-nop|trao-doi)(\/|$)/.test(path))
    return "thuc-hanh";
  return "lop-hoc";
}
export function lessonHref(category: string, slug: string) {
  return `${subjects.find((s) => s.id === category)?.base || ""}/bai-hoc/${slug}`;
}
export const levelLabels: Record<string, string> = {
  basic: "Cơ bản",
  intermediate: "Trung cấp",
  advanced: "Nâng cao",
  all: "Cơ bản → nâng cao",
};
export const formatLabels: Record<string, string> = {
  video: "Video",
  document: "Giáo trình PDF",
  reading: "Bài đọc",
};
export const progressLabel = (l: any) =>
  l.progress?.completed
    ? "Đã hoàn thành"
    : l.progress
      ? "Đang học"
      : "Chưa học";
