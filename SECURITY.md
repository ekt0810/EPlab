# Bảo vệ thông tin bí mật

- Chỉ `.env.example` với giá trị mẫu được phép commit. Cấu hình thật ở `.env` hoặc kho secret của môi trường triển khai.
- Khóa `EP_CLASSROOM_AI_KEY` chỉ dùng phía API. Không thêm tiền tố `NEXT_PUBLIC_`, đưa vào component React hoặc truyền cho trình duyệt.
- Không commit database, cookie/session, thư xác minh, upload của người dùng, backup, log, ảnh thanh toán hoặc thư mục build. `.gitignore` và `.dockerignore` đã loại các đường dẫn này.
- Hạn chế quyền, đặt giới hạn chi phí và luân chuyển khóa AI theo chính sách của nhà cung cấp.
- Gitleaks chạy trên push và pull request. Quét mã nguồn/lịch sử trước khi push; việc không tìm thấy secret không phải bảo đảm an toàn tuyệt đối.
- Nếu lộ khóa, thu hồi/đổi khóa ngay. Xóa dòng trong commit mới không xóa khóa khỏi lịch sử Git.

Không đưa khóa hay dữ liệu người dùng vào issue công khai. Nếu cần báo lỗi bảo mật, dùng chức năng **Report a vulnerability** của repository khi khả dụng.
