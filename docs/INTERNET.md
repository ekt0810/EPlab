# EP LAB — website đang công khai

Cập nhật ngày 15/11/2026. Địa chỉ HTTPS: https://lab.example.com

Đã bật ngrok, kiểm tra trang chủ, API health, chế độ public/SMTP và chặn khách ở API quản trị. Frontend, backend và PostgreSQL vẫn chạy trên máy này; ngrok chuyển tiếp qua gateway riêng. Máy phải bật và có Internet. Task tự khởi động sau khi người dùng đăng nhập Windows.

## Truy cập

- Lần đầu ngrok miễn phí có thể hiện trang xác nhận; bấm **Visit Site**.
- Giáo trình mới: `/giao-trinh` — C nhúng 51 trang, KiCad 50 trang, SOLIDWORKS 50 trang.
- Đăng nhập qua địa chỉ HTTPS công khai. Cookie của địa chỉ local không được dùng chung với tên miền ngrok.
- Người chủ trì vào `/tai-khoan?tab=security` để thiết lập **Xác thực hai bước** riêng của EP LAB. Đây không phải Xác minh 2 bước Google.

## Quyền quản trị

Theo yêu cầu chủ hệ thống, xác thực hai bước là tùy chọn, kể cả khi website công khai. Hai tài khoản người chủ trì đã xác minh đăng nhập bằng email và mật khẩu EP LAB, được quản trị và truy cập toàn bộ học liệu miễn phí. Không có điều kiện phải bật MFA mới được sử dụng. Nếu một tài khoản chủ động bật MFA sau này thì các phiên của tài khoản đó vẫn phải xác thực mã. Kiểm tra vai trò, tài khoản bị khóa, CSRF và xác nhận lại mật khẩu cho thao tác nhạy cảm vẫn được giữ nguyên.

## Email

Gmail đã lưu trong `.env` riêng và kiểm tra TLS/xác thực SMTP thành công. Chưa xác nhận thư thực tế đã vào Inbox; kiểm thử gửi thư bằng thao tác đăng ký/khôi phục của chính chủ tài khoản. Không gửi thư kiểm thử cho người khác khi chưa được yêu cầu.

`EP-LAB-Cau-hinh-email.cmd` mở chế độ Gmail với tài khoản người chủ trì thứ nhất điền sẵn, chỉ yêu cầu nhập mật khẩu ứng dụng vào ô được che. Dùng `npm run mail:configure` nếu cần một nhà cung cấp SMTP khác. Mật khẩu ứng dụng đã xuất hiện trong ảnh cần được thu hồi và thay bằng mã mới; không chụp lại cửa sổ chứa mã.

## Điều khiển

```powershell
npm run ngrok:status
npm run ngrok:check
npm run ngrok:disable
npm run ngrok:enable
npm run server:status
```

`ngrok:disable` tắt tunnel trước rồi chuyển về local. `ngrok:enable` kiểm tra HTTPS, SMTP, hai tài khoản đã thiết lập, loopback và backup; tạo backup, chuyển cấu hình public và khởi động tunnel. Nếu kết nối/kiểm tra HTTPS thất bại, công cụ tắt tunnel và khôi phục cấu hình trước đó.

Supervisor giám sát worker khi có `data/operations/ngrok-enabled`. Ngrok trỏ vào gateway 127.0.0.1:3101, gateway chuyển `/api/` vào 4100 và trang web vào 3100. Database không được mở công khai. Gateway kiểm tra Host/HTTPS, cấu hình public/SMTP, lọc header IP giả mạo; API chỉ tin proxy loopback. Ngrok tắt inspect và remote management.

Báo cáo thực tế ở `docs/reports/ngrok-public-check.json`. Phạm vi là kiểm tra HTTPS qua ngrok từ mạng máy chủ và mở bằng Chrome; chưa phải phép thử từ một mạng 4G độc lập. Bộ kiểm thử luồng học/nộp/chấm chạy trên database riêng `eplab_test`.

## Di chuyển máy chủ

Mang mã nguồn, `.env` qua kênh riêng, bản backup mã hóa và khóa khôi phục tới máy mới. Cài dependencies, migrate/restore, cấu hình lại đường dẫn và cơ chế tự khởi động. Không bật cùng một tên miền ngrok đồng thời trên hai máy. Không đưa `.env`, dữ liệu người học, token hoặc backup vào kho Git công khai.

Nguồn: [Google — mật khẩu ứng dụng](https://support.google.com/accounts/answer/185833?hl=vi), [ngrok — giới hạn miễn phí](https://ngrok.com/docs/pricing-limits/free-plan-limits).
