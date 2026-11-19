# API EP LAB

Frontend gọi `/api` cùng origin. API dùng cookie `ep_session` HttpOnly, SameSite=Lax; Secure khi APP_URL là HTTPS. GET `/api/auth/me` trả CSRF token của phiên; mọi thao tác có phiên phải gửi `x-csrf-token`. Các request thay đổi dữ liệu phải có Origin đúng APP_URL. Webhook chưa cấu hình luôn 503.

Lỗi trả `{ "error": "..." }`; 400 đầu vào, 401 chưa đăng nhập, 403 không có quyền/CSRF, 404 không tìm thấy/tài nguyên khác người, 409 xung đột, 429 giới hạn tốc độ, 503 bảo trì/chưa cấu hình. Request body strict schema, không cho thêm role/user_id/amount ở những endpoint không nhận chúng.

## Công khai

| Method / URL | Kết quả |
| --- | --- |
| GET /api/health | Trạng thái kết nối DB và bảo trì |
| GET /api/courses | Khóa đã xuất bản; admin đã xác thực xem thêm khóa nháp. Số bài đã xuất bản/học thử |
| GET /api/previews | Metadata sáu bài học thử |
| GET /api/courses/:slug | Đề cương không chứa video riêng/content/đáp án; khóa nháp chỉ admin đã xác thực |
| GET /api/lessons/:slug | Preview miễn phí; học viên cần entitlement cho bài đã xuất bản; admin đã xác thực xem mọi bài/video kể cả nháp, không kiểm tra thanh toán |
| GET /api/billing | Giá, trạng thái sẵn sàng, email hỗ trợ; không lộ secret |

## Xác thực

| Method / URL | Body / mục đích |
| --- | --- |
| GET /api/auth/me | Thông tin an toàn của phiên, CSRF, chế độ mail/local |
| POST /api/auth/register | name, email, password; hồ sơ chưa kích hoạt |
| POST /api/auth/verify | token một lần xác minh email |
| POST /api/auth/resend | email; gửi lại xác minh với phản hồi không xác nhận email có tồn tại |
| POST /api/auth/login | email, password; tạo phiên, báo MFA nếu có |
| POST /api/auth/logout | Thu hồi phiên hiện tại |
| POST /api/auth/forgot | email; gửi token khôi phục |
| POST /api/auth/reset | token, password; thu hồi token và tất cả phiên |
| POST /api/auth/password | current, password; đổi và thu hồi tất cả phiên |
| PATCH /api/auth/profile | name; không cho tự đổi role hoặc quyền học |
| GET /api/auth/sessions | Các phiên của chính người dùng |
| DELETE /api/auth/sessions/:id | Chỉ xóa phiên do người dùng sở hữu |
| POST /api/auth/reauth | password, code MFA nếu có; quyền xác thực lại 5 phút |
| POST /api/auth/mfa/setup | password; trả QR/secret một lần để người dùng thêm vào authenticator |
| POST /api/auth/mfa/enable | code; trả tám mã phục hồi chỉ một lần |
| POST /api/auth/mfa/verify | code TOTP hoặc mã phục hồi; chống dùng lại |

Mật khẩu đăng ký/reset dài 12–128 ký tự, được băm Argon2id. Token xác minh/reset sống 30 phút, trong DB chỉ lưu SHA-256. MFA secret được mã hóa AES-GCM trên server; mã phục hồi được băm. Đổi email admin dùng CLI cục bộ, vẫn giữ nguyên hai slot.

## Học tập và đơn hàng

| Method / URL | Quyền / body |
| --- | --- |
| GET /api/lessons/:slug/answer | Phiên hợp lệ và quyền với bài/cả khóa |
| GET /api/files/:id | Quyền học; trả attachment, no-store, nosniff |
| GET /api/files/:id/view | Cùng kiểm tra quyền với tải tệp; chỉ PDF, Content-Disposition inline, no-store; loại khác trả 415 |
| PUT /api/progress/:slug | completed, note; quyền học và chủ sở hữu là phiên hiện tại |
| GET /api/progress | Chỉ tiến độ/ghi chú của chính mình |
| POST /api/orders | Body rỗng; server đặt giá, user, ngân hàng snapshot và mã riêng |
| GET /api/orders | Đơn của chính mình |
| GET /api/orders/:id | Không xem đơn của người khác |
| GET /api/orders/:id/qr | PNG data URL của payload QR đã kiểm tra, chỉ chủ đơn |
| POST /api/orders/:id/report | Chỉ ghi thời điểm báo chuyển, không cấp quyền |
| POST /api/orders/:id/cancel | Chỉ đơn pending chưa báo chuyển |

Một đơn pending/người dùng tại một thời điểm, có thời hạn 24 giờ. API từ chối đơn của admin hoặc người đã được kích hoạt. Giá/thông tin ngân hàng lưu theo snapshot; thay cấu hình không sửa đơn đã tạo.

## Quản trị

| Method / URL | Chức năng |
| --- | --- |
| GET /api/admin/overview | Số liệu thật, settings và bảo trì |
| GET /api/admin/users | Danh sách người dùng an toàn, tối đa 500 |
| PATCH /api/admin/users/:id | blocked; không khóa admin qua API học viên |
| GET /api/admin/orders | Tối đa 300 đơn gần nhất |
| POST /api/admin/orders/:id/approve | reference, amount, accountNumber, note, confirmed=true |
| POST /api/admin/orders/:id/refund | reference, note, confirmed=true; cần reauth; chỉ ghi nhận hoàn thực tế |
| PUT /api/admin/settings | price, bankName, accountNumber, accountHolder, enabled, supportEmail, qrPayload; cần reauth |
| GET /api/admin/audit | 200 nhật ký gần nhất |
| GET/POST /api/admin/courses | Liệt kê/tạo khóa |
| PUT/DELETE /api/admin/courses/:id | Cập nhật/xóa khóa rỗng |
| GET/POST /api/admin/chapters | Liệt kê/tạo chương |
| PUT/DELETE /api/admin/chapters/:id | Cập nhật/xóa chương rỗng |
| GET/POST /api/admin/lessons | Liệt kê/tạo bài |
| PUT/DELETE /api/admin/lessons/:id | Cập nhật/xóa bài; gỡ file trước khi xóa |
| GET/POST /api/admin/lessons/:id/resources | Liệt kê/upload một file qua multipart |
| DELETE /api/admin/resources/:id | Xóa metadata và file riêng |

Các schema cụ thể nằm trong `apps/api/src/admin.ts`, `auth.ts`, `payments.ts`; trường không khai báo bị từ chối. Nội dung văn bản được React escape, không render HTML tùy ý. Bài published phải có nội dung và quyền sử dụng xác định; video công khai không được đặt sau paywall.

Bài SOLIDWORKS không nhận `video_url` hoặc `video_type` khác `none`. Các phần giáo trình dùng chung `document_resource_id` và phạm vi `document_page_start`/`document_page_end`; đề cương công khai không lộ ID tài liệu. Bài học chỉ trả danh sách tài liệu sau khi kiểm tra quyền. Tải/mở PDF kiểm tra lại quyền trên bài sở hữu tệp và trạng thái khóa học ở từng request.

Duyệt đơn dùng transaction và khóa dòng order/user. Reference ngân hàng và order_id trong payment_transactions là unique. Request lặp cùng giao dịch trả duplicate, không nhân đôi doanh thu hoặc quyền học. Sai số tiền/tài khoản/trạng thái trả 409 để đối soát. Chưa có API chuyển tiền hoặc truy cập tài khoản Internet Banking.

## KiCad: giáo trình, giao bài và chấm thủ công

| Method / URL | Quyền / body |
| --- | --- |
| GET /api/kicad/catalog | Mục lục 8 chương/24 bài, quyền truy cập và tiến độ của phiên; không trả nội dung/đáp án |
| GET /api/kicad/library | 43 nguồn video công khai và mốc chương |
| GET /api/kicad/lessons/:slug | Cần quyền học; nội dung cấu trúc, câu hỏi và lựa chọn, bỏ đáp án/giải thích |
| POST /api/kicad/lessons/:slug/quiz | Cần quyền học; `answer` là index 0–3; server kiểm tra, trả correct/explanation và lưu tiến độ |
| GET /api/kicad/exercises | Metadata tóm tắt 12 bài, không trả bảng tiêu chí chi tiết |
| GET /api/kicad/exercises/:exercise | Cần quyền học; bài tập và bảng tiêu chí |
| GET /api/kicad/assignments | Bài giao cho chính mình hoặc cả lớp, số lần mình đã nộp |
| POST /api/kicad/submissions | Cần quyền học; multipart: exerciseId, notes, assignmentId tùy chọn, report JSON tùy chọn, 1–2 tệp ảnh |
| GET /api/kicad/submissions | 100 bài mới nhất của chính mình, không trả ảnh trong danh sách |
| GET /api/kicad/submissions/:id | Chủ bài/admin; nội dung, bảng tiêu chí khi nộp, kết quả và lịch sử chấm |
| GET /api/kicad/submissions/:id/images/:index | Chủ bài/admin; ảnh WebP inline, no-store; index từ 0 |
| GET /api/admin/kicad/submissions?page=1 | Admin; phân trang 30 bài |
| POST /api/admin/kicad/submissions/:id/review | Admin; revision, summary và 4 criteria với id/status/evidence/action; điểm do server tính từ tiêu chí |
| GET /api/admin/kicad/assignments | Admin; tối đa 100 lần giao gần nhất |
| POST /api/admin/kicad/assignments | Admin; exerciseId, studentId=null cho cả lớp, instructions, dueAt=null hoặc thời điểm ISO tương lai |
| PATCH /api/admin/kicad/assignments/:id | Admin; closed=true/false |

GET `/api/lessons/:slug` hiện có thêm `study` cho bài giáo trình KiCad sau khi kiểm tra quyền; đáp án/giải thích quiz cũng được loại bỏ. Câu hỏi được chấm tại server, việc đánh dấu hoàn thành thông thường không tạo kết quả quiz giả.

Gửi bài cần notes dài 15–1500 ký tự. Mỗi ảnh tối đa 5 MB, chỉ PNG/JPEG/WebP tĩnh, 200×150 tối thiểu và 8 megapixel tối đa; ảnh được giải mã/mã hóa lại, bỏ metadata. Report tối đa 100 KB và phải đúng cấu trúc JSON báo cáo. Không nhận thêm trường ngoài schema, không nhận SVG hay ảnh không giải mã được. Bài gắn lần giao phải đúng bài tập/đúng người nhận và chưa đóng; hạn nộp không tự chặn bài muộn. Giới hạn 20 bài/giờ, 100 bài/tài khoản; tối đa hai tác vụ xử lý ảnh đồng thời.

Gửi trùng cùng nội dung trả lại bài cũ (200); bài mới là 201 và `pending_manual`. Chấm dùng transaction/khóa dòng, kiểm tra revision; xung đột trả 409. Lịch sử từng lần chấm và audit được lưu. Không nhận điểm do client tự khai, không có endpoint AI chấm lại. Trạng thái: pending_manual, needs_review, visual_pass, needs_revision. Chi tiết ở [tích hợp KiCad](KICAD-INTEGRATION.md).

Rate limit chung: 180 request/phút theo tài khoản đã xác thực; khách và các POST xác thực theo IP (IPv6 gom /64). Endpoint đăng nhập/đăng ký/khôi phục giữ hạn mức riêng nghiêm hơn cùng bộ đếm tài khoản trong DB. Lỗi kiểm tra phiên được hiển thị để người dùng thử lại, không bị coi nhầm là đã đăng xuất.

## Tích hợp nhà cung cấp ngân hàng sau này

`PaymentAdapter` trong `payments.ts` định nghĩa dữ liệu đã xác minh. Chọn nhà cung cấp trước, đọc tài liệu chính thức và xác minh raw bytes/chữ ký hoặc cơ chế tương đương đúng chuẩn của họ; thêm parser raw body cần thiết. Kiểm tra giao dịch ghi có, tài khoản nhận, số tiền, mã đơn, thời gian và event ID. Gọi cùng cơ chế transaction/idempotency với xác nhận thủ công, bổ sung test chữ ký sai, phát lại, gửi đồng thời và timeout/retry. Không đổi endpoint 503 thành chấp nhận JSON tự do.

## Các giới hạn cần biết

Các danh sách admin đang dùng giới hạn bản ghi nêu trên, cần bổ sung pagination trước khi vượt quy mô đó. Upload không có antivirus bên ngoài được tích hợp; không giải nén/thực thi, kiểm tra loại/nội dung và hạn mức. PDF có thêm đường dẫn mở trong trình duyệt, vẫn qua kiểm tra quyền. Private video/HLS chưa có. Adapter S3 và SMTP có cấu hình nhưng chưa kiểm chứng với dịch vụ thật do chưa có credential.

## Bài tập C nhúng và SOLIDWORKS

Đã mở rộng luồng giao/nộp/chấm theo môn tại `/api/embedded`, `/api/solidworks` và hai nhóm `/api/admin/embedded`, `/api/admin/solidworks`. Mỗi môn có 12 đề. Nộp bài mới có tệp nguồn riêng, tải bằng `/api/:track/submissions/:id/files/:index`; JSON chỉ trả metadata tệp. Các route KiCad cũ giữ nguyên. Xem schema, loại tệp, hạn mức và quy trình tại [Bài tập ba môn](COURSE-EXERCISES.md).

## Lộ trình và trao đổi riêng

API danh sách bài tập có `level`, `order`, `prerequisites`, `submitted`, `passed` (tiến độ của phiên hiện tại). Mỗi track có 12 bài, 4 bài/mức. API conversations dùng quyền người tham gia/chủ trì, chống gửi trùng và phân trang; xem [schema và quy tắc](PATHWAYS-AND-ROLES.md).


## Bài tập và tự kiểm tra (17/11/2026)

GET `/api/{embedded|kicad|solidworks}/exercises` trả `latest: {id,status} | null` của chính tài khoản hiện tại; `passed` vẫn là đã từng có bài đạt. Khách không nhận trạng thái/bài nộp của tài khoản khác.

POST `/api/{track}/submissions` nhận thêm trường multipart `selfChecks`: chuỗi JSON tối đa 16.000 ký tự, mảng tối đa 20 mục `{index,status,observed}`. `status` là `not_run`, `pass` hoặc `fail`; `observed` tối đa 600 ký tự, bắt buộc có nội dung khi đã kiểm tra. `index` là vị trí ca trong `exercise.checks`, không được trùng hay vượt phạm vi. Mặc định `[]` tương thích client cũ. Trường này không quyết định điểm; bài luôn bắt đầu ở `pending_manual`. Ca KiCad được đối chiếu từ tiêu chí hiện hành nếu đề chưa có kiểm tra riêng.

Bài nộp trả `self_checks` và snapshot `rubric.checks`; chỉ chủ bài/người chấm đọc được. API kiểm tra lại dữ liệu và đưa kết quả tự kiểm tra vào fingerprint chống nộp trùng.
