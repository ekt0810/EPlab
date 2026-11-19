type AdvancedDraft = {
  id: string;
  title: string;
  brief: string;
  minutes: number;
  learn: string[];
  steps: string[];
  checks: [string, string][];
  deliverables: string[];
  criteria: string[];
  reading?: { slug: string; label: string };
};
const drafts: AdvancedDraft[] = [
  {
    id: "c09",
    title: "Giao thức khung nhị phân và phục hồi lỗi",
    minutes: 150,
    brief:
      "Viết parser nhận từng byte: AA 55 | LEN | PAYLOAD | CHECKSUM. LEN từ 1 đến 16; CHECKSUM là tổng LEN và payload modulo 256. Timeout giữa hai byte trong khung là 100 ms.",
    learn: [
      "Tách trạng thái tìm header, đọc độ dài, nhận payload và kiểm tra tổng. Chỉ phát sự kiện khi nhận đủ khung hợp lệ.",
      "Tổng modulo 256 chỉ phát hiện một số lỗi, không phải bảo mật. Khi LEN/checksum sai, quay lại tìm header ở byte kế tiếp; timeout phải được kiểm tra cả lúc không nhận byte.",
    ],
    steps: [
      "Định nghĩa parser_feed(byte,now) và parser_tick(now); dùng bộ đệm cố định, không cấp phát động.",
      "Giữ byte AA thứ hai làm đầu header nếu chuỗi AA AA 55 xuất hiện. Không diễn giải AA 55 trong payload như header mới.",
      "Viết bộ phát giả lập các khung, chèn lỗi/timeout và chứng minh parser nhận lại khung hợp lệ sau lỗi.",
    ],
    checks: [
      ["AA 55 02 10 20 32", "Một payload [10,20] (hex)"],
      [
        "AA 55 02 10 20 33 rồi khung hợp lệ",
        "Khung sai bị loại; khung tiếp theo nhận đúng",
      ],
      ["LEN=0 hoặc 17", "Từ chối trước khi ghi payload"],
      ["Dừng giữa khung >=100 ms", "Reset khung dở; không phát payload thiếu"],
      [
        "Chia luồng ở mọi vị trí, AA AA 55",
        "Không phụ thuộc kích thước gói nhận; xử lý header chồng đúng",
      ],
    ],
    deliverables: [
      "parser.c/.h, test.c và README về trạng thái/timeout.",
      "Ảnh/log gồm khung đúng, checksum sai, LEN sai, timeout và phục hồi.",
    ],
    criteria: [
      "Máy trạng thái phát đúng payload và không nhầm header trong dữ liệu.",
      "Giới hạn buffer/LEN chặt chẽ, không đọc hoặc ghi vượt miền.",
      "Phục hồi đúng khi lỗi/timeout, kể cả tick quay vòng.",
      "Bộ kiểm thử có đầu vào/đầu ra thực tế cho các ca phân mảnh và lỗi.",
    ],
  },
  {
    id: "c10",
    title: "Scheduler hợp tác với đo độ trễ",
    minutes: 150,
    brief:
      "Thiết kế scheduler không chặn cho ba tác vụ chu kỳ 10, 100 và 500 ms. Thứ tự khi cùng hạn: A, B, C. Mỗi lần gọi chỉ chạy mỗi tác vụ tối đa một lần và bỏ các kỳ bị lỡ.",
    learn: [
      "Tách due time khỏi thời gian thực hiện, dùng elapsed unsigned và ghi độ trễ. Giới hạn khoảng đo nhỏ hơn một chu kỳ uint32_t đầy đủ.",
      "Chính sách đề: chạy lần đầu tại tick=chu kỳ; khi trễ, cập nhật last=now. Scheduler hợp tác không thể cứu hệ thống nếu một task chặn lâu.",
    ],
    steps: [
      "Tạo bảng task với callback, period, last, count và lateness_max; khởi tạo last=0.",
      "Dùng clock giả lập để kiểm tra lịch chính xác; mô phỏng một task trễ để đo tác động lên task sau.",
      "Thử tick quay vòng và gọi cùng tick hai lần; nêu giới hạn thời gian chạy của từng callback.",
    ],
    checks: [
      [
        "Tick mỗi 1 ms từ 0 đến 1000",
        "A chạy 100, B 10, C 2 lần; cùng hạn chạy A→B→C",
      ],
      [
        "Tick nhảy 0→550",
        "Mỗi task chạy một lần, không vòng bù vô hạn; last=550",
      ],
      ["Gọi lại tick=550", "Không chạy lặp task vừa chạy"],
      [
        "last gần UINT32_MAX rồi now quay vòng",
        "Đủ elapsed thì chạy, không kích hoạt sớm",
      ],
    ],
    deliverables: [
      "scheduler.c/.h và test/main; bảng thời điểm chạy/lateness .txt.",
      "Ảnh kết quả thử; giải thích giới hạn scheduler hợp tác và phương án xử lý task chậm.",
    ],
    criteria: [
      "Lịch/ưu tiên và chính sách bỏ kỳ lỡ đúng hợp đồng.",
      "Không chặn/vòng bù vô hạn; không chạy lặp cùng tick.",
      "Tính thời gian qua wrap và số liệu lateness đúng.",
      "Log mô phỏng cả tải thường/tải trễ, phân tích giới hạn rõ.",
    ],
  },
  {
    id: "c11",
    title: "Lưu cấu hình hai bản sao chịu lỗi ghi",
    minutes: 180,
    brief:
      "Mô phỏng hai slot cấu hình trong mảng byte: version, sequence uint32_t, giá trị ngưỡng 0–3300 mV, checksum và commit marker. Cắt điện giả lập ở từng bước ghi; luôn phục hồi bản đã commit gần nhất.",
    learn: [
      "Không ghi struct trực tiếp vì padding/endianness phụ thuộc nền tảng. Quy định cách serialize từng trường; marker commit ghi cuối.",
      "Bài dùng RAM giả lập storage, không khẳng định tính nguyên tử của Flash thật. Trong bài sequence chỉ tăng và chưa xét wrap; ghi rõ giới hạn này.",
    ],
    steps: [
      "Định nghĩa bố trí byte và checksum đơn giản, kiểm tra version, ngưỡng, marker khi đọc.",
      "Ghi bản mới vào slot còn lại, kiểm tra đọc lại rồi commit cuối; không phá slot hợp lệ trước đó.",
      "Chạy thử dừng tại mọi điểm ghi; sửa một byte, marker hoặc version để thử fallback; nêu cách áp dụng theo datasheet Flash sau này.",
    ],
    checks: [
      ["Hai slot trống/hỏng", "Nạp cấu hình mặc định và báo nguồn mặc định"],
      ["Slot A seq=4 hợp lệ, B seq=5 đang ghi", "Khởi động dùng A"],
      ["B seq=5 hoàn tất commit", "Dùng B"],
      ["B checksum/version/ngưỡng sai", "Không dùng B, phục hồi A"],
      [
        "Ngắt mô phỏng sau từng bước ghi",
        "Không nhận bản ghi một phần như hợp lệ",
      ],
    ],
    deliverables: [
      "config_store.c/.h và test, mô tả định dạng byte/commit.",
      "Ma trận điểm lỗi và kết quả phục hồi; ảnh/log chạy mô phỏng.",
    ],
    criteria: [
      "Serialization và validation rõ, không phụ thuộc padding struct.",
      "Chọn bản hợp lệ mới nhất và mặc định đúng.",
      "Ghi commit cuối, phục hồi được ở các điểm lỗi mô phỏng.",
      "Ma trận lỗi đầy đủ; nêu rõ khác biệt giữa RAM mô phỏng và Flash thật.",
    ],
  },
  {
    id: "c12",
    title: "Đồ án nâng cao: firmware thiết bị đo có phục hồi lỗi",
    minutes: 240,
    brief:
      "Tích hợp lấy mẫu, lọc, alarm, scheduler, parser nhị phân và cấu hình hai slot. Có lệnh đọc trạng thái, đổi ngưỡng, lưu cấu hình; mỗi yêu cầu phải phản hồi thành công hoặc lỗi rõ ràng.",
    learn: [
      "Tách phần driver, logic và giao thức. Kiểm tra ranh giới module và lỗi hệ thống thay vì chỉ chạy từng hàm đơn lẻ.",
      "Bộ kiểm thử tái lập cần lưu đầu vào, thời điểm, trạng thái ban đầu và đầu ra mong đợi; phân biệt bằng chứng mô phỏng với board thật.",
    ],
    steps: [
      "Viết đặc tả mã lệnh/payload/phản hồi và sơ đồ module; dùng tối đa 6 tệp nộp có thể đọc cùng README.",
      "Tích hợp C08–C11; chọn ngưỡng alarm hợp lệ, từ chối cấu hình ngoài miền và giữ cấu hình cũ khi lưu lỗi.",
      "Chạy kịch bản 5 phút giả lập gồm nhiễu giao thức, dữ liệu ADC lỗi, task trễ và mất nguồn mô phỏng; tổng hợp kết quả.",
    ],
    checks: [
      [
        "Khung sai xen giữa lệnh đúng",
        "Không đổi cấu hình từ khung sai; vẫn nhận lệnh sau",
      ],
      [
        "Ngưỡng ngoài miền hoặc payload thiếu",
        "Phản hồi lỗi, giữ cấu hình trước",
      ],
      ["Khởi động lại sau commit và sau ghi dở", "Phục hồi đúng bản hợp lệ"],
      [
        "Đọc STATUS khi lấy mẫu hoạt động",
        "Phản hồi mà không làm dừng lịch lấy mẫu",
      ],
      [
        "Kịch bản 5 phút với lỗi",
        "Không treo/tràn buffer; log chỉ ra mỗi lỗi và phục hồi",
      ],
    ],
    deliverables: [
      "Mã C/H, README giao thức/lệnh build và bộ ca tích hợp, tối đa 6 tệp.",
      "1–2 ảnh, log thử 5 phút và bảng hạn chế/kế hoạch kiểm tra trên board.",
    ],
    criteria: [
      "Kiến trúc module và giao thức nhất quán, có thể build lại.",
      "Các chức năng đo/lọc/alarm/lệnh/cấu hình tích hợp đúng.",
      "Xử lý và phục hồi lỗi theo các ca tích hợp.",
      "Hồ sơ thử tái lập, bằng chứng và hạn chế trình bày rõ.",
    ],
  },
  {
    id: "s09",
    title: "Thiết kế tham số và cấu hình họ chi tiết",
    minutes: 140,
    brief:
      "Tạo họ tấm đế ba cấu hình L=60/80/100 mm, W=40, T=6; hai lỗ Ø6 cách mỗi đầu 10 mm và nằm trên trục giữa. Dùng biến toàn cục/equations và configurations.",
    reading: {
      slug: "solidworks-lo-trinh-2",
      label:
        "Ôn Part/Extrude, trang 23–33; phần cấu hình do người chủ trì hướng dẫn",
    },
    learn: [
      "Dùng một tham số làm nguồn cho các kích thước phụ thuộc; tránh nhập tay tọa độ lỗ cho từng cấu hình.",
      "Đề dùng kích thước danh nghĩa; đổi cấu hình phải rebuild đủ và không làm mất tham chiếu Drawing.",
    ],
    steps: [
      "Dựng Part có gốc ở tâm, đặt biến L/W/T và biểu thức x_lỗ=±(L/2−10).",
      "Tạo ba cấu hình Short/Standard/Long; kiểm tra các feature không lỗi ở cả ba.",
      "Tạo Drawing cho Standard, chuyển thử cấu hình rồi trở lại; xuất STEP từng cấu hình và bảng kích thước.",
    ],
    checks: [
      ["L=60/80/100", "Khoảng hai tâm lỗ lần lượt 40/60/80 mm"],
      ["Đổi L trong cấu hình", "Vị trí lỗ theo biểu thức, luôn cách đầu 10 mm"],
      [
        "Rebuild ba cấu hình",
        "Một solid body, không dangling dimensions/feature lỗi",
      ],
    ],
    deliverables: [
      "SLDPRT ba cấu hình, SLDDRW/PDF và tối đa ba STEP; chọn tối đa 6 tệp theo yêu cầu chủ trì.",
      "Ảnh bảng cấu hình/equations và bảng kiểm kích thước từng cấu hình.",
    ],
    criteria: [
      "Quan hệ tham số đúng và không nhập tọa độ độc lập gây lệch.",
      "Ba cấu hình rebuild đúng, feature và lỗ ổn định.",
      "Bản vẽ/thông số xuất đúng cấu hình được ghi rõ.",
      "Bảng đối chiếu đủ kích thước và bằng chứng sửa tham số.",
    ],
  },
  {
    id: "s10",
    title: "Giá đỡ tấm kim loại và bản trải",
    minutes: 160,
    brief:
      "Thiết kế giá U bằng Sheet Metal: phần đáy phẳng giữa hai đường tiếp tuyến dài 60 mm, rộng 30 mm; hai vách 20 mm, tấm dày 1,5 mm, bán kính uốn trong 1,5 mm, giả định K=0,40.",
    reading: {
      slug: "solidworks-lo-trinh-6",
      label:
        "Ôn hồ sơ Drawing, trang 66–74; Sheet Metal học cùng người chủ trì",
    },
    learn: [
      "Chiều dài phôi phụ thuộc quy ước đo và bend allowance. K=0,40 là giả định bài tập, không thay dữ liệu công nghệ của xưởng.",
      "Xác định rõ vách 20 mm đo phần thẳng từ tiếp tuyến đến mép tự do; mỗi uốn 90° có BA=(π/2)×(R+K×T).",
    ],
    steps: [
      "Tạo Base Flange và hai Edge Flange cùng chiều; ghi cách đặt kích thước phần thẳng đúng đề.",
      "Đặt T/R/K, kiểm tra Flat-Pattern và tổng chiều dài theo BA; ghi nếu cách định nghĩa flange trong phần mềm khác.",
      "Tạo Drawing trạng thái gập/trải, kích thước và đường uốn; xuất PDF/STEP.",
    ],
    checks: [
      ["Một góc uốn 90° với R=1,5; K=0,4; T=1,5", "BA≈3,299 mm"],
      [
        "Phôi theo các đoạn thẳng 60+20+20",
        "Chiều dài≈106,597 mm, rộng 30 mm theo quy ước đề",
      ],
      ["Gập/trải và rebuild", "Không tự giao, chiều dày nhất quán 1,5 mm"],
      ["Bản vẽ trải", "Có hướng/đường uốn và ghi T/R/K giả định"],
    ],
    deliverables: [
      "SLDPRT, SLDDRW/PDF, STEP và bảng tính bend allowance .txt.",
      "Ảnh Sheet Metal parameters, Flat-Pattern và trạng thái gập.",
    ],
    criteria: [
      "Mô hình Sheet Metal và quy ước kích thước đúng.",
      "T/R/K, bend allowance và kích thước trải được đối chiếu.",
      "Gập/trải ổn định, không tự giao hoặc sai chiều dày.",
      "Hồ sơ có hướng uốn và ghi giả định để chủ trì kiểm tra.",
    ],
  },
  {
    id: "s11",
    title: "Assembly cơ cấu trượt và kiểm tra hành trình",
    minutes: 180,
    brief:
      "Tạo một ray, con trượt và chốt dẫn hướng; con trượt chỉ được tịnh tiến theo một trục trong khoảng 0–40 mm. Thiết kế kích thước phù hợp, nêu khe hở danh nghĩa và không dùng mô phỏng lực.",
    reading: {
      slug: "solidworks-lo-trinh-6",
      label: "Ôn Assembly/mates, trang 66–74",
    },
    learn: [
      "Ràng buộc phải loại các bậc tự do ngoài chuyển động mong muốn; tránh Fix con trượt để che thiếu mates.",
      "Kiểm tra các vị trí đầu/cuối và giữa hành trình; không suy ra độ bền hoặc khả năng chịu tải từ việc kéo mô hình được.",
    ],
    steps: [
      "Đề xuất bản phác kích thước ray/con trượt/chốt và khe hở; tạo tối đa ba Part.",
      "Cố định ray, thêm mates phù hợp và Limit Distance 0–40; ghi bậc tự do còn lại.",
      "Kiểm tra Interference ở vị trí 0,10,20,30,40 mm; điều chỉnh và lập bảng hành trình.",
    ],
    checks: [
      [
        "Kéo con trượt",
        "Chỉ tịnh tiến theo trục chọn, không quay hoặc lệch ngang",
      ],
      ["Hai đầu hành trình", "Dừng tại 0 và 40 mm"],
      [
        "Năm vị trí kiểm tra",
        "Không có thể tích giao thoa dương; vùng tiếp xúc được giải thích",
      ],
      ["Mở lại Assembly cùng các Part", "Không mất tham chiếu/mate"],
    ],
    deliverables: [
      "SLDASM và tối đa ba SLDPRT; PDF/bảng .txt ghi kích thước và kết quả kiểm tra.",
      "1–2 ảnh thể hiện mates, hai đầu hành trình hoặc bảng interference.",
    ],
    criteria: [
      "Thiết kế hình học/khe hở có kích thước và cơ sở rõ.",
      "Mates giữ đúng một bậc tịnh tiến với giới hạn 0–40.",
      "Có bảng kiểm giao thoa cả hành trình và giải thích tiếp xúc.",
      "Bộ file mở lại đủ tham chiếu; không tuyên bố đã kiểm định tải.",
    ],
  },
  {
    id: "s12",
    title: "Đồ án nâng cao: vỏ thiết bị cho bo mạch",
    minutes: 240,
    brief:
      "Thiết kế thân, nắp và mô hình bo tham chiếu 40×30×1,6 mm; chiều cao linh kiện tối đa 10 mm. Đề xuất gối đỡ, chỗ bắt vít và cửa cổng kết nối; khoảng hở danh nghĩa tới linh kiện tối thiểu 1 mm.",
    reading: {
      slug: "solidworks-lo-trinh-6",
      label: "Assembly/Drawing/đồ án, trang 66–74",
    },
    learn: [
      "Tách yêu cầu cơ–điện: vị trí bo, vùng cấm, không gian thao tác/cáp và trình tự lắp. Những kích thước chưa được cho phải có giả định được người chủ trì duyệt.",
      "Kiểm tra hình học và hồ sơ không thay dung sai, vật liệu, công nghệ chế tạo hay thử nghiệm sản phẩm thật.",
    ],
    steps: [
      "Lập bảng yêu cầu/giả định về vị trí lỗ và cổng; tạo mô hình bo tham chiếu, thân và nắp bằng tối đa ba Part.",
      "Tạo Assembly, kiểm tra gối đỡ/cửa cổng/trình tự đóng nắp; dùng section và interference để đối chiếu khoảng hở.",
      "Bàn giao SLDASM, ba Part, PDF bản vẽ và bảng kiểm .txt (tối đa 6 tệp); ghi hạn chế và thay đổi cần xác nhận trước chế tạo.",
    ],
    checks: [
      ["Bo tham chiếu", "40×30×1,6 mm, vùng linh kiện cao 10 mm"],
      [
        "Khoảng hở tới linh kiện",
        "Tối thiểu 1 mm theo mô hình danh nghĩa; có vị trí đo",
      ],
      [
        "Assembly/đóng nắp",
        "Không giao thoa dương ở phần không chủ đích, có đường lắp tháo",
      ],
      [
        "Bộ hồ sơ",
        "Mở lại đủ file, kích thước cửa/cố định thống nhất với bảng giả định",
      ],
    ],
    deliverables: [
      "Một Assembly, ba Part, PDF Drawing và checklist .txt; giữ đúng tên tham chiếu.",
      "1–2 ảnh section/Measure và bảng kết quả; liệt kê việc cần người chủ trì xác nhận.",
    ],
    criteria: [
      "Bảng yêu cầu/giả định và mô hình bo đúng đề.",
      "Vỏ/gối/cổng và khoảng hở có bằng chứng đo.",
      "Assembly, khả năng lắp tháo và kiểm tra giao thoa rõ.",
      "Hồ sơ đầy đủ, mở lại được và nêu giới hạn trước chế tạo.",
    ],
  },
];
export const advancedExercises = drafts.map((e, i) => ({
  ...e,
  track: e.id.startsWith("c") ? "embedded" : "solidworks",
  module: 9 + (i % 4),
  difficulty: "Nâng cao",
  level: "advanced",
  order: Number(e.id.slice(1)),
  reference: "",
  version: 1,
  passScore: 75,
  criteria: e.criteria.map((text, j) => ({
    id: `c${j + 1}`,
    text,
    points: 25,
  })),
}));
