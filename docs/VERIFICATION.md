# Kiểm chứng EP LAB

## Lần kiểm chứng mới nhất — 17/11/2026

Đã sửa bộ kiểm thử và tài liệu để khớp luồng đăng ký miễn phí → xác minh email → gửi yêu cầu tham gia Lab → admin duyệt. Lần này không sửa mã chức năng website, không build lại bản production, không restart, publish, deploy hoặc push.

| Hạng mục | Kết quả thực chạy |
| --- | --- |
| TypeScript và định dạng | `npm run typecheck` đạt cho API/scripts và frontend; Prettier đạt cho 10 file TypeScript đã sửa/tạo. |
| API/cấu hình | `npm test`: **84/84**, không bỏ qua; gồm 55 kiểm thử hồi quy chế độ thanh toán cũ, 20 kiểm thử Lab hiện tại và 9 kiểm thử Internet/ngrok. |
| Trình duyệt | `npm run test:browser`: **28 nhóm đạt**, Microsoft Edge/Playwright, desktop và mobile 390px; `pageErrors` rỗng. |
| Lab miễn phí | Đăng ký có số điện thoại, email xác minh dùng một lần, gửi/duyệt yêu cầu và cấp quyền cả ba môn; không tạo đơn thanh toán. Kiểm tra thu hồi quyền chặn lại bài và URL PDF đã biết. |
| Nội dung và bài tập | 7 bài thử; giáo trình người tham gia v5, checksum PDF, 12 chương và phân quyền tài liệu chủ trì. KiCad/C/SOLIDWORKS: giao bài, nộp ảnh/file C/STEP, tải đúng bytes, chấm thủ công, nhận xét và trao đổi giữ sau refresh. |
| Backup/restore | `npm run test:backup` đạt trên dữ liệu tổng hợp riêng: 7 tài nguyên, 2 file bài nộp, quyền học, đơn lịch sử, bài giao/chấm và trao đổi. Đối chiếu dữ liệu/hash; từ chối mật khẩu sai và archive bị sửa; thu hồi session sau restore. |
| Dọn môi trường | Mỗi bộ tạo database/runtime tạm riêng, đúng owner; không phụ thuộc `eplab_test` cũ. Không còn database của lần kiểm thử sau khi kết thúc. |
| Bản đang chạy | Trang chủ và `/api/health` qua localhost:3100 và HTTPS ngrok đều HTTP 200. Database chính vẫn ở chế độ `lab`, giữ 5 tài khoản, 1 đơn và 1 quyền học như trước kiểm thử. |

Bằng chứng của lượt chạy: `test-results/browser-check.json` (28 nhóm đạt, 08:18 UTC ngày 17/11), `test-results/backup-check.json` (08:17 UTC), ảnh trong `test-results/` và log tại workspace `work/web-fixes-20261117/`.

Phạm vi: chức năng và phân quyền được kiểm tra bằng dữ liệu giả trên PostgreSQL thật; thư xác minh lưu local. Không thử gửi SMTP thật, chuyển tiền, kiểm thử tải lớn hoặc diễn tập dừng/phục hồi production trong lượt này.

## Hồ sơ kiểm chứng trước đó — 15/11/2026

Các số lượng, đường dẫn, chế độ thu phí và mô tả triển khai dưới đây là lịch sử tại thời điểm kiểm chứng cũ; xem mục 17/11 ở trên cho trạng thái mới nhất.

Thực hiện trên Windows 11 của chủ dự án. Đây là kiểm thử local, không phải chứng nhận kiểm toán bảo mật hay cam kết uptime.

## Đã chạy thực tế

| Hạng mục | Kết quả |
| --- | --- |
| TypeScript | `npm run typecheck` đạt cho API, scripts và frontend. |
| Build | `npm run build` đạt: API TypeScript và Next.js production. |
| Máy chủ Windows | Task Scheduler AtLogOn/Interactive/Limited chạy ẩn; kiểm thử dừng frontend/API/supervisor/PostgreSQL, tự phục hồi trong 22,13-46,25 giây. Không thay đổi digest 18 bảng nghiệp vụ. |
| Backup tự động | Đã tạo lại sau khi đánh dấu bản trước quá hạn 24 giờ; DPAPI bảo vệ mật khẩu. Archive DB chính thực tế được restore vào DB tạm, đối chiếu dữ liệu/tệp, từ chối sai mật khẩu và archive bị sửa. |
| Giáo trình PDF | Hai bản 54/160 trang; đủ 36 mã bài, chữ chìm EP lab trên 214/214 trang. Bản người tham gia kèm nguyên 74 trang SOLIDWORKS; đã render và rà soát bố cục, kiểm tra giữ nội dung nguồn. |
| Migration/seed | PostgreSQL 18 thật; migration có checksum/transaction; seed lặp giữ dữ liệu. |
| Backend | `npm test`: **42/42** đạt, gồm 41 kiểm thử con và bài tổng; bổ sung cookie Secure/HttpOnly, Origin và bắt buộc MFA admin trong public mode. |
| Chuẩn bị Internet | **5/5** kiểm thử cấu hình, SMTP từ chối hạ cấp TLS, không lộ lỗi chứa credential và ghi `.env` an toàn. `internet:check` chạy trên DB thật, báo đúng chưa có URL HTTPS, SMTP và MFA. Chưa mở tunnel hoặc kiểm thử truy cập từ Internet. |
| Ngrok | Đã cài bản Microsoft Store 3.39.11; **4/4** kiểm thử tên miền free/token, kiểm tra config bằng ngrok thật (không kết nối), IP forwarding chống giả mạo, gateway chặn khi chưa public và chuyển đúng API/web/body/cookie. Chưa có token thật nên chưa kiểm thử tunnel hoặc tự phục hồi ngrok trên Internet. |
| Sao lưu qua npm/Windows | Sửa lỗi nạp nhầm module Security của PowerShell 7 vào Windows PowerShell 5.1. `server:backup` và `server:verify-backup` đạt; main DB vẫn 2 admin, không có đơn/bài nộp giả. |
| Trình duyệt | Microsoft Edge qua Playwright: **25/25** luồng đạt, không lỗi JavaScript; DB `eplab_test` riêng. |
| Production | `npx tsx scripts/smoke-check.ts`: logo, ba khóa, tìm kiếm đổi query cùng trang, sáu bài thử và mobile 390px; không tràn ngang hoặc lỗi JavaScript. |
| Video | **4/4 video còn dùng** trả trạng thái đang phát `state:1` trong trình duyệt thật; metadata tác giả đối chiếu bằng oEmbed. |
| Nguồn KiCad mới | Thay hai nguồn DigiKey bằng Phil’s Lab #165/#166 (KiCad 9). Hai video phát trực tiếp trong trang bài học ở 1440px và 390px, đúng tác giả/URL, không lỗi JavaScript hoặc tràn ngang. Chạy lại script chuyển nguồn không đổi thêm dữ liệu. |
| SOLIDWORKS | PDF nguyên gốc 74 trang mở/tải được, SHA-256 trùng. Hai admin/học viên có quyền, khách/chưa kích hoạt bị chặn cả URL trực tiếp. Không có khung video; giao diện 1440px và 390px đã xem thực tế. |
| QR | Payload/CRC16 đúng; BIN 970423, TPBank 51699468888, NGUYEN KIM TRUNG. QR gốc không có số tiền/mã đơn. Không thực hiện giao dịch ngân hàng. |
| KiCad tích hợp | 24 bài/8 chương, 12 bài tập, 43 nguồn video/mốc chương. Admin giao bài → học viên nộp ảnh/JSON → admin chấm 75/100 → học viên đọc nhận xét sau refresh. Giao diện desktop/mobile đã xem trực tiếp qua ảnh kiểm thử. |
| C và SOLIDWORKS | 12 đề/môn, kiến thức và ca tự kiểm tra, nộp file nguồn riêng, tải đúng bytes, giao/chấm thủ công và nhận xét bền vững. Desktop/390px đã kiểm tra; không có lỗi JavaScript. |
| Lộ trình và giao tiếp | 12 bài/môn, 4 bài/mức. Người tham gia gửi câu hỏi, người chủ trì trả lời, giải đáp/mở lại; lịch sử giữ sau refresh. Kiểm tra desktop/mobile và HTML chỉ hiển thị như văn bản. |
| Khởi động lại | Dừng runtime local rồi chạy lại production. Digest mọi bản ghi ở 18 bảng nghiệp vụ giữ nguyên, gồm sáu bảng KiCad mới. |
| Backup/restore | Giải mã và khôi phục vào DB/thư mục riêng thành công. So sánh hash mật khẩu, toàn bộ quyền học/đơn/giao dịch/tiến độ/nội dung, bài được giao, ảnh và tệp nguồn bài nộp, lịch sử chấm, cuộc trao đổi/tin nhắn (kể cả sequence sau phục hồi) và SHA-256 ba tệp (gồm PDF SOLIDWORKS). Giữ độ chính xác microsecond của timestamp PostgreSQL. Sai mật khẩu và ciphertext bị sửa đều bị từ chối. |
| Dependency | `npm audit --json`: **0** lỗ hổng được npm advisory báo tại thời điểm chạy. Không thay thế đánh giá bảo mật độc lập. |
| Secret frontend | Quét 11 file build public và HTML trang chủ, không thấy các secret server thực tế trong `.env`. |

Logo trong public trùng nguyên ảnh gốc, SHA-256: `FF2688395571BB00FE30D2B604ACD09EF77C96DD609FD132DE9004651471B697`.

## Các tình huống đã thử

- Khách và hồ sơ chưa kích hoạt không lấy bài trả phí/nháp, đáp án hoặc API quản trị.
- Request chèn `role`, sửa giá/user ID của đơn, ghi từ origin khác hoặc sai CSRF bị từ chối.
- Đúng hai slot admin; DB chặn admin thứ ba. Bootstrap lặp không đổi mật khẩu; admin học miễn phí không qua giao dịch giả.
- Cả hai admin mở được các bài học miễn phí, trả đúng nguồn video; khi chưa có đơn/entitlement vẫn xem được khóa/bài nháp và đáp án. Khách/học viên không thấy khóa nháp. Phiên admin đang chờ MFA vẫn bị chặn. Trình duyệt xác minh mục lục khóa nháp, nhãn miễn phí và nút xem từ quản trị.
- Token email một lần; reset mật khẩu thu hồi phiên. MFA secret mã hóa; mã phục hồi dùng lại bị từ chối.
- Đơn lấy giá 150.000 VND từ backend; tạo đồng thời chỉ một pending. Người khác không đọc đơn/QR.
- Báo chuyển và webhook giả không mở quyền. Sai tiền/tài khoản giữ đơn để đối soát. Duyệt đồng thời chỉ tạo một giao dịch và một quyền học.
- Ghi chú riêng giữ sau refresh và cách ly giữa người dùng. Khóa tài khoản/hoàn tiền thu hồi quyền và phiên.
- Tệp riêng tải qua backend; EXE bị từ chối, C hợp lệ được nhận. Ẩn khóa học cũng chặn đáp án, tiến độ và tài liệu.
- Cấu hình ngân hàng cần xác thực lại; thao tác quan trọng ghi audit; bảo trì chặn request ghi.
- Quiz KiCad không lộ đáp án trong dữ liệu bài học, tính kết quả phía server, giữ ghi chú và kết quả đã đạt. Seed chạy lại không nhân đôi 24 bài/12 bài tập.
- Giao bài cá nhân/cả lớp, kiểm tra đúng người nhận/đúng bài, đóng/mở nhận bài. Ảnh/bài nộp cách ly theo chủ sở hữu; tài khoản khác không lấy được qua URL trực tiếp.
- SVG, ảnh quá dung lượng, quá số ảnh, báo cáo sai cấu trúc và trường thừa bị từ chối. Nộp trùng đồng thời chỉ sinh một bài chờ chấm.
- Chấm thủ công tính điểm theo tiêu chí; từ chối tự khai điểm, tiêu chí sai và vai trò học viên. Hai admin lưu đồng thời chỉ một phiên bản thành công, bên còn lại nhận 409; lịch sử chấm được giữ. Không có API AI chấm lại.

- C/SOLIDWORKS mỗi môn 12 đề với kiến thức, bước làm, ca tự kiểm tra và rubric; liên kết SOLIDWORKS tới bài giáo trình đã xuất bản. Nhập lại không tạo trùng.
- Nhận mã C và file CAD/STEP theo môn; chặn tệp thiếu, sai loại, tên trùng, quá dung lượng/số lượng. Download chỉ chủ bài/admin và giữ đúng bytes; JSON không chứa base64 tệp. Đây là kiểm thử truyền file/kiểm tra định dạng, không phải kiểm định CAD hoặc chạy lời giải C.
- Giao bài, đọc bài/file, chấm, đóng nhận bài đều cách ly theo môn; API môn khác không dùng được ID bài. Nộp bản sửa giữ bài cũ. Kiểm thử quyền/mã trạng thái và review đều dùng DB riêng.

- Cả ba lộ trình có 4 cơ bản/4 trung cấp/4 nâng cao, gợi ý bài chuẩn bị và tiến độ riêng. Seed lặp không đổi dữ liệu.
- Trao đổi chỉ chủ cuộc và người chủ trì được đọc; sai môn/sai người bị chặn. Retry đồng thời cùng clientId chỉ tạo một tin, thay nội dung cùng mã bị từ chối. Chủ trì giải đáp, người tham gia mở lại; lịch sử hơn 50 tin phân trang không mất/trùng.

## Đo local có giới hạn

Máy: Ryzen 7 6800HS, RAM Windows nhìn thấy khoảng 15.3 GiB; Node 24.16.0, Next.js 16.4.6, PostgreSQL 18. Frontend/API/DB cùng máy, dữ liệu nhỏ, video phát từ nhà cung cấp gốc.

Luân phiên `/api/courses` và `/api/previews` qua reverse proxy của Next:

| Chỉ số | Kết quả |
| --- | --- |
| Yêu cầu / đồng thời tối đa | 40 / 4 |
| HTTP 200 | 40/40 |
| Thời gian cả đợt | 72 ms |
| p50 / p95 / lớn nhất | 6 / 9 / 9 ms |
| Working set cộng API/web/PostgreSQL và tiến trình con (lần đo trước tích hợp KiCad) | 354.3 MB |
| RAM máy còn trống lúc đo tài nguyên trước đó | Khoảng 2.05 GiB |

Working set có thể đếm trùng bộ nhớ dùng chung. Đây là smoke load ngắn, không đo Internet, tải lâu dài, upload đồng thời hoặc nhiều đăng nhập Argon2. Không suy ra số học viên đồng thời hay uptime từ kết quả này.

## Dữ liệu thật và phần cần cấu hình

- DB chính: hai admin **đã hoàn tất thiết lập mật khẩu**, ba khóa, 17 chương, 50 mục học/lộ trình; 24 bản ghi giáo trình KiCad và 36 bài thực hành (12 bài/môn). Không có học viên trả phí, đơn, bài nộp hoặc doanh thu giả. Không thay mật khẩu trong đợt dựng máy chủ.
- Sáu bài thử gồm bốn video C/KiCad và hai bài giới thiệu SOLIDWORKS bằng văn bản. SOLIDWORKS có thêm bảy mục giáo trình đã xuất bản (một bản đầy đủ và sáu phần); hai bài thực hành C/KiCad và 11 mục lộ trình còn ở nháp.
- Ngân hàng đã cấu hình; **nhận đơn đang tắt**. Cần duyệt/xuất bản nội dung trả phí, chính sách và email hỗ trợ trước khi bật.
- Đang chạy production ở `http://127.0.0.1:3100`; API 4100 và DB 55432 bind loopback. Chưa publish/push/deploy Internet.
- Máy chưa có Docker: có Dockerfile/Compose nhưng **chưa build/chạy/restart container thực tế**. Kiểm chứng restart ở trên là native Windows.
- SMTP chưa được cung cấp; xác minh/reset đã thử bằng outbox local, chưa gửi email Internet thật.
- Chưa tích hợp dịch vụ đối soát ngân hàng: duyệt thủ công hoạt động, adapter có interface, webhook đóng mặc định. Không có thanh toán/hoàn tiền thật.
- Đã cấu hình tự chạy khi đăng nhập Windows, giám sát và backup mỗi 24 giờ khi máy hoạt động. Chưa có service trước đăng nhập, domain/tunnel/TLS public hoặc đích backup ngoài máy. Chưa reboot cả Windows; không sửa firewall/router/chế độ nguồn.
- S3 chưa thử với bucket thật; upload video riêng/HLS không có trong bản này. Đã tích hợp học liệu/chức năng app KiCad riêng của chủ website; không nhập tài khoản, tiền hoặc secret của app cũ.
- Thư viện 43 nguồn giữ metadata từ app KiCad cũ, kiểm tra tìm kiếm/link/mốc chương; không ghi nhận đã phát thử cả 43 video trong đợt tích hợp. Báo cáo ERC/DRC do người học cung cấp, chưa có KiCad CLI chạy trên server hoặc kiểm tra chức năng mạch tự động.
- Chưa pentest độc lập, thử Safari/iOS thật hoặc quét antivirus file CAD. Kiểm tra định dạng không thay thế antivirus.

## Báo cáo gốc

- [Trình duyệt](reports/browser-check.json)
- [Bốn video C/KiCad](reports/video-check.json)
- [KiCad Phil’s Lab — phát trong trang bài học](reports/kicad-source-check.json)
- [Backup/restore](reports/backup-check.json)
- [Khởi động lại](reports/restart-check.json)
- [Máy chủ và bốn tình huống phục hồi](reports/server-check.json)
- [Khôi phục backup tự động DB chính](reports/automatic-backup-check.json)
- [Giáo trình PDF](reports/pdf-check.json)
- [Production và tải local](reports/production-check.json)
- [Tài nguyên máy](reports/resource-check.json)
- [Kiểm tra secret frontend](reports/secret-scan.json)

Chạy lại theo README. `npm test` reset riêng `eplab_test`; không đổi sang DB có dữ liệu cần giữ. Sau restore, phiên/token được thu hồi có chủ đích; quyền học và tài khoản được giữ, học viên không cần trả tiền lại.
