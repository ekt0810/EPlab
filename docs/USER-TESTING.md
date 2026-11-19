# EP LAB — hướng dẫn kiểm thử chức năng

Bản chạy local: http://127.0.0.1:3100. Mã nguồn và dữ liệu đang dùng ở:

`C:/path/to/EPlab`

## Đăng nhập admin lần đầu

Hai email admin:

- `admin1@example.com`
- `admin2@example.com`

Hai tài khoản trên máy hiện tại đã hoàn tất đặt mật khẩu; dùng mật khẩu đã đặt để đăng nhập. Không có mật khẩu mặc định. Lệnh sau chỉ cần cho tài khoản chưa thiết lập ở bản cài mới và giữ nguyên tài khoản đã có:

```powershell
Set-Location -LiteralPath 'C:/path/to/EPlab'
npm run admin:setup
```

Đặt riêng mật khẩu ít nhất 12 ký tự cho từng email; ký tự được che. Sau đó mở http://127.0.0.1:3100/dang-nhap. Tài khoản đã thiết lập sẽ được giữ nguyên khi chạy lại lệnh. Trong **Tài khoản → Bảo mật & phiên**, có thể thiết lập MFA.

## Danh sách nên thử

| Thao tác | Kết quả mong đợi |
| --- | --- |
| Mở web khi chưa đăng nhập | Có ba lĩnh vực, bảy bài miễn phí; bài giáo trình riêng yêu cầu quyền học |
| Đăng nhập bằng một trong hai admin | Đọc được tất cả bài/tài liệu kể cả bản nháp; không phải trả phí |
| KiCad → Giáo trình | Có 8 chương, 24 bài; lọc chương, mở bài và lưu ghi chú |
| Làm câu tự kiểm tra rồi tải lại trang | Hiện giải thích; câu đúng được lưu vào tiến độ, ghi chú không mất |
| KiCad → Video Phil’s Lab | Có 43 nguồn; tìm kiếm/lọc; mở đúng video và mốc chương tại kênh tác giả |
| KiCad → Bài thực hành | Có 12 bài, yêu cầu nộp và bảng tiêu chí rõ ràng |
| Quản trị → Giao bài và chấm bài KiCad → Giao bài | Chọn bài, cả lớp hoặc học viên, hướng dẫn và hạn nộp; đóng/mở lại được |
| Mở bài được giao và nộp 1–2 ảnh + ghi chú | Ảnh xem trước được; sau gửi hiện Chờ giảng viên chấm |
| Thêm báo cáo ERC/DRC JSON hợp lệ | Xem tổng lỗi/cảnh báo; báo cáo chỉ là bằng chứng người học cung cấp |
| Admin chọn bài ở tab Chấm bài | Xem ảnh, chọn kết quả từng tiêu chí, nhập nhận xét chung và lưu |
| Ba tiêu chí Đạt, một Cần sửa | Điểm 75/100; nhận xét còn nguyên sau tải lại |
| Có tiêu chí Chưa đủ bằng chứng | Trạng thái Cần thêm bằng chứng; người học có thể nộp bản sửa |
| Hai admin mở cùng bài và lần lượt lưu | Lần lưu sau báo xung đột, yêu cầu tải lại; lịch sử người chấm được giữ |
| Giáo trình PDF | Có 3 bản người tham gia 5.0: C nhúng 51 trang, KiCad 50 trang, SOLIDWORKS 50 trang |
| Mở một bản giáo trình mới | Đọc/tải PDF đúng quyền, 12 liên kết mở trang chương và 12 liên kết đến bài thực hành tương ứng |
| Khách hoặc tài khoản chưa được duyệt Lab | Xem giới thiệu và mục lục; không tải được PDF dù biết đường dẫn tệp |
| SOLIDWORKS | Có giáo trình v5 50 trang và tài liệu người chủ trì 25 trang theo quyền; không có video |
| Giao diện hẹp/điện thoại | Menu mở/đóng được; form học/nộp/chấm không tràn ngang |

Để thử nhanh vòng nộp → chấm mà không tạo giao dịch, admin có thể tự luyện/nộp bài bằng tài khoản của mình rồi mở trang chấm để xem bài đó. Có thể giao cho cả lớp để thử luồng bài được giao; danh sách học viên riêng chỉ có khi đã có tài khoản học viên.

Luồng hiện hành không thu phí. Không tạo dữ liệu giả trên DB chính; bộ tự động tạo và dọn database riêng.

## Đăng ký và xét duyệt Lab

1. Tạo tài khoản bằng tên, email, số điện thoại/Zalo và mật khẩu. Kiểm tra lỗi thiếu/sai số điện thoại.
2. Xác minh email rồi đăng nhập: học được bài miễn phí, lưu ghi chú; chưa tải PDF riêng hoặc nộp bài.
3. Vào **Tham gia Lab**, chọn môn quan tâm, nhập mục tiêu và gửi yêu cầu.
4. Admin vào **Quản trị → Tham gia Lab**, xét duyệt và nhập phản hồi. Khi được duyệt, tài khoản học được cả ba môn; không tạo đơn hay chuyển khoản.
5. Thu hồi quyền Lab: chặn học liệu riêng nếu tài khoản không có quyền lịch sử khác. Gửi lại và kiểm tra xung đột nếu hai admin cùng xử lý một yêu cầu.

## Kiểm thử bài tập C và SOLIDWORKS

Mở `/nhung-c/thuc-hanh` hoặc `/solidworks/thuc-hanh`: mỗi môn có 12 bài. Tại Quản trị, chọn môn tương ứng để giao và chấm.

1. Mở một đề, đọc kiến thức và các ca tự kiểm tra; SOLIDWORKS có liên kết tới phần PDF tương ứng.
2. Giao bài cho cả lớp hoặc một học viên; mở từ Bài được giao.
3. Nộp 1–2 ảnh và tệp nguồn: C cần .c, SOLIDWORKS cần CAD/STEP; thêm ghi chú kết quả thực tế. Tối đa 6 tệp, 5 MB/tệp, tổng tệp 15 MB.
4. Xem bài nộp, tải lại tệp để đối chiếu; vào trang admin đúng môn, chọn tiêu chí, lưu điểm/nhận xét.
5. Tải lại trang học viên: file và nhận xét vẫn còn; nộp bản sửa tạo lần nộp mới. Đổi môn chỉ hiện bài thuộc môn đó.
6. Thử file .exe hoặc file sai loại: hệ thống từ chối. Tài khoản khác không tải được tệp qua đường dẫn bài nộp.

Chi tiết đề và định dạng: [Bài tập C và SOLIDWORKS](COURSE-EXERCISES.md).

## Khi mở lại server hoặc chạy kiểm thử tự động

Trong thư mục mã nguồn ở trên:

```powershell
npm start
```

Nếu server đã chạy thì chỉ mở trình duyệt; không chạy thêm tiến trình dùng cùng cổng. Ctrl+C trong terminal server để dừng. Dữ liệu giữ trong `data/`.

Để chạy lại kiểm thử tự động, giữ PostgreSQL local đang hoạt động:

```powershell
npm run typecheck
npm test
npm run test:browser
npm run test:backup
```

Các lệnh test tự tạo database `eplab_test_<loại>_<mã ngẫu nhiên>` và runtime tạm, không reset database chính hoặc database thử cũ. Cần `LOCAL_PG_PASSWORD` để tạo database có đúng owner. Bộ trình duyệt chạy độc lập trên cổng trống, dùng tài khoản `example.test` và không thay mật khẩu hai admin thật. Không chạy đồng thời hai bộ browser dùng cùng `.next-test`.

Kết quả browser và backup mới ở `test-results/`; xem `docs/VERIFICATION.md` để biết lần bàn giao đã xác nhận. `npm test` giữ riêng bộ hồi quy chế độ thanh toán cũ trên dữ liệu giả, cùng bộ kiểm thử Lab miễn phí hiện tại.

Khi báo lỗi, ghi trang đang mở, tài khoản thuộc vai trò nào, thao tác và kết quả mong muốn/thực tế. Không gửi mật khẩu hoặc mã MFA.

## Kiểm thử lộ trình và người tham gia – người chủ trì

1. Vào bài tập của từng môn: phải có 12 bài; lọc Cơ bản/Trung cấp/Nâng cao, mỗi mức 4 bài. Bài có gợi ý chuẩn bị và trạng thái đã nộp/đã đạt của chính tài khoản.
2. Người tham gia mở một bài, chọn Trao đổi với người chủ trì, nhập chủ đề và câu hỏi.
3. Người chủ trì vào Quản trị → môn → Trao đổi, chọn câu hỏi đang chờ và gửi câu trả lời.
4. Người tham gia bấm Làm mới tin nhắn: thấy đúng nhãn vai trò, nội dung, thời gian. Tải lại trang, chọn lại cuộc trao đổi: lịch sử còn nguyên.
5. Người chủ trì đánh dấu Đã giải đáp; người tham gia chọn Tiếp tục trao đổi để hỏi thêm. Tài khoản người tham gia khác không đọc được cuộc này.

Chi tiết: [Lộ trình và vai trò](PATHWAYS-AND-ROLES.md).
