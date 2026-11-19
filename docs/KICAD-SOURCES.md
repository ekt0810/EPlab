# Nguồn video KiCad: Phil’s Lab

Cập nhật theo yêu cầu chủ EP LAB ngày 15/11/2026. “Phili Lab” được xác định là kênh **Phil’s Lab** qua [website tác giả](https://www.phils-lab.net/) liên kết đến [YouTube @PhilsLab](https://www.youtube.com/@PhilsLab).

| Bài trong EP LAB | Video gốc | Phần mềm / ngôn ngữ |
| --- | --- | --- |
| Phần 1: Sơ đồ nguyên lý | [Phil’s Lab #165](https://www.youtube.com/watch?v=O-zNn5k5Bn4), phát hành 28/10/2025 | KiCad 9, TI MSPM0; tiếng Anh |
| Phần 2: Thiết kế PCB | [Phil’s Lab #166](https://www.youtube.com/watch?v=igQWdVGZGpI), phát hành 28/11/2025 | KiCad 9, TI MSPM0; tiếng Anh |

Hai video được đối chiếu metadata/oEmbed về đúng kênh và kiểm tra phát bằng trình duyệt. Đây là nguồn công khai nhúng từ tác giả; không tải lên lại, không đổi thương hiệu và không nhập khóa thương mại từ website của tác giả. Nội dung ghi chú/bài tập tiếng Việt do EP LAB tự viết. Không khẳng định có phụ đề tiếng Việt.

Hai bài nằm ở phần học thử; cả admin và khách đều xem được. Quyền admin đối với các bài khác giữ nguyên. Chưa bổ sung video cho những chủ đề lộ trình đang biên soạn.

## Dữ liệu và cập nhật

Seed của bản cài mới dùng dữ liệu tại `apps/api/src/content/phils-lab-kicad.ts`. Trên bản cài cũ đã có hai video DigiKey, chạy khi DB local đang hoạt động:

```powershell
npx tsx scripts/use-phils-lab.ts
npm run verify:videos -- --category=kicad
npx tsx scripts/kicad-source-check.ts
```

Lệnh chuyển nguồn chỉ tác động hai bài KiCad ban đầu và mô tả khóa, có transaction, audit và bản lưu trước thay đổi trong `data/content-history/`. Giữ nguyên ID, slug, tiến độ và ghi chú; vì vậy URL cũ vẫn hoạt động dù tên bài đã đổi. Nếu nguồn bị thay thành URL khác ngoài hai bộ đã biết, script dừng để tránh ghi đè học liệu tùy chỉnh. Chạy lại sau cập nhật trả `updated: 0`.

Không có migration sửa schema. Không dùng seed để ghi đè khóa học đang có. `video-check` đánh dấu lại trạng thái nhúng theo kết quả hiện tại; khi không phát được chuyển về liên kết nguồn.

## Báo cáo

- [Xác minh nguồn và trạng thái phát](reports/video-check-kicad.json)
- [Trang bài học trên desktop và mobile](reports/kicad-source-check.json)

Các báo cáo video ghi thời điểm kiểm tra riêng. Khả năng phát sau này phụ thuộc tác giả/YouTube và kết nối Internet của người xem.

## Thư viện của app KiCad riêng

Bản tích hợp ngày 15/11/2026 còn có 43 nguồn video Phil’s Lab được giữ từ `videos.json` của app KiCad cũ, với bộ lọc và mốc chương tại `/kicad/video`. Các video này mở tại nguồn gốc. Kiểm thử mới xác nhận tìm kiếm/link/mốc chương, không xác nhận đã phát lại đủ 43 video. Xem [phạm vi tích hợp](KICAD-INTEGRATION.md).
