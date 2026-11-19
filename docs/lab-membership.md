# Tham gia Lab miễn phí

Từ 17/11/2026, học viên đăng ký tài khoản, xác minh email, bổ sung số điện thoại rồi gửi mục tiêu học tập tại `/tham-gia-lab`. Không thu phí 150.000đ. Các bài miễn phí và thông tin cuộc thi vẫn công khai. Đường dẫn cũ `/kich-hoat` chuyển sang trang tham gia Lab.

Trong Quản trị → Tham gia Lab, hai admin xem yêu cầu, số điện thoại và mục tiêu; chọn Duyệt hoặc Chưa duyệt, kèm phản hồi. Khi duyệt, tài khoản học các nội dung người tham gia đã xuất bản ở cả ba môn, nộp bài và trao đổi. Danh sách môn quan tâm chỉ phục vụ hỗ trợ, không giới hạn quyền học. Người học bấm Kiểm tra trạng thái mới nhất để cập nhật; tải lại hoặc đăng nhập lại cũng lấy quyền mới. Không gửi email tự động khi duyệt.

Admin có thể thu hồi quyền Lab với lý do. Yêu cầu đã bị từ chối/thu hồi có thể gửi lại. Tài khoản bị khóa hoặc chưa xác minh không được duyệt. Tài liệu nội bộ chủ trì/bản nháp không cấp cho học viên. Quyền học trước đây được giữ; thu hồi quyền Lab không xóa quyền đã có từ trước.

`lab_memberships` lưu trạng thái, môn quan tâm, mục tiêu, phản hồi, người duyệt, phiên bản và thời gian. `learning_access` tổng hợp quyền cũ trong `entitlements` và quyền Lab được duyệt. Không đổi mật khẩu, vai trò, dữ liệu học tập, đơn hay giao dịch trước đây. Nhật ký `lab.requested/approved/rejected/revoked` xuất hiện trong lịch sử tài khoản. Bảng Lab nằm trong sao lưu mã hóa và kiểm thử phục hồi.

API ghi yêu cầu đăng nhập, email xác minh, số điện thoại và kiểm tra Origin/CSRF. Chỉ admin được duyệt; các lần cập nhật đồng thời kiểm tra revision và khóa hàng trong giao dịch. Người dùng chỉ đọc yêu cầu của chính mình. Gửi lại khi đang pending không tạo bản trùng. Mọi quyền học được tính lại tại backend mỗi request; thu hồi có hiệu lực với phiên đang đăng nhập.

Chế độ production `settings.access_mode = "lab"` vô hiệu hóa tạo đơn, mã QR, báo chuyển tiền và duyệt thanh toán mới; `/api/billing` chỉ công bố phí 0, ready=false và thông tin hỗ trợ. API cấu hình thu phí không thể bật lại qua web. Mã xử lý lịch sử thanh toán được giữ để tương thích dữ liệu cũ; kiểm thử hồi quy lịch sử dùng chế độ paid chỉ trong database test riêng. Không tự bật lại paid trong production.

Các migration 010–012 bổ sung bảng, view và thay đúng đoạn giới thiệu C về phí bằng thông tin tham gia Lab. Không chỉnh sửa migration đã áp dụng. Khi chuyển máy chủ, dùng backup mới đã chứa dữ liệu Lab và ba migration này; không khôi phục đè database học viên đang sử dụng.
