# Lớp học tương tác EP LAB - bàn giao 17/11/2026

Đã phát hành ngày 17/11/2026 tại https://lab.example.com theo yêu cầu người dùng. Database chính đã áp dụng migration 013/014/015; dữ liệu cũ đối chiếu trước/sau giữ nguyên. Không push Git.

## Nội dung và cách mở

| Môn | Đường dẫn | Bài | Học phần | PDF v6 |
| --- | --- | ---: | ---: | ---: |
| C nhúng | /nhung-c/lop-hoc | 32 | 8 | 70 trang |
| KiCad | /kicad/lop-hoc | 44 | 14 | 87 trang |
| SOLIDWORKS | /solidworks/lop-hoc | 24 | 8 | 56 trang |

Mỗi môn còn hai khu vực chính: **Lớp học** và **Thực hành**. Lớp học dùng duy nhất catalog giáo trình v6, gồm thông tin chuẩn bị thu gọn, lộ trình, trình đọc tương tác, hỏi đáp, video và PDF. Thực hành giữ bài tập, giao/nộp bài, chấm và trao đổi. C nhúng và SOLIDWORKS dẫn trực tiếp từ bài thực hành về bài tương ứng; KiCad liên kết theo chủ đề của bài thực hành.

Trang chọn môn, sáu bài học thử (hai bài mỗi môn) và tiến độ tài khoản đọc cùng dữ liệu lớp học. Không dùng số bài hoặc PDF v5 làm nội dung chính. Tài liệu người chủ trì nằm trong mục thu gọn riêng trong lớp học, chỉ tài khoản quản trị nhìn thấy.

Các URL môn học, `/tong-quan` và `/bai-hoc` chuyển đến `/lop-hoc`. `/tai-lieu`, `/kicad/video` và `/kicad/bai-hoc/video` chuyển đến lớp học với `?tab=resources`. Giữ từ khóa tìm kiếm khi chuyển hướng; đổi môn ở thư viện nguồn giữ cùng loại nội dung. Các URL bài chi tiết và PDF cũ vẫn tương thích để không làm hỏng dấu trang; không xóa dữ liệu, bài nộp hoặc tiến độ cũ. Tiến độ v6 được lưu riêng và không tự đánh dấu hoàn thành dựa vào bài cũ.

Trong lớp học, người học xem từng bước lý thuyết, ví dụ, thực hành, tự kiểm; ghi chú và kết quả lưu theo tài khoản. Bài hoàn thành cần qua câu hỏi và xác nhận đủ bước thực hành; sản phẩm thực tế được người chủ trì chấm qua phòng thực hành.

Bản xem thử cục bộ đã dừng sau khi phát hành. Tài khoản thử chỉ có hiệu lực khi mở lại preview; tệp truy cập nằm ở `work/classroom-preview/ACCESS.md`. Database thử riêng; dữ liệu bị xóa khi dừng. Chạy `npm run classroom:preview` để mở lại và `npm run classroom:preview:stop` để dừng. Các lệnh preview không dùng tài khoản học viên thật và không thay server công khai.

## Nguồn và phạm vi

- Tham khảo cấu trúc hoạt động lớp học của [OpenMAIC](https://github.com/THU-MAIC/OpenMAIC): bài học chia cảnh, tương tác và lưu tiến trình. Phần hỏi đáp đã được đơn giản hóa theo yêu cầu thành một luồng người học đặt câu hỏi. Đây là phần triển khai riêng trong kiến trúc EP LAB, không phải bản sao toàn bộ OpenMAIC.
- [Playlist C do người dùng chỉ định](https://www.youtube.com/playlist?list=PLGZ_RWetU5HK-l0JgVzEIa2PoBTayzsSk): 47 mục; 30 mục có metadata công khai được gắn vào bài; 17 mục chưa trả tiêu đề công khai được ghi riêng, không suy đoán nội dung.
- [Phil's Lab](https://www.youtube.com/@PhilsLab/videos): khảo sát 166 mục, giữ 95 nguồn (8 KiCad trực tiếp, 80 PCB/phần cứng chuyển giao, 7 bring-up/debug), loại 71 mục ngoài phạm vi. Cả 95 nguồn đều có bài liên quan. KiCad 9 theo #165/#166 là mốc thao tác chính; bản 6/7 được ghi nhãn. Kiến thức EDA khác được ghi rõ là kiến thức chuyển giao.
- SOLIDWORKS: nội dung gốc EP LAB và Help chính thức cho Part, Sketch, Assembly, Drawing, configurations, sheet metal, weldments, simulation và phối hợp cơ điện.

SOLIDWORKS đã bổ sung **27 video cho đủ 24 bài**: 6 tiếng Việt của Procad Solidworks và 21 tiếng Anh từ GoEngineer/các kênh liên quan, SolidProfessor, Hawk Ridge Systems, Too Tall Toby và Full Stack Products. Mỗi bài có hướng dẫn quan sát và bài làm thử bằng tiếng Việt. Mục Video mở sẵn khi vào bài SOLIDWORKS; video chỉ bắt đầu khi người học bấm mở. Thư viện nguồn có bộ lọc ngôn ngữ và liên kết về bài tương ứng. Chi tiết nguồn, phạm vi và kiểm chứng: [Video SOLIDWORKS](SOLIDWORKS-VIDEOS.md).

Quá trình khảo sát đối chiếu danh mục, tiêu đề, mô tả và chương công khai; không khẳng định đã xem từng phút hoặc chép toàn bộ lời giảng. Diễn giải, bài luyện, ví dụ, câu hỏi là học liệu EP LAB. Các mục thiếu nguồn được bổ sung bằng nội dung gốc và tài liệu kỹ thuật phù hợp. Watermark EP LAB có trên mọi trang; tác giả video, tài liệu và thương hiệu vẫn được ghi nhận. Không gán quyền sở hữu video cho EP LAB.

## Hỏi giáo trình

Người học chọn bài và đặt câu hỏi trong thẻ **Hỏi giáo trình**. Giao diện không còn chọn vai trò hay chế độ. API nhận duy nhất `question`; câu trả lời lấy từ các đoạn học liệu đã biên soạn, kèm tên bài, mục nguồn và tối đa hai video liên quan ngay bên dưới. Có thể tra cứu các bài khác trong cùng môn mà tài khoản được phép đọc. Đây là tra cứu theo từ khóa, chưa phải hệ thống hiểu mọi cách diễn đạt tự nhiên.

Không có đoạn khớp rõ: yêu cầu thêm khái niệm/thao tác và không đưa video ngẫu nhiên. Bài chưa có nguồn phù hợp vẫn có trạng thái báo rõ và tài liệu gốc; hiện cả 24 bài SOLIDWORKS đã có video. Video sử dụng ID/mốc chương có trong danh mục nguồn, hiển thị phạm vi tham khảo, ngôn ngữ/tác giả khi có metadata, nút mở tại chỗ và liên kết YouTube dự phòng. Không khẳng định mọi video là ví dụ đúng nguyên bài thực hành của EP LAB.

Câu trả lời và nguồn đính kèm được lưu riêng theo tài khoản bằng migration 014. Khi quyền học bị thu hồi, lịch sử có trích dẫn bài không còn được phép đọc cũng bị ẩn. Cột role cũ được giữ trong database để tương thích dữ liệu, không còn là lựa chọn người dùng hay tham số hỏi đáp.

Luồng này không cần khóa API và không gửi câu hỏi đến nhà cung cấp AI. Adapter trong `tutor.ts` được giữ để phát triển sau, đã kiểm thử bằng máy chủ giả lập; hiện không được gọi bởi giao diện hỏi đáp. Tính năng đọc bài vẫn dùng giọng tiếng Việt của trình duyệt nếu có.

## Tệp triển khai

- `apps/api/src/classroom/`: catalog, mô hình, tra cứu trong `answers.ts`, routes và JSON học liệu.
- `apps/api/src/classroom/data/solidworks-videos.json`: phần bổ sung trực tuyến gồm nguồn video và hướng dẫn quan sát theo bài; catalog hợp nhất khi nạp. Sinh lại JSON/PDF giáo trình không ghi đè phần bổ sung này; các PDF v6 giữ nội dung hiện có.
- `apps/api/migrations/013_interactive_classroom.sql`: tiến độ và hội thoại riêng từng tài khoản.
- `apps/api/migrations/014_classroom_answer_evidence.sql`: lưu nguồn giáo trình và video theo từng câu trả lời.
- `apps/api/assets/classroom-handbooks/`: ba PDF v6, tải qua API kiểm quyền.
- `apps/web/components/classroom/` và `apps/web/app/classroom.css`: thư viện bài, lớp học, nguồn, ghi chú, tự kiểm và thẻ giáo trình.
- `tests/classroom.test.ts`, `scripts/classroom-browser.ts`: kiểm thử API và giao diện bằng database tạm.

Lượt phát hành sau cần cập nhật đồng bộ API, migration 013 và 014, frontend và ba assets PDF. Chỉ thực hiện khi người dùng yêu cầu phát hành. Không chạy migration mới với database chính chỉ để xem thử.

## Kiểm chứng

Lượt bổ sung video SOLIDWORKS đạt 11 kiểm thử API lớp học, 11 nhóm trình duyệt, typecheck và build Next riêng tại `.next-solidworks-video-review`. Metadata của 27/27 video xác nhận công khai và cho nhúng. Đã phát thử thực tế ba nguồn khác nhau ngay trong preview, xác nhận thời gian video chạy và đúng thời lượng/mốc mở: Sketch tiếng Việt, Sheet Metal, vỏ PCB. Đây là kiểm tra phát mẫu, không phải đã xem hết toàn bộ video.

Sau hợp nhất, `npm run test:browser` cũng đạt đủ 28 nhóm: tài khoản, duyệt tham gia Lab, giao/nộp bài cả ba môn, tải tệp đúng nội dung, chấm thủ công, trao đổi riêng và dấu trang cũ. Bộ thử đợi theo quota server thật; không nới giới hạn request để vượt kiểm thử.

Lượt hợp nhất điều hướng đã qua `npm test` (84 kiểm thử), `test:classroom` (10 kiểm thử), `test:classroom:browser` (10 nhóm), typecheck và build Next riêng tại `.next-unified-review`. Bao phủ ba catalog 32/44/24 bài, sáu bài học thử, chuyển hướng danh mục cũ, tab nguồn/PDF, tìm kiếm, đổi môn, liên kết thực hành, tiến độ tài khoản và quyền truy cập. Đã xem ảnh cả ba môn ở 390 px và thư viện nguồn ở 1440 px, không tràn ngang. Bản xem thử cũng đã tải đủ ba PDF khớp assets và kiểm tra hỏi đáp, nguồn/video, giao diện sáng/tối; không có lỗi JavaScript.

Bản hỏi đáp đơn giản trước đó đã qua 9 kiểm thử lớp học, 9 nhóm kiểm thử trình duyệt và typecheck. Bao phủ câu hỏi không có role/mode, trích dẫn bài khác, video ngay trong câu trả lời, lưu nguồn sau reload, quyền đọc/lịch sử sau thu hồi, câu hỏi ngoài giáo trình và bài chưa có video. Các kết quả dưới đây ghi lại bản bàn giao ban đầu.

Đã chạy thành công `npm test` (84 kiểm thử hiện có), `npm run test:browser` (28 kiểm tra luồng cũ), `npm run test:classroom` (7 kiểm thử lớp học), `npm run test:classroom:browser` (9 nhóm luồng), `npm run typecheck`, build API và build Next với thư mục `.next-classroom-review` riêng. Kiểm tra quyền khách/thành viên, CSRF, thu hồi quyền, ghi chú riêng, chấm quiz phía server, điều kiện hoàn thành, nguồn có chapter thật, PDF riêng, giao diện 1440 px/390 px và không có lỗi JavaScript.

Ảnh và báo cáo: `test-results/classroom/`. Kiểm tra PDF: 213/213 trang có watermark chéo EP LAB, không có chữ vượt khung; đã render và xem các contact sheet toàn bộ trang, cùng mẫu chi tiết. Ví dụ C chạy 18 phép kiểm bằng TinyCC; kiểm 8 kết quả tính số. Chưa chạy firmware trên MCU, chưa xác minh project KiCad/CAD native hoặc thử toàn bộ nguồn video phát trực tiếp.

Mã biên soạn/tạo PDF nằm trong workspace người dùng: `C:/path/to/EPlab`. `assemble.py` hợp nhất học liệu vào JSON; `build_pdfs.py` xuất sách từ chính JSON; `verify_pdfs.py` kiểm chữ chìm, khung trang và render ảnh. Các nguồn nền cũ nằm ở `work/pdfs/rewrite/`; danh mục nguồn ở `work/openmaic-research/`. Các script tạo PDF cần Python có ReportLab, pypdf, pdfplumber, Pillow và Poppler.

## SHA-256 bản bàn giao

Lượt tiếp tục ngày 17/11/2026 đã hoàn tất kiểm thử bản xem thử đang chạy: sửa selector thành tên truy cập `Chế độ tối`, xác nhận giao diện tối giữ sau reload và không tràn ngang ở 1440/390 px. Đăng nhập và tải đủ ba PDF khớp từng byte với assets. Đã chạy lại 7/7 kiểm thử lớp học, 9 nhóm kiểm thử trình duyệt và typecheck đều đạt. Kết quả bổ sung ở `work/classroom-preview/verification.json`; không phát hành bản mới hoặc thay dữ liệu chính.

```text
C nhúng     f3272b928fa05a0af8f98f5d760511893ec40384b1dbd091794b3d22a81a54b9
KiCad       98964b815db16efaaccc1ce5608334d0808aa32d3344af13108d3c126168010e
SOLIDWORKS  5514ce26a5d657d6270c2fafe24e3fd860b45683c6efa18a3017cb07dfd454ab
```
