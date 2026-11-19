import { tx } from "../db.js";
export async function installHubMetadata() {
  await tx(async (c) => {
    await c.query("SELECT pg_advisory_xact_lock(8493024)");
    if ((await c.query("SELECT 1 FROM settings WHERE key='learning_hub_metadata_v1'")).rowCount) return;
    await c.query("UPDATE lessons l SET level=CASE WHEN k.module<=3 THEN 'basic' WHEN k.module<=6 THEN 'intermediate' ELSE 'advanced' END FROM kicad_lessons k WHERE k.lesson_id=l.id");
    await c.query("UPDATE lessons SET level='all' WHERE slug LIKE 'eplab-giao-trinh-%' OR slug='solidworks-thuc-hanh'");
    await c.query("UPDATE lessons SET level='intermediate' WHERE slug IN ('nhan-dien-board-stm32','c-con-tro-lap-trinh-nhung-az','solidworks-lo-trinh-4','solidworks-lo-trinh-5')");
    await c.query("UPDATE lessons SET level='advanced' WHERE slug='solidworks-lo-trinh-6'");
    const goals = [
      ["bat-dau-voi-stm32cubeide","Xác định các kiến thức C cần chuẩn bị và chọn bước bắt đầu phù hợp trong lộ trình lập trình nhúng."],
      ["nhan-dien-board-stm32","Giải thích vai trò của volatile và nhận biết tình huống cần cân nhắc sử dụng trong chương trình nhúng."],
      ["c-con-tro-lap-trinh-nhung-az","Phân biệt địa chỉ và giá trị, đọc khai báo con trỏ và theo dõi thao tác truy cập dữ liệu qua con trỏ."],
      ["eplab-giao-trinh-embedded-v5","Tổ chức dữ liệu và hàm C; xây bộ đệm, máy trạng thái và giao thức; kiểm tra scheduler, lưu cấu hình và đồ án firmware có phục hồi lỗi."],
      ["eplab-giao-trinh-kicad-v5","Chuyển yêu cầu thành schematic và PCB; kiểm tra ERC/DRC, đường hồi dòng và hồ sơ sản xuất; hoàn thiện đồ án bo mạch có bằng chứng kiểm tra."],
      ["eplab-giao-trinh-solidworks-v5","Dựng sketch và mô hình tham số; tạo cụm lắp và bản vẽ; thực hiện cấu hình, Sheet Metal và đồ án có hồ sơ bàn giao."],
    ];
    for (const [slug, objectives] of goals) await c.query("UPDATE lessons SET objectives=$2 WHERE slug=$1 AND (objectives=summary OR objectives='')",[slug,objectives]);
    await c.query("INSERT INTO settings(key,value) VALUES('learning_hub_metadata_v1','true')");
  });
}
