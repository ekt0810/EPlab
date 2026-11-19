# Lộ trình ba lĩnh vực và vai trò giao tiếp

Cập nhật ngày 15/11/2026: mỗi lĩnh vực có **12 bài thực hành — 4 cơ bản, 4 trung cấp, 4 nâng cao**, tổng 36 bài. Giữ các bài cũ và bổ sung 4 bài C, 4 bài SOLIDWORKS nâng cao; KiCad bổ sung yêu cầu phân tích/đối chiếu hồ sơ ở mức nâng cao.

## Vai trò

- **Người tham gia**: học, tự kiểm tra, nhận bài được giao, nộp bài, xem điểm/nhận xét và hỏi đáp riêng theo bài.
- **Người chủ trì**: hai tài khoản quản trị hiện có; giao bài, trả lời câu hỏi, chấm thủ công và quản lý nội dung. Hai tài khoản vẫn miễn phí và truy cập toàn bộ học liệu.

Tên vai trò trên giao diện đã đổi; mã `student`/`admin`, kiểm tra quyền backend và tài khoản hiện có được giữ để không làm mất quyền hay mật khẩu. Không mở đăng ký công khai thành người chủ trì. Nội dung do người dùng viết trước đây, tên tài khoản và PDF gốc không bị thay thế bằng cách gọi mới.

## Lộ trình

| Môn | Cơ bản (01–04) | Trung cấp (05–08) | Nâng cao (09–12) |
| --- | --- | --- | --- |
| C nhúng | ADC/kiểu dữ liệu, bit, FIFO, tick LED | Chống dội, UART dòng, lọc ADC, trạm đo | Parser nhị phân, scheduler, cấu hình hai slot, firmware có phục hồi lỗi |
| KiCad | Sơ đồ khối, linh kiện, LED, ERC | Footprint, outline/layout, placement, routing | Đường hồi/GND, nguồn/decoupling, hồ sơ chế tạo, đồ án STM32 |
| SOLIDWORKS | Sketch, Extrude/Cut, Revolve, plane nghiêng | Sweep, Loft, Assembly, Drawing | Họ chi tiết tham số, Sheet Metal, cơ cấu trượt, vỏ thiết bị |

Trang thực hành hiển thị ba bước, bộ lọc mức độ/chương và số bài đã đạt theo tài khoản. Bài trước là gợi ý chuẩn bị, không bắt buộc khóa truy cập bài sau; người chủ trì có thể giao theo trình độ. Tiến độ “đã đạt” lấy từ ít nhất một bài nộp được người chủ trì chấm đạt; không tự cấp điểm từ quiz hoặc nút tự đánh dấu.

SOLIDWORKS vẫn học từ giáo trình PDF và người chủ trì hướng dẫn. Các bài nâng cao như cấu hình/Sheet Metal nêu rõ phần cần hướng dẫn bổ sung, không tuyên bố PDF cũ đã chứa toàn bộ nội dung mới. Mô phỏng bằng mã C/thiết kế CAD thực hiện trên máy người tham gia, không chạy trên server.

## Trao đổi riêng

Mỗi trang bài tập và bài nộp có liên kết **Trao đổi**. Người tham gia chọn bài, nhập chủ đề và câu hỏi. Mỗi cặp người tham gia–bài tập có một cuộc trao đổi; gửi câu hỏi tiếp sẽ thêm vào cuộc đã có.

Người chủ trì mở **Quản trị → môn → Trao đổi**, chọn cuộc đang chờ, đọc câu hỏi và trả lời. Từng tin có tên, nhãn vai trò và thời gian. Chỉ người tham gia đó cùng hai người chủ trì được xem; người khác hoặc API môn khác không lấy được cuộc trao đổi bằng ID.

Người chủ trì đánh dấu **Đã giải đáp**; khi ấy không nhận thêm tin cho đến khi chủ trì hoặc người tham gia chọn **Tiếp tục trao đổi**. Lịch sử vẫn giữ nguyên. Nhấn **Làm mới tin nhắn/danh sách** để nhận nội dung mới; chưa có thông báo đẩy, email hoặc cập nhật realtime.

Các giới hạn: 3.000 ký tự/tin, 1.000 tin/cuộc; 10 lần mở/thêm câu hỏi qua form mới mỗi phút, 20 lần gửi trả lời/phút. Danh sách phân trang 30 cuộc; mỗi lần đọc 50 tin gần nhất và có nút xem cũ hơn. Không có tệp đính kèm trong tin nhắn; file bài làm vẫn gửi ở phần nộp bài. Nội dung được render như văn bản, không thực thi HTML.

## API và dữ liệu

Cho mỗi track `embedded`, `kicad`, `solidworks`:

| Method | URL | Chức năng |
| --- | --- | --- |
| GET | `/api/:track/conversations?page=0` | Người tham gia xem của mình; chủ trì xem cả môn; trạng thái chờ trả lời |
| POST | `/api/:track/conversations` | exerciseId, subject, body, clientId UUID; tạo/thêm câu hỏi vào cuộc của chính mình |
| GET | `/api/:track/conversations/:id?before=<messageId>` | Chi tiết và lịch sử, cursor xem các tin trước |
| POST | `/api/:track/conversations/:id/messages` | body, clientId UUID; gửi tin, chống gửi lại trùng |
| PATCH | `/api/:track/conversations/:id` | resolved; chỉ chủ trì đánh dấu true, chủ cuộc được mở lại false |

Mọi thao tác có phiên vẫn cần Origin/CSRF. Quyền đọc kiểm tra chủ cuộc hoặc người chủ trì; gửi tin cần quyền học và trạng thái khóa/bài hợp lệ. Khi mất quyền học vẫn đọc lịch sử của chính mình nhưng không gửi mới. Tài khoản bị khóa không xác thực được. Server xác định vai trò/tác giả từ phiên, không nhận role/authorId/participantId do client khai.

Migration 006 thêm `practice_threads` và `practice_messages`. Bản hiện có cập nhật bằng `npx tsx scripts/use-practice-pathways.ts`; script nạp thêm đề và ghép metadata level/order/prerequisites trong transaction một lần, giữ rubric các bài cũ và snapshot bài nộp trước đó. Seed mới tự nạp đủ. Backup/restore bao gồm cả hai bảng, đặt lại sequence tin nhắn sau phục hồi.

Đường dẫn học: `/nhung-c/thuc-hanh`, `/kicad/thuc-hanh`, `/solidworks/thuc-hanh`. Đường dẫn trao đổi tương ứng kết thúc bằng `/trao-doi`; người chủ trì dùng tab Trao đổi tại `/quan-tri/nhung-c`, `/quan-tri/kicad`, `/quan-tri/solidworks`.
