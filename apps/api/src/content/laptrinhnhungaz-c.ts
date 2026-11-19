// Public videos verified against YouTube oEmbed and the original channel.
// Video references remain free; EP LAB PDFs and reviewed assignments retain their access rules.
export const embeddedAzDescription =
  "Học C với video tiếng Việt của Lập Trình Nhúng A-Z, đọc giáo trình EP LAB và thực hành 12 bài từ cơ bản đến nâng cao. Người chủ trì trực tiếp chấm bài và phản hồi.";
export const embeddedAzPreviews = [
  {
    slug: "bat-dau-voi-stm32cubeide",
    title: "Lập trình C · Giới thiệu khóa học — Lập Trình Nhúng A-Z",
    summary: "Video giới thiệu lộ trình C của kênh Lập Trình Nhúng A-Z.",
    url: "https://www.youtube.com/watch?v=rVSXMW4fJzA",
    author: "Lập Trình Nhúng A-Z",
    version: "Video C của Lập Trình Nhúng A-Z · đối chiếu công cụ đang sử dụng",
    prerequisites:
      "Chưa cần board. Chuẩn bị trình biên dịch C trên máy để thực hành.",
    content:
      "Xem video giới thiệu của Lập Trình Nhúng A-Z, sau đó đọc phần Nhập môn C trong giáo trình EP LAB. Ghi lại mục tiêu học và chuẩn bị môi trường biên dịch trước khi làm bài C01.\n\nVideo được nhúng từ kênh gốc và xem miễn phí tại đây. Tham gia Lab miễn phí để được xét duyệt quyền học giáo trình, thực hành và nhận hỗ trợ của EP LAB; không bao gồm quyền truy cập khóa riêng hoặc tài liệu trả phí của tác giả video.",
    exercise:
      "Biên dịch một chương trình C đơn giản trên máy; phân biệt biên dịch, liên kết và thực thi. Sau đó đọc chương C01 trong PDF.",
  },
  {
    slug: "nhan-dien-board-stm32",
    title: "Lập trình C · Từ khóa volatile — Lập Trình Nhúng A-Z",
    summary: "Tham khảo bài 2 của tác giả về volatile trong lập trình C.",
    url: "https://www.youtube.com/watch?v=Ekb3uwhQrqg",
    author: "Lập Trình Nhúng A-Z",
    version: "C cho hệ thống nhúng · volatile",
    prerequisites:
      "Đã hiểu biến, con trỏ và cách truy cập dữ liệu. Có thể quay lại sau phần nhập môn PDF.",
    content:
      "Xem video gốc và ghi lại những tình huống dữ liệu có thể thay đổi ngoài luồng mã đang chạy. Đối chiếu ví dụ với tài liệu compiler và vi điều khiển bạn dùng.\n\nGợi ý thực hành EP LAB: phân biệt yêu cầu truy cập biến với yêu cầu đồng bộ. volatile không tự bảo đảm một thao tác là nguyên tử và không thay thế cơ chế bảo vệ dữ liệu dùng chung. Khi làm bài C04 hoặc C10, ghi rõ nguồn tick và cách chia sẻ trạng thái.\n\nVideo thuộc Lập Trình Nhúng A-Z; giáo trình và yêu cầu nộp bài EP LAB là phần học liệu riêng.",
    exercise:
      "Lập bảng ba tình huống: biến thường, thanh ghi ngoại vi và dữ liệu dùng chung với ngắt. Ghi câu hỏi về volatile và đồng bộ để trao đổi với người chủ trì.",
  },
  {
    slug: "c-con-tro-lap-trinh-nhung-az",
    title: "Lập trình C · Con trỏ — Lập Trình Nhúng A-Z",
    summary: "Tham khảo bài 12 của tác giả về con trỏ trong C.",
    url: "https://www.youtube.com/watch?v=oUjk4myxqhs",
    author: "Lập Trình Nhúng A-Z",
    version: "C nền tảng · con trỏ và truy cập dữ liệu",
    prerequisites:
      "Biết khai báo biến, hàm và mảng; ôn phần nhập môn trước khi xem.",
    content:
      "Xem video Con trỏ trong C của Lập Trình Nhúng A-Z. Dừng video để vẽ quan hệ giữa biến, địa chỉ và giá trị; tự dự đoán kết quả trước khi chạy ví dụ của bạn.\n\nTrong giáo trình EP LAB, đọc phần hợp đồng hàm ở C01 rồi áp dụng với mảng và bộ đệm vòng ở C03. Kiểm tra con trỏ NULL, giới hạn mảng và thời gian tồn tại của đối tượng trước khi truy cập.\n\nGhi lại lỗi gặp phải và nộp mã do bạn tự thực hiện. Người chủ trì chấm sản phẩm và giải thích của bạn.",
    exercise:
      "Viết hàm trả kết quả qua con trỏ đầu ra; kiểm tra trường hợp NULL và xác nhận dữ liệu đầu ra không bị đổi khi hàm báo lỗi. Đối chiếu bài C01/C03.",
  },
];
