# EPlab

Không gian học kỹ thuật bằng tiếng Việt cho **lập trình nhúng C, KiCad và SOLIDWORKS**. Mỗi môn có lớp học, giáo trình PDF, video tham khảo, hỏi đáp và khu vực thực hành để giao/nộp bài, nhận xét và theo dõi tiến độ.

Frontend **Next.js / React / TypeScript**; API **Fastify**; dữ liệu **PostgreSQL**. Có giao diện sáng/tối, quản lý tài khoản và hai vị trí người chủ trì. Video được liên kết/nhúng từ nguồn gốc; repo không chứa bản sao video.

## Chạy local

Yêu cầu Node.js 24 và npm. Luồng PostgreSQL portable và Task Scheduler dành cho Windows; cấu hình Docker nằm trong `compose.yaml`.

```powershell
npm ci
npm run setup
npm run dev
```

Lần đầu, `setup` hỏi hai email quản trị, sinh mật khẩu database và secret ngẫu nhiên trong `.env`, rồi tạo dữ liệu học. Khi server đã chạy, mở terminal thứ hai và chạy `npm run admin:setup` để đặt mật khẩu quản trị. Không có mật khẩu dùng chung.

Website: <http://127.0.0.1:3100>. API: `127.0.0.1:4100`; PostgreSQL portable: `127.0.0.1:55432`. Dữ liệu của bản cài nằm trong `data/` và bị loại khỏi Git.

```powershell
npm run build
npm start
```

Dừng bản dev trước khi chạy bản build vì hai chế độ dùng cùng cổng. Để cài tự khởi động trên Windows sau khi build, chạy `npm run server:install`; các lệnh điều khiển là `server:status`, `server:start`, `server:stop`, `server:restart`.

## AI tùy chọn và bí mật

Hỏi đáp theo giáo trình hoạt động khi chưa cấu hình nhà cung cấp AI. Để dùng AI, tự điền ba biến sau vào `.env` riêng trên server:

```dotenv
EP_CLASSROOM_AI_BASE_URL=
EP_CLASSROOM_AI_MODEL=
EP_CLASSROOM_AI_KEY=
```

API cần tương thích OpenAI Chat Completions; base URL kết thúc bằng `/v1`. Các giá trị thực không được cung cấp trong repo. Khóa chỉ được đọc ở API phía server, không đặt vào `NEXT_PUBLIC_*`, mã trình duyệt, README, ảnh, log, issue hoặc commit. SMTP, S3, ngrok và database cũng phải dùng cấu hình riêng; xem `.env.example` và [SECURITY.md](SECURITY.md).

Repo có workflow Gitleaks quét lịch sử commit. Giữ `.env`, `data/`, `backups/`, `work/` và output build ngoài Git; không dùng `git add -f` với các đường dẫn này.

## Kiểm tra

```powershell
npm run typecheck
npm run build
npm test
npm run test:classroom
npm run test:browser
```

Các kiểm thử tích hợp cần PostgreSQL local cùng `DATABASE_URL` và `LOCAL_PG_PASSWORD` trong `.env`. Chúng tạo database/thư mục thử riêng rồi dọn, không reset database đang dùng. Kiểm thử trình duyệt cần Microsoft Edge hoặc điều chỉnh cấu hình Playwright theo hệ điều hành.

## Mã nguồn và học liệu

| Thư mục | Nội dung |
| --- | --- |
| `apps/web/` | Giao diện, giao diện tối/sáng, lớp học và thực hành |
| `apps/api/src/` | Xác thực, học liệu, hỏi đáp, bài tập và quản trị |
| `apps/api/migrations/` | Migration PostgreSQL |
| `apps/api/assets/` | Giáo trình PDF dùng khi khởi tạo dữ liệu |
| `scripts/` | Thiết lập, vận hành, backup và kiểm tra |
| `tests/` | Kiểm thử ứng dụng |
| `infra/` | Docker và reverse proxy |
| `docs/` | API, học liệu và hướng dẫn vận hành |

Xem [lớp học](docs/CLASSROOM.md), [luồng thực hành](docs/PRACTICE-WORKFLOW.md), [API](docs/API.md) và [vận hành Windows](docs/WINDOWS-SERVER.md). Một số tài liệu ghi lại lịch sử phát triển; các địa chỉ liên hệ và đường dẫn cài đặt trong bản công khai là thông tin mẫu.

## Bản công khai

Đây là snapshot mã nguồn đã làm sạch, không bao gồm tài khoản, phiên đăng nhập, bài nộp, backup, thông tin thanh toán hoặc cấu hình dịch vụ của bản đang vận hành. Email cá nhân trong mẫu cấu hình và giáo trình người chủ trì đã được thay bằng địa chỉ mẫu; nội dung môn học được giữ lại.

Migration lịch sử `009_student_phone.sql` đã bỏ thông tin liên hệ riêng. Với database cũ có checksum migration, cần đối chiếu và lập kế hoạch nâng cấp trước khi dùng snapshot này; không chép đè lên một bản cài đang chạy. PDF người chủ trì đã cập nhật checksum tương ứng.
