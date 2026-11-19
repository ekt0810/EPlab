# Tối ưu phần thực hành — 17/11/2026

Áp dụng cùng một luồng cho 36 bài: C nhúng, KiCad và SOLIDWORKS.

- Danh sách gợi ý việc tiếp theo: bài cần sửa/bổ sung bằng chứng được ưu tiên, sau đó bài chưa nộp đã có nền tảng, rồi bài đang chờ chấm. Bài chuẩn bị chỉ là gợi ý, không khóa quyền mở bài.
- Tìm theo mã, tên hoặc mô tả; lọc mức độ, chương và trạng thái bài nộp gần nhất. Thành tích từng đạt vẫn giữ trong tiến độ mức độ dù bản nộp mới đang chờ xem.
- Một trang làm bài gồm đọc đề/ôn trong lớp học, làm/tự kiểm tra, nộp/nhận góp ý. Các ca kiểm tra và bảng tiêu chí thu gọn để giảm độ dài trên điện thoại.
- C/SOLIDWORKS dùng ca kiểm tra sẵn trong đề; KiCad đối chiếu tiêu chí gốc của từng bài. Người học chọn chưa kiểm tra/đúng như mong đợi/còn vướng và ghi quan sát thực tế.
- Kết quả tự báo cáo lưu cùng snapshot đề tại thời điểm nộp, hiện ở cả người học và người chấm. Có thể nộp ca chưa đạt; không tự chấm điểm hoặc khẳng định CAD/mạch/mã nguồn đúng.
- Ghi chú và tự kiểm tra lưu nháp trong localStorage theo tài khoản + môn + bài + lần giao. Chỉ xóa sau khi gửi thành công; tệp/ảnh không được lưu nháp, cần chọn lại sau tải lại. Nháp trên thiết bị này không đồng bộ đa máy.

Migration 015 thêm `submissions.self_checks` JSONB, mặc định rỗng cho bài cũ. API giới hạn độ dài, từ chối chỉ số ca sai/trùng, trạng thái giả và ca đã chạy nhưng thiếu quan sát; nội dung tự kiểm tra tham gia fingerprint chống nộp trùng. Phân quyền cũ giữ nguyên.

Sao lưu bổ sung classroom_progress, classroom_messages và khôi phục đúng identity sequence; kiểm chứng bằng fixture có ghi chú riêng, nguồn trả lời và kết quả tự kiểm tra.

Thiết kế ưu tiên nhiệm vụ rõ ràng, ví dụ/giáo trình kề bài làm và phản hồi cụ thể. Tham khảo [IES: Organizing Instruction and Study to Improve Student Learning](https://ies.ed.gov/ncee/wwc/PracticeGuide/1); đây là lựa chọn thiết kế, không phải kết quả đo hiệu quả học của EP LAB.


Đã phát hành 17/11/2026. Kết quả kiểm chứng và phạm vi: [Báo cáo phát hành](RELEASE-2026-11-17.md).
