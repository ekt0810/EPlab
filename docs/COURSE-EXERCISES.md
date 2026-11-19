# Bài tập C nhúng và SOLIDWORKS

Bổ sung ngày 15/11/2026: **12 bài lập trình nhúng C và 12 bài SOLIDWORKS**, bên cạnh 12 bài KiCad. Tất cả dùng luồng giao bài → nộp bài → hai admin chấm thủ công → học viên nhận phản hồi/nộp bản sửa. Không có AI chấm và không thực thi mã nguồn học viên trên server.

Mỗi môn có 4 bài cơ bản, 4 trung cấp, 4 nâng cao. Tám bài đầu ở bảng dưới; bốn bài nâng cao C09–C12 và S09–S12, cách gọi người tham gia/người chủ trì và hỏi đáp riêng được mô tả tại [Lộ trình và vai trò](PATHWAYS-AND-ROLES.md).

## Vào học, làm và nộp bài

- C nhúng: http://127.0.0.1:3100/nhung-c/thuc-hanh
- SOLIDWORKS: http://127.0.0.1:3100/solidworks/thuc-hanh
- Admin C: http://127.0.0.1:3100/quan-tri/nhung-c
- Admin SOLIDWORKS: http://127.0.0.1:3100/quan-tri/solidworks

Trên thanh chọn môn hoặc trang khóa học, chọn môn → Bài thực hành. Mỗi bài có kiến thức cần dùng, yêu cầu, bước thực hiện, ca tự kiểm tra, bằng chứng cần nộp và bốn tiêu chí 25 điểm. Giáo trình/bài tập chi tiết cần tài khoản đã kích hoạt hoặc admin; mục lục công khai.

## Bộ bài tập

| C nhúng | Nội dung / đầu ra |
| --- | --- |
| C01 | Kiểu dữ liệu, chuyển ADC 12 bit sang millivolt; kiểm tra biên và con trỏ |
| C02 | Set/clear/test bit, module C/H, chỉ số bit ngoài miền |
| C03 | FIFO 4 byte, đầy/rỗng, đi vòng, thứ tự dữ liệu |
| C04 | LED bằng tick 500 ms không chặn, kiểm tra quay vòng bộ đếm |
| C05 | Chống dội 20 ms, đếm cạnh nhấn, không đếm giữ nút |
| C06 | Parser UART theo dòng, LF/CRLF, lệnh sai và quá dài |
| C07 | Trung bình trượt 4 mẫu, khởi động/reset và mẫu sai |
| C08 | Đồ án cảm biến: lấy mẫu, lọc, alarm hysteresis, STATUS |

Bài C có thể kiểm thử bằng compiler/mô phỏng trên máy học viên trước khi dùng board. Ghi rõ loại bằng chứng là mô phỏng hay đo trên phần cứng. Website không có dịch vụ compile/run tự động; giảng viên xem mã và log, tự chạy trong môi trường của mình khi cần.

| SOLIDWORKS | Nội dung / phần giáo trình |
| --- | --- |
| S01 | Sketch tấm 80×50, hai lỗ Ø8, Fully Defined — trang 4–22 |
| S02 | Tấm dày 8 mm, Extrude/Cut, kiểm tra thể tích — trang 23–33 |
| S03 | Trục bậc, Revolve/Fillet/Chamfer — trang 34–45 |
| S04 | Plane nghiêng 30°, lỗ theo pháp tuyến — trang 46–55 |
| S05 | Sweep thanh Ø6 theo path có bo R10 — trang 56–65 |
| S06 | Loft tròn Ø30 sang chữ nhật 40×25 — trang 56–65 |
| S07 | Assembly trục/bạc, mates và một bậc quay — trang 66–74 |
| S08 | Drawing A4, PDF/STEP và hồ sơ bàn giao — trang 66–74 |

Các đề kích thước trên do EP LAB bổ sung để luyện kỹ năng theo phần giáo trình; không tuyên bố là bản sao các hình H1/H4 trong PDF. PDF 74 trang được giữ nguyên. SOLIDWORKS tiếp tục học bằng giáo trình và giảng viên, không có video mới.

## Nộp file và chấm

1. Admin chọn môn ở trang quản trị, tab **Giao bài**, chọn bài/cả lớp hoặc học viên, thêm hướng dẫn và hạn nộp.
2. Người học vào **Bài được giao**, đọc đề và làm trên máy. Chọn **1–2 ảnh** kết quả, **1–6 tệp** bài làm, ghi kết quả kiểm tra rồi gửi.
3. Bài C cần ít nhất một `.c`; nhận thêm `.h`, `.txt`, `.md` UTF-8. Bài SOLIDWORKS cần tệp `.sldprt`, `.sldasm`, `.slddrw`, `.step` hoặc `.stp`; có thể kèm `.pdf`, `.txt`, `.md`. Assembly/Drawings cần đủ các Part tham chiếu, giữ đúng tên. Không nén ZIP.
4. Admin mở bài ở **Chấm bài**, tải tệp, xem ảnh và ghi nhận xét từng tiêu chí. Lưu điểm/nhận xét; học viên xem lại và có thể nộp bản sửa mới.

Tệp tối đa 5 MB/tệp, tổng tệp 15 MB/lần; tối đa 6 tệp. Hạn mức dữ liệu tệp đính kèm trong DB là 100 MB/tài khoản (tính theo dữ liệu lưu, gồm mã hóa base64). Ảnh vẫn tối đa 5 MB/ảnh, 8 megapixel, được chuẩn hóa WebP như KiCad. Giữ giới hạn 20 bài/giờ và 100 bài/tài khoản cho cả ba môn cộng lại.

Tệp chỉ chủ bài hoặc admin tải được. API trả download, `nosniff`, không hiển thị/thực thi như HTML và không dùng tên file làm đường dẫn ổ đĩa. Mã kiểm tra extension, UTF-8 hoặc dấu hiệu định dạng; đây không phải xác nhận CAD mở được, không phải quét virus và không đánh giá bài làm đúng. Việc mở/rebuild/kiểm tra mô hình thuộc bước học viên/giảng viên thực hiện.

Ảnh, tệp nguồn, bảng tiêu chí lúc nộp và lịch sử chấm được giữ. Đổi môn không hiện bài môn khác; truy cập ID bài/file qua API môn sai trả 404. Nộp lại đúng cùng dữ liệu trả về bài đã có, đổi nội dung tạo một bản nộp mới. Giảng viên tự quyết định điểm theo tiêu chí; ca tự kiểm tra không tự cấp điểm.

## Cập nhật bản đã cài

Khi DB đang chạy, trong thư mục dự án:

```powershell
npx tsx scripts/use-course-practice.ts
npm run build
```

Sau đó dừng/chạy lại `npm start`. Để nạp thêm lộ trình nâng cao và trao đổi, chạy tiếp `npx tsx scripts/use-practice-pathways.ts`. Script ở trên áp dụng migration 005 (cột attachments của submissions) và nạp 16 đề trong transaction một lần. Chạy lại không nhân đôi hoặc ghi đè nội dung, không đổi admin/ngân hàng/thu phí. Bản cài mới chạy setup/seed sẽ tự nạp.

Nguồn đề: `apps/api/src/practice/course-exercises.ts`; nội dung đang dùng lưu ở `exercises.body`. Thay file sau lần nhập đầu không tự sửa DB; dùng migration nội dung có phiên bản khi cần thay đề. Chưa có trình biên tập đề/tiêu chí trực quan riêng.

Backup/restore bao gồm attachments trong bảng submissions, giữ nguyên bytes/hash và quyền tải. Snapshot backup ứng dụng vượt 512 MB bị từ chối trước khi đóng gói; dùng quy trình pg_dump trong tài liệu vận hành khi dữ liệu lớn.

## API bổ sung

Các nhóm `/api/embedded/*`, `/api/solidworks/*` có `exercises`, `assignments`, `submissions` và chi tiết như KiCad; nhóm admin là `/api/admin/embedded/*`, `/api/admin/solidworks/*`. Quiz/giáo trình cấu trúc/video library cũ vẫn chỉ thuộc KiCad.

POST submissions gửi multipart trường `images` và `attachments`, cùng `exerciseId`, `notes`, `assignmentId` tùy chọn. Báo cáo ERC/DRC chỉ nhận ở KiCad. GET `submissions/:id/files/:index` trả tệp riêng (index từ 0); JSON bài nộp chỉ trả tên/dung lượng/SHA-256, không trả bytes/base64 tệp. Kiểm tra quyền tại mọi lần tải. Review, assignment và list đều lọc theo môn từ backend.
