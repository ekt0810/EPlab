# SOLIDWORKS — giáo trình EP LAB

Theo yêu cầu chủ website: SOLIDWORKS học bằng giáo trình; chủ EP LAB trực tiếp giảng dạy. Website không có khung video, liên kết video hoặc thời lượng video cho phần này. Không tự ấn định lịch học.

## Tài liệu

- Tệp cung cấp: `Giao_trinh_SOLIDWORKS_EP_Lab_Co_logo.pdf`.
- 74 trang; phiên bản EP Lab 2.1, tháng 11/2026, thao tác tham chiếu SOLIDWORKS 2022.
- Dung lượng: 4.689.920 byte.
- SHA-256: `418dff9a6eb9dd640cad39f0316208a52b292822b549028baca13891c446e767`.
- Giữ nguyên logo, nội dung và nguồn trích dẫn trong PDF. Đây là tài liệu do chủ website cung cấp; các nguồn gốc được ghi trong giáo trình, không quy toàn bộ hình nguồn cho EP LAB.

## Nội dung trên website

Hai mục giới thiệu cách học và chuẩn bị phần mềm là văn bản công khai. Bản đầy đủ và sáu mục dưới đây dành cho học viên đã kích hoạt cùng hai admin miễn phí.

| Mục | Trang PDF |
| --- | --- |
| Giáo trình đầy đủ | 1–74 |
| Sketch: lệnh, ràng buộc và bài thực hành | 4–22 |
| Part và Extrude | 23–33 |
| Revolve, Chamfer, Fillet và H4 | 34–45 |
| Hình học tham chiếu và chi tiết nghiêng | 46–55 |
| Sweep, Loft | 56–65 |
| Assembly, Drawing, đồ án và tra cứu | 66–74 |

Trang học có **Mở giáo trình**, **Tải PDF**, ghi chú riêng và đánh dấu hoàn thành. Mở giáo trình chuyển sang tab trình đọc PDF của trình duyệt với `#page=` tương ứng; một số trình đọc trên điện thoại có thể bỏ qua số trang, khi đó chọn trang đã ghi trên bài học. Không tải riêng hoặc sửa nội dung từng chương.

## Cài đặt / cập nhật

Bản mới: chạy setup như README; seed nạp cả ba lĩnh vực, SOLIDWORKS dùng tài liệu này.

Bản đã cài, khi PostgreSQL đang chạy:

```powershell
npx tsx scripts/use-solidworks-textbook.ts
```

Script tự chạy migration rồi chuyển nội dung trong transaction. Dữ liệu cũ được chụp lại tại `data/content-history/solidworks-before-textbook-*.json`; giữ ID, slug và tiến độ. Lần chạy tiếp theo không ghi đè chỉnh sửa của giảng viên. Đây không phải cơ chế thay mọi PDF mới: nếu đổi giáo trình khác, cần cập nhật asset, hash, phạm vi trang và quy trình chuyển bản có kiểm chứng.

File dùng chung nằm ngoài thư mục public. API kiểm tra quyền ở mỗi lần mở/tải; ID ngẫu nhiên không thay thế kiểm tra quyền. Ẩn khóa học, khóa tài khoản hoặc thu hồi quyền chặn các request tiếp theo. File đã tải hợp lệ không thể bị thu hồi khỏi máy người học.

## Kiểm chứng

- Typecheck/build đạt; bộ kiểm thử hiện tại sau tích hợp KiCad đạt 41/41 backend tests và 25/25 luồng Edge, gồm các tình huống SOLIDWORKS dưới đây.
- Admin và học viên mở/tải đúng SHA-256 bản gốc; khách/chưa kích hoạt không truy cập được cả URL trực tiếp.
- Trình đọc Edge hiển thị bìa và tổng 74 trang; giao diện bài học ở 1440px/390px không có video hoặc tràn ngang.
- Chạy lại script không thay nội dung; backup/restore giữ tệp, liên kết và phạm vi trang.
- DB chính vẫn chỉ hai admin, không có đơn/học viên/giao dịch giả. Thu phí chưa được bật. Chỉ chạy localhost.

Xem [kiểm chứng chung](VERIFICATION.md), [báo cáo trình duyệt](reports/browser-check.json), [backup/restore](reports/backup-check.json).

## Bài tập có nộp file

Hiện có 12 đề từ cơ bản đến nâng cao tại `/solidworks/thuc-hanh`, gắn các phần giáo trình bên trên. Người học nộp file thiết kế và ảnh, hai admin tự chấm. Xem [bộ bài tập và định dạng nộp](COURSE-EXERCISES.md). Không thêm video hoặc sửa PDF.
