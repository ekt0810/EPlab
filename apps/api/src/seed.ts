import {
  embeddedAzDescription,
  embeddedAzPreviews,
} from "./content/laptrinhnhungaz-c.js";
import { installKicadPractice } from "./practice/install.js";
import { installPathways } from "./practice/install-pathways.js";
import { installCourseExercises } from "./practice/course-exercises.js";
import { installSolidworksTextbook } from "./content/install-solidworks-textbook.js";
import { installParticipantHandbooks } from "./content/install-participant-handbooks.js";
import { installHostHandbooks } from "./content/host-handbooks.js";
import { installHubMetadata } from "./content/install-hub-metadata.js";
import { pool, tx } from "./db.js";
import {
  kicadPhilsLabDescription,
  kicadPhilsLabPreviews,
} from "./content/phils-lab-kicad.js";
type Track = {
  slug: string;
  category: string;
  title: string;
  description: string;
  previews: {
    slug: string;
    title: string;
    summary: string;
    url: string;
    author: string;
    prerequisites?: string;
    version: string;
    content: string;
    exercise: string;
  }[];
  practice: {
    title: string;
    content: string;
    exercise: string;
    answer: string;
  };
  planned: string[];
};
const tracks: Track[] = [
  {
    slug: "lap-trinh-nhung-c",
    category: "embedded",
    title: "Lập trình nhúng C",
    description: embeddedAzDescription,
    previews: embeddedAzPreviews,
    practice: {
      title: "Thực hành C: điều khiển trạng thái bằng bit",
      content:
        "Bài thực hành EP LAB — không phụ thuộc video bên ngoài.\n\nMột byte có 8 bit. Với uint32_t, dùng mặt nạ UINT32_C(1) << n, trong đó n phải nhỏ hơn 32. OR đặt bit, AND với mặt nạ đảo xóa bit, XOR đảo bit. Dùng kiểu unsigned để tránh dịch trên số có dấu.\n\nVí dụ:\nuint32_t flags = 0;\nflags |= UINT32_C(1) << 3;\nflags &= ~(UINT32_C(1) << 3);\n\nKhi áp dụng với thanh ghi phần cứng, phải đọc reference manual: không phải thanh ghi nào cũng hỗ trợ read-modify-write; các cờ write-one-to-clear cần cách ghi riêng. volatile không thay thế đồng bộ hoặc bảo đảm thao tác nguyên tử.\n\nChạy bài C này bằng compiler trên máy riêng của bạn. Website không thực thi mã học viên.",
      exercise:
        "Viết hàm set_bit, clear_bit và test_bit cho uint32_t. Từ 0, đặt bit 2 và bit 7, rồi xóa bit 2. In kết quả dạng hex và giải thích. Hàm phải xử lý vị trí bit ngoài khoảng 0..31.",
      answer:
        "Sau khi đặt bit 2 và 7: 0x84. Xóa bit 2: 0x80. Kiểm tra n < 32 trước khi dịch. Mặt nạ unsigned giúp tránh hành vi không xác định với số có dấu.",
    },
    planned: [
      "Con trỏ, mảng và tổ chức bộ nhớ",
      "GPIO và đọc datasheet",
      "Ngắt, Timer và PWM",
      "ADC, DMA và bộ đệm",
      "UART, SPI và I²C",
      "Dự án: trạm đo cảm biến",
    ],
  },
  {
    slug: "thiet-ke-mach-kicad",
    category: "kicad",
    title: "Thiết kế mạch KiCad",
    description: kicadPhilsLabDescription,
    previews: kicadPhilsLabPreviews,
    practice: {
      title: "Thực hành: sơ đồ LED và kiểm tra ERC",
      content:
        "Bài thực hành EP LAB. Tạo một project KiCad mới cho mạch LED dùng nguồn 3,3 V. Dùng nguồn giới hạn dòng khi thử trên phần cứng.\n\nSơ đồ gồm đầu nối nguồn, điện trở hạn dòng, LED và GND. Với giả định điện áp thuận LED là 2,0 V và dòng mong muốn 5 mA, R = (3,3 - 2,0) / 0,005 = 260 Ω. Chọn 270 Ω cho bài tính minh họa; đối chiếu datasheet LED thực tế trước khi lắp.\n\nGán footprint phù hợp linh kiện thật, đánh dấu cực LED và pin 1 đầu nối. Chạy ERC; đọc từng cảnh báo thay vì tắt tất cả. Nếu nguồn ngoài không được công cụ nhận diện, dùng cơ chế khai báo nguồn phù hợp của KiCad.\n\nKhi bố trí PCB, giữ đường dòng điện ngắn và đặt silkscreen không chồng pad. Chạy DRC trước khi xuất Gerber.",
      exercise:
        "Nộp sơ đồ, ảnh kết quả ERC, bảng footprint và giải thích điện trở đã chọn. Nếu đổi nguồn thành 5 V, hãy tính lại điện trở với cùng giả định LED.",
      answer:
        "Với nguồn 5 V: R = (5 - 2) / 0,005 = 600 Ω. Có thể chọn 620 Ω để dòng thấp hơn mục tiêu một chút. Kiểm tra công suất điện trở và thông số LED thực trước khi sử dụng.",
    },
    planned: [
      "Thư viện symbol và footprint",
      "Bố trí PCB và đi dây",
      "Ground plane và DRC",
      "Gerber, BOM và xuất STEP",
      "Dự án: board cảm biến",
    ],
  },
];
export async function seed() {
  await tx(async (c) => {
    for (const [index, t] of tracks.entries()) {
      const existing = (
        await c.query("SELECT id FROM courses WHERE slug=$1", [t.slug])
      ).rows[0];
      if (existing) continue;
      const course = (
        await c.query(
          "INSERT INTO courses(slug,category,title,description,status,position) VALUES($1,$2,$3,$4,'published',$5) RETURNING id",
          [t.slug, t.category, t.title, t.description, index],
        )
      ).rows[0];
      const chapters = [];
      for (const [position, title] of [
        "Khởi động · Học thử miễn phí",
        "Phòng thực hành EP LAB",
        "Lộ trình tiếp theo · Đang biên soạn",
      ].entries())
        chapters.push(
          (
            await c.query(
              "INSERT INTO chapters(course_id,title,position) VALUES($1,$2,$3) RETURNING id",
              [course.id, title, position],
            )
          ).rows[0].id,
        );
      for (const [position, p] of t.previews.entries())
        await c.query(
          "INSERT INTO lessons(chapter_id,slug,title,summary,objectives,prerequisites,content,exercise,status,preview,position,software_version,video_url,video_type,author,language,source_url,rights,source_checked_at) VALUES($1,$2,$3,$4,$4,$11,$5,$6,'published',true,$7,$8,$9,'reference',$10,$12,$9,'public_reference',NULL)",
          [
            chapters[0],
            p.slug,
            p.title,
            p.summary,
            p.content,
            p.exercise,
            position,
            p.version,
            p.url,
            p.author,
            p.prerequisites || "Dành cho người bắt đầu.",
            t.category === "embedded" ? "Tiếng Việt" : "Tiếng Anh · hướng dẫn tiếng Việt",
          ],
        );
      await c.query(
        "INSERT INTO lessons(chapter_id,slug,title,summary,objectives,content,exercise,answer,status,preview,position,video_type,rights) VALUES($1,$2,$3,$4,$4,$5,$6,$7,'draft',false,0,'none','owned')",
        [
          chapters[1],
          `${t.category}-thuc-hanh`,
          t.practice.title,
          "Bài thực hành do EP LAB biên soạn, chờ quản trị viên duyệt trước khi xuất bản.",
          t.practice.content,
          t.practice.exercise,
          t.practice.answer,
        ],
      );
      for (const [position, title] of t.planned.entries())
        await c.query(
          "INSERT INTO lessons(chapter_id,slug,title,summary,status,position,video_type,rights) VALUES($1,$2,$3,'Nội dung thuộc lộ trình dự kiến; chưa phải bài học đã xuất bản.','draft',$4,'none','owned')",
          [
            chapters[2],
            `${t.category}-lo-trinh-${position + 1}`,
            title,
            position,
          ],
        );
    }
    const solidworks = (
      await c.query("SELECT id FROM courses WHERE slug='thiet-ke-solidworks'")
    ).rows[0];
    if (!solidworks) await installSolidworksTextbook(c);
    await installKicadPractice(c);
    await installCourseExercises(c);
    await installPathways(c);
  });
  await installParticipantHandbooks();
  await installHostHandbooks();
  await installHubMetadata();
}
if (
  process.argv[1]?.endsWith("seed.ts") ||
  process.argv[1]?.endsWith("seed.js")
) {
  await seed();
  console.log("Seed hoàn tất, không ghi đè nội dung đã có.");
  await pool.end();
}
