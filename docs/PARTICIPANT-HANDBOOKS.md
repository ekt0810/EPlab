# Giáo trình người tham gia 4.0 trên EP LAB

Ngày cập nhật: 15/11/2026.

Mở `/giao-trinh` từ menu **Giáo trình PDF**. Có thể chọn môn bằng `?mon=embedded`, `?mon=kicad` hoặc `?mon=solidworks`.

| Môn | Trang | Chương / bài nộp | Đường dẫn bài đọc |
| --- | --- | --- | --- |
| C nhúng | 51 | 12 / 12 | `/bai-hoc/eplab-giao-trinh-embedded-v4` |
| KiCad | 50 | 12 / 12 | `/bai-hoc/eplab-giao-trinh-kicad-v4` |
| SOLIDWORKS | 50 | 12 / 12 | `/bai-hoc/eplab-giao-trinh-solidworks-v4` |

Các bản PDF có logo và chữ chìm EP lab trên mọi trang. Trong bài đọc có mục lục mở đúng trang PDF và nút sang bài thực hành cùng mã C01-C12, E01-E12, S01-S12. Người chủ trì chấm thủ công. Giáo trình người chủ trì không được đưa vào thư viện này.

Khách xem được tên, mô tả và mục lục. Nội dung PDF được lưu riêng qua Storage, không nằm trong `public/`; cả xem và tải đều qua API kiểm tra tài khoản, quyền kích hoạt, trạng thái bài/khóa và MFA. Hai người chủ trì không cần thanh toán. Bản gốc SOLIDWORKS 74 trang và các bài đọc KiCad đã có được giữ nguyên.

## Cài trên máy chủ khác

Chạy migrate và seed như hướng dẫn dự án. Seed tự cài ba giáo trình một lần. Với dữ liệu đã có, `npm run content:handbooks` chỉ cài bản 4.0 nếu chưa có, kiểm SHA-256 trước khi nhập và không sửa nội dung đã cài. Tệp nguồn nằm trong `apps/api/assets/participant-handbooks`; metadata trong `apps/api/src/content/participant-handbooks.ts`.

Database lưu lesson, resource và marker `participant_handbooks_v4`. Các PDF đang phục vụ được đưa vào bản sao lưu tài liệu riêng cùng database; khi khôi phục phải dùng cả database và tệp Storage. Không sao chép riêng database rồi bỏ các tệp học liệu.

## Kiểm thử

`npm test` kiểm tra khách, người tham gia chưa kích hoạt, người tham gia đã kích hoạt và cả hai admin; xác minh byte PDF bằng SHA-256, thu hồi quyền khi khóa học về nháp, MFA và 36 liên kết tới bài thực hành.

`npm run test:browser` kiểm tra thư viện, tải PDF, chuyển chương sang bài tập, bố cục điện thoại và các luồng giao/nộp/chấm đang có. Các tài khoản giả nằm trong `eplab_test`; không sửa mật khẩu hay bài nộp của người dùng thật.
