# Vận hành EP LAB

## 1. Phạm vi đang chạy

Máy Windows 11 hiện tại: Ryzen 7 6800HS, khoảng 16 GB RAM, Node 24.16.0. PostgreSQL portable nằm trong thư mục riêng. Đã cài Task Scheduler **EP LAB Local Server** dưới tài khoản hiện tại (Interactive, Limited), tự chạy khi đăng nhập Windows. Không mở firewall/router. Frontend/API/DB chạy trên loopback. Chi tiết: [WINDOWS-SERVER.md](WINDOWS-SERVER.md).

- Web: `http://127.0.0.1:3100`
- API health: `http://127.0.0.1:4100/api/health`
- PostgreSQL: `127.0.0.1:55432`, database `eplab`, app role `eplab` không phải superuser.
- Database kiểm thử: `eplab_test`, không dùng cho dữ liệu thật.

Trên bản hiện tại dùng `npm run server:start/stop/restart/status`. Task phục vụ bản Next production; supervisor kiểm tra sức khỏe và chạy lại tiến trình lỗi. Không chạy hai bản cùng cổng. Để phát triển hoặc build lại: dừng task, dùng `npm run dev` hoặc build, sau đó mở lại task. `scripts/start-local.ps1` nhận diện bản cài task và gọi Start.

Đã bật tự chạy **khi tài khoản Windows đăng nhập**, không phải service trước màn hình đăng nhập. Chưa reboot cả Windows trong phiên kiểm thử. Khi cắm sạc máy hiện đặt idle sleep=0; không thay cấu hình nguồn. Pin, đóng nắp, sleep/shutdown và mất điện vẫn có thể dừng phục vụ.

## 2. Secret và dữ liệu

Giữ kín `.env`, `SECRET_KEY`, `LOCAL_PG_PASSWORD`, mật khẩu DB, SMTP, mã MFA và thư local. Không lưu các giá trị này vào biến `NEXT_PUBLIC_*`. Không chép thư mục `data` vào public hoặc chia sẻ chung. Bản source ZIP không chứa secret, DB, outbox hoặc backup.

`SECRET_KEY` dùng mã hóa secret MFA. Khi chuyển máy phải mang key cũ qua kênh an toàn; thay key tùy tiện sẽ khiến MFA đang tồn tại không giải mã được. Mật khẩu tài khoản chỉ được lưu dạng Argon2id. Script admin nhập mật khẩu qua terminal che ký tự.

File mode 0600 được đặt khi ghi secret; trên Windows quyền truy cập thực tế do ACL NTFS quyết định. Giữ dự án và backup trong thư mục riêng của tài khoản vận hành, kiểm tra ACL trước khi chia sẻ máy hoặc thư mục.

Giáo trình SOLIDWORKS gốc nằm tại `apps/api/assets/solidworks-textbook.pdf`, ngoài web public. Khi cài đặt, PDF được đưa vào kho riêng và gắn với bài học. Backup/restore mang cả tệp, liên kết bài học và phạm vi trang; không cần nhập lại hoặc thu phí lại sau chuyển server. Migration `003_lesson_documents.sql` hoãn kiểm tra khóa ngoại tài liệu đến cuối transaction để phục hồi được vòng tham chiếu bài học/tệp.

## 3. Docker Compose

Docker chưa có trên máy hiện tại nên chưa chạy daemon/build/restart container để kiểm chứng. Chỉ dùng các bước sau sau khi đã cài Docker phù hợp; không tự reboot hoặc đổi cấu hình bảo mật Windows.

Tạo `.env` từ mẫu, thêm:

```dotenv
DB_ADMIN_PASSWORD=<mat-khau-hex-ngau-nhien-cho-postgres>
DB_PASSWORD=<mat-khau-hex-ngau-nhien-rieng-cho-app>
SECRET_KEY=<64-ky-tu-hex>
APP_URL=http://127.0.0.1:8080
PUBLIC_MODE=false
MAIL_MODE=local
ADMIN_1_EMAIL=admin1@example.com
ADMIN_2_EMAIL=admin2@example.com
```

Hai mật khẩu DB nên là chuỗi hex đủ dài để an toàn trong URL kết nối. Database dùng superuser riêng để khởi tạo, ứng dụng dùng role `eplab` không có quyền tạo role/database hoặc superuser. `infra/init-db.sh` chỉ chạy lần đầu trên volume trống; thay biến môi trường không tự đổi mật khẩu trong volume cũ.

```powershell
docker compose build
docker compose up -d db
docker compose run --rm api node apps/api/dist/migrate.js
docker compose run --rm api node apps/api/dist/seed.js
docker compose run --rm api npm run bank:configure
docker compose run --rm api npx tsx scripts/admin.ts
docker compose up -d api web proxy
docker compose ps
docker compose logs --tail 100 api web proxy
```

Mở `http://127.0.0.1:8080`. Chỉ Caddy xuất cổng loopback; DB/API/web nằm trong mạng nội bộ. `docker compose restart` không xóa volume. Không chạy `down -v` khi muốn giữ dữ liệu.

Mạng Compose dùng subnet `172.30.84.0/24`, trùng với allowlist `TRUST_PROXY` của API. Nếu subnet xung đột với mạng máy, đổi đồng thời cả hai. Không đổi thành tin tưởng mọi IP; Caddy phải kiểm soát forwarded headers. API giới hạn chung theo tài khoản đã xác thực; khách/các POST xác thực theo IP, cùng bộ đếm đăng nhập theo tài khoản lưu trong PostgreSQL. Xem hạn mức tại [API](API.md).

## 4. Sao lưu nhỏ và vừa

Khi server/DB đang chạy:

```powershell
npm run backup
```

Nhập mật khẩu backup tối thiểu 16 ký tự. Script bật bảo trì ngắn hạn, giữ khóa chia sẻ các bảng trong transaction REPEATABLE READ, đọc bản nhất quán của DB và các file được tham chiếu, tính SHA-256, nén và mã hóa AES-256-GCM với key dẫn xuất bằng scrypt. Cuối cùng trả trạng thái bảo trì về trước đó.

File `.eplab` và checksum `.sha256` nằm trong `backups/`. Mặc định giữ 14 bản (`BACKUP_RETAIN`). `BACKUP_DESTINATION` có thể trỏ đến ổ rời/thư mục đồng bộ do chủ máy cung cấp; script sao chép và đối chiếu checksum. Chưa có đích ngoài máy nên chưa tạo bản sao ngoài máy. Backup cùng ổ không bảo vệ khi mất/hỏng ổ.

Backup đã bao gồm sáu bảng KiCad: giáo trình cấu trúc, bài tập, kết quả quiz, bài được giao, bài nộp và lịch sử chấm. Ảnh bài nộp là dữ liệu riêng trong PostgreSQL; chúng nằm trong snapshot DB đã mã hóa. Khi chuyển server phải mang đầy đủ các bảng này, không chỉ sao chép thư mục file. Đã kiểm tra đối chiếu toàn bộ dòng, ảnh và lịch sử sau restore.

Giới hạn của công cụ hiện tại: đọc tối đa 128 MB tài liệu vào bộ nhớ; file restore giải nén tối đa 512 MB. Khi dữ liệu lớn hơn, dùng quy trình `pg_dump` và sao lưu object storage/volume ở dưới. Backup mã hóa vẫn chứa dữ liệu cá nhân; quản lý mật khẩu riêng và thử khôi phục định kỳ.

Đã cấu hình backup tự động mỗi 24 giờ tính từ bản thành công gần nhất, chạy bù khi server khỏe trở lại. Mật khẩu ngẫu nhiên được bảo vệ bằng DPAPI trong `data/operations/backup-key.dpapi`, không nằm trong task arguments. Dùng `npm run server:backup` để chạy ngay, `npm run server:verify-backup` để thử khôi phục, `npm run server:export-recovery` để xuất bộ khóa mã hóa bằng mật khẩu riêng. Mặc định vẫn chỉ lưu cùng ổ; cần chủ máy chọn đích ngoài máy.

## 5. Phục hồi an toàn

Chuẩn bị database **trống** và thư mục file **riêng**; không phục hồi đè lên nơi đang chạy. Role kết nối phải có quyền tạo bảng trong database đích.

```powershell
$env:RESTORE_DATABASE_URL = 'postgresql://eplab:<mat-khau>@127.0.0.1:55432/eplab_restored'
$env:RESTORE_DATA_DIR = 'D:\EP-LAB-restored\data'
npm run restore -- 'D:\backup\eplab-<thoi-gian>.eplab'
```

Database đích phải được tạo trước bằng công cụ quản trị PostgreSQL phù hợp. Trong Docker có thể dùng `docker compose exec db psql -U postgres -c 'CREATE DATABASE eplab_restored OWNER eplab;'`. Bộ portable hiện có `pg_ctl` để khởi động/dừng chuẩn; chưa có `pg_dump/psql`. Backup ứng dụng không cần hai công cụ đó.

Script đối chiếu checksum archive, xác thực GCM, kiểm tra migration checksum, từ chối database có dữ liệu, nhập các bảng theo khóa ngoại, khôi phục tệp, đặt lại sequence và đối chiếu checksum. Phiên đăng nhập/token một lần bị thu hồi có chủ đích. Tài khoản, mật khẩu băm, MFA, đơn hàng và entitlement được giữ; mang `SECRET_KEY` cũ để dùng lại MFA.

Sau phục hồi hệ thống vẫn ở chế độ bảo trì. Trỏ `DATABASE_URL` và `DATA_DIR` đến đích đã kiểm tra; chạy `npm run maintenance -- off` khi sẵn sàng. Người học đăng nhập lại, không đóng tiền lại. Mật khẩu backup không được nhúng trong file source hoặc `.env.example`.

## 6. Dữ liệu lớn với pg_dump

Trong môi trường đã có công cụ PostgreSQL đúng major version:

1. Bật `npm run maintenance -- on`, dừng API để chặn cả request đang dở.
2. Giữ DB chạy; tạo dump định dạng custom bằng `pg_dump`, đồng thời sao lưu volume file hoặc object storage tương ứng.
3. Tính checksum và mã hóa dump/file bằng công cụ mã hóa tiêu chuẩn mà người vận hành đã cài và quản lý key.
4. Thử `pg_restore` vào database trống, kiểm tra số bản ghi và SHA-256 tệp, rồi mới xoay vòng backup cũ.
5. Bật API và tắt bảo trì trên máy nguồn nếu chưa chuyển server.

Trên Windows tránh ghi dump nhị phân qua pipeline văn bản của PowerShell cũ. Có thể dùng `pg_dump -f <file>` hoặc dump trong container rồi `docker compose cp` file ra host.

## 7. Chuyển server

Chuẩn bị máy mới với cùng mã nguồn/migration và phiên bản PostgreSQL tương thích. Không sao chép thư mục data vật lý giữa các major PostgreSQL khác nhau; dùng backup logic/restore.

1. Cài dependency hoặc build Docker trên máy mới, tạo DB/file trống.
2. Bật bảo trì máy cũ, dừng nhận ghi và tạo backup cuối nhất quán.
3. Chuyển backup đã mã hóa và secret qua kênh riêng. Không đặt key giải mã cạnh backup công khai.
4. Restore máy mới, kiểm tra tài khoản, học liệu, quyền học, tổng giao dịch, file tải và cấu hình SMTP/bank; giữ thanh toán thật tắt trong lúc kiểm tra.
5. Cập nhật `APP_URL`, routing/CORS/CSRF, reverse proxy, cookie HTTPS và cấu hình tunnel/DNS. Các đường dẫn API và tệp không hardcode IP máy cũ.
6. Chuyển traffic tới máy mới sau khi đã kiểm tra. Máy cũ tiếp tục ngừng ghi để tránh hai DB độc lập nhận đơn.
7. Có kế hoạch rollback: khi máy mới đã nhận ghi, không đơn giản trỏ về snapshot cũ; phải bảo toàn/đối soát những thay đổi sau chuyển đổi trước.

## 8. Công khai qua HTTPS hoặc tunnel

Chỉ thực hiện khi chủ website yêu cầu công khai. Cần tên miền, SMTP thật, mật khẩu riêng và MFA cho cả hai admin, chính sách đã duyệt, backup ngoài máy, monitoring và kiểm tra thanh toán. `PUBLIC_MODE=true` yêu cầu HTTPS/SMTP và kiểm tra MFA tại các hành động admin.

[Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/) có thể nối outbound từ host tới tên miền, giúp tránh mở cổng vào/router và public IP tại nhà. Token tunnel chỉ lưu trên server. Tunnel chỉ chuyển tiếp; host vẫn phải chạy, có điện và mạng. Kiểm tra điều kiện dịch vụ và băng thông khi dùng nội dung dung lượng lớn; không mặc định mọi lưu lượng video đều phù hợp mọi gói.

Nếu chuyển VPS, dùng reverse proxy với TLS và firewall chỉ mở cổng cần thiết. `infra/Caddyfile.public.example` là mẫu, chưa được áp dụng. Chỉ xuất cổng 80/443 khi đã có yêu cầu triển khai thật; không công khai cổng DB/API, thư mục data, thư local hoặc trang debug.

## 9. Theo dõi và nâng cấp

Theo dõi `/api/health`, log lỗi đã lọc secret, dung lượng DB/file, CPU/RAM, số kết nối và dung lượng backup. Không log password, cookie, token reset, MFA secret hoặc toàn bộ payload ngân hàng.

Trước nâng cấp: backup, đọc release notes từ nguồn chính thức, kiểm thử migration trên bản sao, build/typecheck/test, kiểm tra login/payment/files. Dependency hiện được khóa version và lockfile; `npm audit` không thay thế kiểm toán bảo mật độc lập. Không khẳng định website an toàn tuyệt đối.

## 10. Bản tích hợp KiCad

Máy hiện tại dùng source/runtime ở `C:/path/to/EPlab`. Thư mục dự án Codex mới chỉ có hướng dẫn trỏ tới bản này; chưa di chuyển DB hoặc secret sang OneDrive.

Với bản cài đã có, chạy `npx tsx scripts/use-kicad-practice.ts` khi PostgreSQL đang hoạt động, build rồi khởi động lại app. Lệnh tự áp dụng migration 004 và nhập học liệu một lần; giữ nguyên quyền học, thanh toán, admin và giáo trình SOLIDWORKS. Xem [chi tiết tích hợp](KICAD-INTEGRATION.md).

## 11. Bài tập C và SOLIDWORKS

Chạy `npx tsx scripts/use-course-practice.ts` trên bản cài có sẵn: migration 005 thêm attachments vào submissions và script nhập 16 đề một lần. Backup lưu cả bytes/hash của tệp trong DB, không cần sao chép một thư mục file mới. Snapshot ứng dụng vượt 512 MB sẽ bị từ chối trước khi mã hóa; dùng pg_dump khi vượt quy mô này. Xem [hướng dẫn bài tập](COURSE-EXERCISES.md).

## 12. Lộ trình nâng cao và hỏi đáp

Chạy `npx tsx scripts/use-practice-pathways.ts` trên bản cài có sẵn, build rồi khởi động lại local. Migration 006 thêm hai bảng trao đổi. Backup/restore bao gồm nội dung trao đổi và đặt lại sequence tin nhắn. Mã vai trò student/admin không đổi; tên hiển thị là người tham gia/người chủ trì. Xem [chi tiết](PATHWAYS-AND-ROLES.md).
