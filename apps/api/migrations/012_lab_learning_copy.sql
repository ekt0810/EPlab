UPDATE lessons
SET content=replace(content,
  'Phí tài khoản EP LAB dành cho giáo trình, bài thực hành và hướng dẫn của EP LAB; không bao gồm quyền truy cập khóa riêng hoặc tài liệu trả phí của tác giả video.',
  'Tham gia Lab miễn phí để được xét duyệt quyền học giáo trình, thực hành và nhận hỗ trợ của EP LAB; không bao gồm quyền truy cập khóa riêng hoặc tài liệu trả phí của tác giả video.')
WHERE slug='bat-dau-voi-stm32cubeide';
