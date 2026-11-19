# Tích hợp app KiCad vào EP LAB

Ngày cập nhật: 15/11/2026. Nguồn là dự án KiCad của chủ website tại `C:/path/to/EPlab`. Nội dung được lấy từ `server/content/curriculum.js`, `exercises.js` và `videos.json`; giao diện và backend được tích hợp vào hệ thống xác thực/phân quyền hiện tại của EP LAB.

## Những phần đã tích hợp

| Nội dung/chức năng nguồn | Trong EP LAB |
| --- | --- |
| 8 chương, 24 bài học tiếng Việt | `/kicad/giao-trinh`; khái niệm, bước thực hành, lỗi thường gặp, tài liệu tham khảo |
| Câu hỏi tự kiểm tra | Chấm đáp án tại server, lưu số lần thử và lần đã đạt; không thay điểm bài thực hành |
| Ghi chú và tiến độ | Dùng hệ thống ghi chú/tiến độ riêng của mỗi tài khoản EP LAB |
| 43 nguồn Phil’s Lab | `/kicad/video`; tìm kiếm, lọc và mở nguồn gốc tại mốc chương |
| 12 bài thực hành | `/kicad/thuc-hanh`; mục tiêu, bước làm, bằng chứng cần nộp và 4 tiêu chí/bài |
| Ảnh và báo cáo ERC/DRC | Nộp 1–2 ảnh PNG/JPEG/WebP, ghi chú và JSON ERC/DRC tùy chọn |
| Giáo viên đánh giá | `/quan-tri/kicad`; hai admin tự chọn kết quả, viết nhận xét và hướng sửa |
| Giao bài | Giao từng học viên hoặc cả lớp, hướng dẫn riêng, hạn nộp, đóng/mở nhận bài |
| Theo dõi bài làm | `/kicad/bai-duoc-giao`, `/kicad/bai-nop`; trạng thái, điểm và lịch sử chấm |

Chỉ chuyển nội dung học và các chức năng phù hợp. Tài khoản, cơ sở dữ liệu, giá/phương thức thanh toán cũ, secret và mã AI của app nguồn không được nhập sang. EP LAB vẫn có đúng hai admin miễn phí, mức kích hoạt 150.000đ và ngân hàng TPBank đã cấu hình. SOLIDWORKS tiếp tục dùng PDF của chủ website, không có video.

Thư viện 43 video giữ metadata/mốc chương từ nguồn cũ; đợt tích hợp kiểm tra tìm kiếm và URL/mốc chương trên giao diện, không kiểm tra phát lại đủ cả 43 video. Hai video KiCad 9 #165/#166 nhúng ở phần học thử đã được kiểm tra phát riêng; xem [báo cáo nguồn](KICAD-SOURCES.md). Video thư viện mở tại kênh tác giả, không được tải lại hoặc coi là nội dung độc quyền.

## Cách giao và chấm bài

1. Admin đăng nhập, mở **Quản trị → Giao bài và chấm bài KiCad → Giao bài**.
2. Chọn bài trong 12 bài thực hành; chọn một học viên hoặc cả lớp; nhập yêu cầu và hạn nộp nếu cần.
3. Người học vào **Bài được giao**, mở bài và nộp ảnh rõ nét cùng ghi chú. Có thể thêm JSON ERC/DRC. Bài lưu ở trạng thái **Chờ giảng viên chấm**.
4. Admin mở tab **Chấm bài**, xem ảnh/báo cáo; với mỗi tiêu chí chọn **Đạt**, **Cần sửa** hoặc **Chưa đủ bằng chứng**, nhập nhận xét và hướng sửa. Nhập nhận xét chung rồi lưu.
5. Học viên xem kết quả ở **Bài nộp của tôi** và có thể nộp bản sửa. Mỗi lần chấm lưu người chấm/thời gian/nội dung; hai admin cùng sửa một phiên bản thì người lưu sau phải tải lại để tránh ghi đè.

Mỗi bài có bốn tiêu chí 25 điểm. Server cộng điểm theo lựa chọn của giảng viên; đạt từ 75/100 và không còn tiêu chí thiếu bằng chứng. **Con người quyết định từng tiêu chí; không có AI đánh giá ảnh hay tự kết luận đạt bài.** Quiz tự kiểm tra là chức năng học tập riêng.

Hạn nộp hiện là mốc nhắc trên giao diện; hệ thống vẫn nhận bài muộn nếu admin chưa đóng bài. Đóng bài sẽ chặn các lần nộp mới gắn với lần giao đó. Bài tự luyện không gắn lần giao vẫn độc lập. Không tự trừ điểm nộp muộn.

ERC/DRC là báo cáo do người học cung cấp; server đọc JSON để đếm lỗi/cảnh báo, không chạy KiCad CLI hoặc đối chiếu với file thiết kế. Giảng viên kiểm tra tính đúng đắn, kết nối điện, chức năng và điều kiện chế tạo riêng trên thiết kế/phần cứng.

## Dữ liệu và quyền truy cập

- Migration `004_kicad_practice.sql`: sáu bảng `kicad_lessons`, `exercises`, `quiz_results`, `assignments`, `submissions`, `submission_reviews`.
- Bài học mới có slug `kicad-l01` đến `kicad-l24`; 12 bài thực hành có ID `e01` đến `e12`. Giữ nguyên các ID/slug và tiến độ của EP LAB trước tích hợp.
- Giáo trình chi tiết, bài thực hành và quiz cần quyền học hoặc admin; mục lục tóm tắt và thư viện nguồn công khai. Đáp án quiz không gửi kèm bài học.
- Bài nộp/ảnh chỉ chủ bài hoặc admin đọc được. Bài cũ của chính người học vẫn đọc được sau khi hết quyền học; tài khoản bị khóa không thể xác thực.
- Mỗi ảnh tối đa 5 MB, tối thiểu 200×150, tối đa 8 megapixel. Backend giải mã, bỏ metadata và mã hóa lại WebP tối đa 1600×1600; ảnh động/SVG không nhận. Báo cáo JSON tối đa 100 KB.
- Giới hạn hiện tại: 20 bài nộp/giờ, 100 bài/tài khoản; tối đa hai tác vụ xử lý ảnh đồng thời. Gửi trùng cùng nội dung trả lại bài đã có. Trang admin chấm bài phân trang 30 bản ghi.
- Ảnh được lưu riêng trong PostgreSQL, tải qua API kiểm tra quyền; không nằm trong public. Backup/restore đã bao gồm ảnh, bài được giao, bài nộp và lịch sử chấm.

## Cài đặt, cập nhật và bảo trì học liệu

`npm run setup`/seed trên bản mới tự nạp nội dung. Trên bản đã cài, khi DB đang chạy:

```powershell
npx tsx scripts/use-kicad-practice.ts
```

Lệnh chạy migration rồi nhập trong transaction, khóa chống chạy đồng thời, ghi dấu `kicad_practice_v1` và audit. Lần đầu thêm 8 chương/24 bài/12 bài tập; lần sau không ghi đè dữ liệu. Không bật thu phí và không thay mật khẩu admin.

Nguồn nội dung cấu trúc nằm tại `apps/api/src/practice/curriculum.json`, nguồn video tại `videos.json`. Nội dung đang dùng được lưu trong DB. Sửa JSON sau khi đã nhập không tự cập nhật DB: cần migration nội dung có phiên bản khi giảng viên muốn thay bộ giáo trình/quiz/tiêu chí. Trình sửa bài chung hiện chỉnh metadata/văn bản cơ bản; chưa có trình biên tập trực quan riêng cho toàn bộ cấu trúc giáo trình và ngân hàng quiz. Bảng tiêu chí được chụp tại lúc nộp để thay đổi bài tập sau này không đổi cách hiểu bài đã nộp.

Xem [cách tự kiểm thử](USER-TESTING.md), [API](API.md) và [kết quả kiểm chứng](VERIFICATION.md).
