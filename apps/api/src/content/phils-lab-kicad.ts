// Keep the original lesson slugs so existing bookmarks and progress remain valid.
export const kicadPhilsLabDescription =
  "Học thiết kế mạch với video KiCad 9 của Phil’s Lab: từ sơ đồ nguyên lý đến bố trí, đi dây PCB và xuất hồ sơ sản xuất. Có hướng dẫn thực hành tiếng Việt của EP LAB.";

export const kicadPhilsLabPreviews = [
  {
    slug: "pcb-duoc-tao-ra-nhu-the-nao",
    previousUrl: "https://www.youtube.com/watch?v=vaCVh2SAZY4",
    title: "KiCad 9 · Phần 1: Sơ đồ nguyên lý — Phil’s Lab",
    summary:
      "Theo dõi quy trình thiết kế sơ đồ cho board TI MSPM0 trong video Phil’s Lab #165.",
    url: "https://www.youtube.com/watch?v=O-zNn5k5Bn4",
    author: "Phil's Lab",
    version:
      "KiCad 9 · Phil’s Lab #165 · TI MSPM0 · video gốc ngày 28/10/2025.",
    prerequisites:
      "Biết ký hiệu linh kiện cơ bản; chuẩn bị KiCad 9 hoặc đối chiếu giao diện phiên bản đang dùng.",
    content:
      "Video gốc thuộc Phil’s Lab, trình bày thiết kế sơ đồ với KiCad 9. Đây là phần đầu của bộ hai video; bài tiếp theo chuyển sang PCB. Video tiếng Anh, không xác nhận có phụ đề tiếng Việt.\n\nGợi ý thực hành riêng của EP LAB: tạo project của bạn, ghi yêu cầu nguồn và đầu nối trước khi vẽ. Khi chọn linh kiện, lập bảng đối chiếu số pin trên datasheet với symbol và footprint. Ghi lại phiên bản KiCad để thuận tiện kiểm tra về sau.\n\nSau mỗi khối chức năng, dừng video để tự giải thích kết nối. Chạy ERC, đọc nguyên nhân từng cảnh báo và lưu lại cách xử lý. Không coi việc vẽ giống hình là bằng chứng mạch đã đúng.",
    exercise:
      "Nộp sơ đồ do bạn tự vẽ, bảng pin/footprint của một linh kiện và ghi chú xử lý ERC. Phần hướng dẫn này do EP LAB biên soạn; video thuộc tác giả gốc.",
  },
  {
    slug: "symbol-va-footprint",
    previousUrl: "https://www.youtube.com/watch?v=c2niS9ZRBHo",
    title: "KiCad 9 · Phần 2: Thiết kế PCB — Phil’s Lab",
    summary:
      "Tiếp tục board TI MSPM0: bố trí linh kiện, đi dây và chuẩn bị dữ liệu chế tạo trong video Phil’s Lab #166.",
    url: "https://www.youtube.com/watch?v=igQWdVGZGpI",
    author: "Phil's Lab",
    version:
      "KiCad 9 · Phil’s Lab #166 · TI MSPM0 · video gốc ngày 28/11/2025.",
    prerequisites:
      "Hoàn thành phần 1 về sơ đồ nguyên lý; kiểm tra gán footprint trước khi chuyển sang PCB.",
    content:
      "Video phần hai của Phil’s Lab tiếp nối sơ đồ ở phần một và hướng dẫn thiết kế PCB bằng KiCad 9. Video tiếng Anh; phần ghi chú dưới đây là bài tập riêng của EP LAB.\n\nTrước khi đi dây, ghi kích thước board, vị trí đầu nối và lỗ lắp. Đối chiếu ràng buộc nhà sản xuất với thiết lập dự án; các con số trong ví dụ không tự áp dụng cho mọi thiết kế.\n\nLưu một phiên bản trước khi sửa layout. Sau khi hoàn thành, chạy DRC và xem lại dữ liệu xuất bằng trình xem Gerber. Tự kiểm tra cực linh kiện, pin 1, chữ và đường biên board trước khi quyết định chế tạo.",
    exercise:
      "Chuẩn bị ảnh layout, kết quả DRC và bộ dữ liệu chế tạo của bài tự làm. Giải thích ba quyết định bố trí; ghi những thông số còn phải kiểm chứng trước khi đặt PCB.",
  },
];
