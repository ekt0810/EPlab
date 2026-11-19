# Máy chủ EP LAB trên Windows

Địa chỉ: http://127.0.0.1:3100. Bản production nằm trong dự án này; frontend, API và PostgreSQL chạy trên chính máy, dữ liệu ở `data/`. Đã mở HTTPS qua ngrok tại https://lab.example.com và cấu hình SMTP. Chế độ Lab miễn phí đang hoạt động.

## Đã cài

- Task Scheduler: **EP LAB Local Server**, trigger AtLogOn cho tài khoản vận hành hiện tại, logon Interactive, quyền Limited. Chạy ẩn, không yêu cầu giữ Codex hay terminal mở. Task có chính sách thử lại khi lỗi, không giới hạn thời gian chạy, không tạo nhiều bản trùng.
- `server-host.ps1`: mutex theo thư mục dự án, giám sát Node supervisor và chạy lại nếu supervisor thoát lỗi.
- `server-supervisor.mjs`: kiểm tra web/API mỗi 15 giây, timeout từng probe 5 giây, phục hồi khi worker chết hoặc ba vòng health không đạt; có backoff tối đa 30 giây. Chỉ dừng các child do nó tạo. Nếu cổng đã bị chương trình khác giữ, báo `port-conflict`, không giết chương trình đó.
- Frontend có IPC guard để tự thoát khi supervisor mất; API đóng kết nối và PostgreSQL có kiểm soát. Windows dùng `pg_ctl -m fast -w` thay vì thư viện taskkill cưỡng bức. `fast` cho phép PostgreSQL rollback giao dịch đang dở và checkpoint trước khi dừng.
- Log API/web/supervisor: `data/operations/logs`, mỗi tệp khoảng 5 MB rồi xoay ba bản cũ. PostgreSQL collector ghi theo ngày trong tuần và tái dùng file, mặc định 7 ngày. Lỗi lặp nhanh có thể tăng dung lượng trong một ngày; vẫn cần theo dõi ổ đĩa.
- Quyền NTFS của `.env`, `data`, `backups` giới hạn tài khoản vận hành, SYSTEM và Administrators. Không có secret trong task arguments.
- Các lệnh điều khiển/sao lưu nạp module Security từ chính `$PSHOME`, tránh nạp nhầm module PowerShell 7 khi npm gọi Windows PowerShell 5.1. Đã kiểm tra lại sao lưu và khôi phục sau sửa lỗi này.

Task chỉ khởi động sau khi đăng nhập Windows, không chạy trước đăng nhập. Máy tắt, ngủ, đóng nắp theo chế độ ngủ hoặc mất điện sẽ không phục vụ. Cấu hình hiện tại khi cắm sạc không ngủ do idle; chế độ pin vẫn có thể ngủ. Không thay chính sách nguồn hay tự reboot máy.

## Lệnh vận hành

Mở PowerShell tại thư mục dự án:

```powershell
npm run server:status
npm run server:stop
npm run server:start
npm run server:restart
```

`Stop` chờ backup đang chạy kết thúc, dừng frontend/API và database thuộc bản quản lý. Dữ liệu không bị xóa. `Start` bỏ cờ dừng để cho phép tự chạy ở lần đăng nhập sau. Khi Stop, cờ `data/operations/disabled` giữ máy chủ dừng có chủ đích kể cả task khởi động lại; dùng Start để mở lại.

Không dùng `npm start` đồng thời với task. Cập nhật mã nguồn: `server:backup`, `server:verify-backup`, `server:stop`, build/typecheck/test phù hợp, rồi `server:start`. Nếu test cần PostgreSQL trong thời gian dừng, mở môi trường DB riêng; không trỏ kiểm thử phá hủy vào eplab.

Cài lại sau chuyển đường dẫn: `npm run server:install`. Script ưu tiên scheduled task; nếu Windows không cho đăng ký, tạo shortcut trong Startup của cùng user và thông báo rõ. Gỡ tự chạy, giữ dữ liệu: `powershell -File scripts/server-control.ps1 -Action Uninstall`.

## Backup tự động và bộ khóa chuyển máy

Supervisor tạo backup khi healthy và quá 24 giờ từ bản thành công gần nhất, chạy bù sau thời gian offline. Lỗi backup được ghi vào `backup-status.json`, thử lại sau một giờ. Không đặt task lúc 02:00 cố định. Giữ 14 bản `.eplab` + checksum trong `backups`; chưa có bản sao ngoài ổ hiện tại.

```powershell
npm run server:backup
npm run server:verify-backup
npm run server:export-recovery
```

Backup AES-256-GCM/scrypt chứa DB, học liệu riêng, bài nộp và trao đổi. Mật khẩu backup tự động là chuỗi ngẫu nhiên được DPAPI bảo vệ; chỉ cùng Windows user/máy mới giải mã được trực tiếp. Script không in mật khẩu và không đưa vào task arguments. Khóa không được lưu cùng source ZIP.

`ExportRecovery` hỏi mật khẩu riêng tối thiểu 16 ký tự do người vận hành chọn và tạo `backups/ep-lab-recovery-*.eplabkeys`. Bộ khóa chứa `.env` nguồn và mật khẩu backup đã được mã hóa; lưu nó cùng archive trên ổ an toàn khác, giữ mật khẩu nơi riêng. Chưa xuất bộ khóa thật thay người dùng vì cần họ tự giữ mật khẩu.

Trên máy khôi phục:

```powershell
npx tsx scripts/recovery-kit.ts --restore 'D:\private\ep-lab-recovery.eplabkeys' 'D:\private\eplab-recovered-keys'
```

Thư mục đích phải chưa tồn tại. Sau khi giải mã, `.env.source` và `backup-password.txt` là bí mật: bảo vệ ACL, không đưa lên web/Git. Điều chỉnh DB/path/URL cho máy mới nhưng giữ `SECRET_KEY` cũ nếu cần dùng MFA cũ. Làm tiếp quy trình database trống, restore và đối soát trong OPERATIONS.md.

`VerifyBackup` phục hồi archive tự động gần nhất vào database tạm riêng, đối chiếu bản ghi/tệp, thử sai mật khẩu/chỉnh sửa archive, kiểm tra thu hồi phiên. Sau kiểm tra, database tạm được xóa; thư mục test nằm trong data riêng. Không ghi đè eplab. Giới hạn snapshot 512 MB giải nén/tài liệu 128 MB vẫn áp dụng.

## Kiểm tra lỗi

- `healthy`: web và API/DB trả lời đúng; `recovering`: đang phục hồi; `port-conflict`: có listener khác; `stopped`: dừng có chủ đích.
- Xem cả thời gian `updatedAt`/`lastHealthyAt`, không dùng một file status cũ làm bằng chứng server còn chạy. `server:status` còn gọi health thật.
- Nếu backup lỗi, kiểm tra dung lượng/ACL/DPAPI và log riêng. Không tắt bảo trì tùy tiện khi còn một bản backup đang lấy dữ liệu.
- Nếu cổng bận, kiểm tra đúng process và thư mục, không giết toàn bộ node/postgres trên máy.
- Khi nâng cấp lớn: dừng ghi, sao lưu, kiểm tra restore, rồi mới thay bản chạy.

Đã thử lỗi frontend, API, supervisor và ngắt PostgreSQL; báo cáo `docs/reports/server-check.json`. Không thử reboot toàn bộ Windows hoặc mất điện vật lý; không có cam kết uptime 24/7.

Tham khảo cơ chế dừng có kiểm soát: [tài liệu pg_ctl của PostgreSQL](https://www.postgresql.org/docs/18/app-pg-ctl.html).


## Cập nhật cổng công khai 17/11/2026

Kiểm tra HTTPS sau phát hành phát hiện mỗi asset tải qua ngrok lại gọi `/api/auth/me` từ loopback, khiến nhiều trang liên tiếp chạm quota và trả 503. Worker hiện gộp các probe đồng thời và dùng lại kết quả probe API trong 1 giây; marker bật/tắt, cấu hình public/proxy/origin và trạng thái dừng vẫn kiểm tra ở mỗi yêu cầu. Không thay hạn mức API/đăng nhập. Kiểm thử 200 yêu cầu đồng thời chỉ tạo một probe, làm mới khi hết hạn và đóng truy cập khi probe lỗi.
