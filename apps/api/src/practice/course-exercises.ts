// EP LAB authored exercises. These are practice specifications, not video lessons.
import type { PoolClient } from "pg";
type Draft = {
  id: string;
  module: number;
  title: string;
  minutes: number;
  brief: string;
  learn: string[];
  steps: string[];
  checks: [string, string][];
  criteria: string[];
  reading?: { slug: string; label: string };
  starter?: string;
};
const embedded: Draft[] = [
  {
    id: "c01",
    module: 1,
    title: "Kiểu dữ liệu và quy đổi ADC",
    minutes: 45,
    brief:
      "Viết hàm đổi mẫu ADC 12 bit (0–4095) sang millivolt với Vref = 3300 mV. Bài chạy trên máy tính, chưa cần board.",
    learn: [
      "Dùng <stdint.h> để biểu diễn rõ độ rộng số nguyên. Phép chia số nguyên bỏ phần lẻ; nêu quy tắc làm tròn trong bài làm.",
      "Với đầu vào đã giới hạn, tính raw * 3300 bằng uint32_t rồi chia 4095. Không nhân bằng kiểu có thể tràn trước khi ép kiểu.",
    ],
    starter:
      "#include <stdint.h>\n#include <stdbool.h>\nbool adc_to_mv(uint16_t raw, uint16_t *mv);\n/* false khi raw > 4095 hoặc mv == NULL; không sửa đầu ra khi lỗi. */",
    steps: [
      "Cài compiler C trên máy, ghi phiên bản; tạo main.c và chạy cảnh báo biên dịch.",
      "Cài hàm adc_to_mv theo hợp đồng, làm tròn xuống; viết main chạy từng ca kiểm tra.",
      "In đầu vào, kết quả thực tế, kết quả mong đợi và PASS/FAIL; giải thích vì sao cần kiểu trung gian 32 bit.",
    ],
    checks: [
      ["raw=0 / 4095", "Thành công, lần lượt 0 / 3300 mV"],
      ["raw=2048", "1650 mV khi chia nguyên"],
      ["raw=4096, mv trỏ đến giá trị 77", "false; mv vẫn là 77"],
      ["mv=NULL", "false, không truy cập con trỏ null"],
    ],
    criteria: [
      "Kiểu dữ liệu và biểu thức tính tránh tràn trong toàn miền 0–4095.",
      "Đổi đúng cả biên và mẫu giữa theo quy tắc làm tròn.",
      "Đầu vào lỗi/con trỏ null được xử lý đúng hợp đồng.",
      "Nộp nguồn, lệnh build và log đủ bốn nhóm ca kiểm tra.",
    ],
  },
  {
    id: "c02",
    module: 2,
    title: "Đặt, xóa và đọc bit an toàn",
    minutes: 50,
    brief:
      "Tạo module flags.c/flags.h thao tác uint32_t; chỉ số bit hợp lệ từ 0 đến 31, chỉ số sai phải được từ chối.",
    reading: {
      slug: "embedded-thuc-hanh",
      label:
        "Bài nền tảng C: điều khiển trạng thái bằng bit (nếu đã được giảng viên xuất bản)",
    },
    learn: [
      "OR đặt bit, AND với mặt nạ đảo xóa bit, AND kiểm tra bit. Mặt nạ dùng UINT32_C(1).",
      "Kiểm tra n < 32 trước khi dịch; bài dùng biến RAM thông thường, không giả định thanh ghi ngoại vi đều cho phép read-modify-write.",
    ],
    steps: [
      "Định nghĩa API trả bool báo hợp lệ, nhận con trỏ uint32_t và chỉ số bit; kiểm tra con trỏ trước truy cập.",
      "Từ flags=0, đặt bit 2/7, xóa bit 2 rồi đọc hai bit.",
      "Tách header/source; viết log cho bit 0,31,32 và con trỏ null.",
    ],
    checks: [
      ["Đặt bit 2 rồi 7 từ 0", "0x00000084"],
      ["Xóa bit 2", "0x00000080; bit 7 bật, bit 2 tắt"],
      ["Đặt bit 31 từ 0", "0x80000000"],
      ["n=32 hoặc con trỏ null", "Báo lỗi, không dịch hoặc đổi dữ liệu"],
    ],
    criteria: [
      "Ba phép toán bit đúng và dùng mặt nạ unsigned.",
      "Từ chối n ngoài miền và con trỏ null.",
      "Tách module/header rõ, không dùng biến toàn cục không cần thiết.",
      "Nguồn và log thể hiện đủ ca biên, kết quả hex đúng.",
    ],
  },
  {
    id: "c03",
    module: 3,
    title: "Bộ đệm vòng cho dữ liệu UART",
    minutes: 80,
    brief:
      "Cài FIFO dung lượng 4 byte với push/pop trả bool. Từ chối ghi khi đầy, không ghi đè byte chưa đọc; chưa dùng ngắt hoặc đa luồng.",
    learn: [
      "FIFO trả dữ liệu theo thứ tự vào trước ra trước. Dùng head, tail và count để phân biệt đầy/rỗng.",
      "Mọi truy cập mảng phải trong 0..3. Mô hình đơn luồng này chưa giải quyết đồng bộ giữa ISR và main.",
    ],
    steps: [
      "Viết struct ring có mảng 4 byte, chỉ số và số phần tử; khởi tạo trạng thái rỗng.",
      "Cài push/pop, kiểm tra con trỏ và trạng thái, không thay đầu ra khi pop thất bại.",
      "Cho chỉ số đi vòng nhiều lần, in giá trị lấy ra và trạng thái sau mỗi thao tác.",
    ],
    checks: [
      ["pop khi rỗng", "false; đầu ra giữ nguyên"],
      ["push 1,2,3,4 rồi 5", "Bốn lần đầu true; 5 bị từ chối"],
      ["pop hai byte, push 5,6 rồi pop hết", "Thứ tự lần lượt 1,2 rồi 3,4,5,6"],
      ["Lặp 100 chu kỳ push/pop", "Không mất thứ tự, count luôn trong 0..4"],
    ],
    criteria: [
      "FIFO đúng thứ tự và đi vòng đúng.",
      "Xử lý đầy/rỗng mà không mất hoặc ghi đè dữ liệu.",
      "Có kiểm tra con trỏ, chỉ số và bất biến count.",
      "Nộp module, log kiểm thử gồm ca đi vòng và nêu giới hạn đơn luồng.",
    ],
  },
  {
    id: "c04",
    module: 4,
    title: "LED nhấp nháy không chặn bằng tick",
    minutes: 60,
    brief:
      "Đảo LED mỗi 500 ms bằng uint32_t tick; hàm update không dùng delay. Có thể mô phỏng tick trên máy trước khi nạp board.",
    learn: [
      "Tính thời gian đã qua bằng hiệu unsigned now-last để xử lý tick quay vòng, với khoảng kiểm tra nhỏ hơn một chu kỳ đầy đủ.",
      "Đề quy định mỗi lần update đủ 500 ms chỉ đảo một lần và gán last=now; không bù nhiều nhịp khi update trễ.",
    ],
    steps: [
      "Khởi tạo LED tắt, last=0. Cài hàm update và hàm xuất GPIO giả lập.",
      "Chạy chuỗi tick 0,499,500,999,1000; ghi trạng thái LED.",
      "Kiểm thử quay vòng và bước thời gian bị trễ; nếu dùng board, ghi đúng chân LED/cực tính, không suy đoán theo board khác.",
    ],
    checks: [
      ["Tick 0,499,500,999,1000", "LED lần lượt tắt,tắt,bật,bật,tắt"],
      ["last=0xFFFFFF00, now=0x000000F4", "Hiệu = 500; đảo một lần"],
      ["last=0, now=1600", "Chỉ đảo một lần; last=1600"],
    ],
    criteria: [
      "Logic mốc 500 ms đúng, không chặn luồng bằng delay.",
      "Kiểm tra qua điểm quay vòng uint32_t đúng.",
      "Mô phỏng GPIO hoặc cấu hình board/đấu nối được ghi rõ.",
      "Nguồn và log chứng minh các ca thời gian thường/trễ/quay vòng.",
    ],
  },
  {
    id: "c05",
    module: 5,
    title: "Chống dội nút nhấn bằng máy trạng thái",
    minutes: 75,
    brief:
      "Nút active-low, ban đầu nhả (1). Chỉ xác nhận trạng thái mới sau 20 ms ổn định; mỗi lần nhấn tăng bộ đếm đúng một lần.",
    learn: [
      "Tách mức đọc tức thời, trạng thái ứng viên và trạng thái đã xác nhận. Mỗi lần mức thô đổi thì bắt đầu lại mốc ổn định.",
      "Đếm theo cạnh chuyển đã xác nhận từ nhả sang nhấn; giữ nút không được đếm lặp.",
    ],
    steps: [
      "Viết debounce_update(raw, now) bằng C; không dùng delay hoặc vòng đợi.",
      "Dùng bảng thời điểm/mức thô để tạo dội nút và ghi sự kiện nhấn.",
      "Thử giữ nút, nhả bị dội và tick quay vòng; nếu có board, ghi điện trở kéo và cực tính.",
    ],
    checks: [
      [
        "(ms,mức): (0,1),(5,0),(8,1),(11,0),(30,0),(31,0)",
        "Chỉ tăng bộ đếm tại 31 ms",
      ],
      ["Giữ mức 0 đến 500 ms", "Không phát sinh lần nhấn mới"],
      ["Nhả ổn định 20 ms rồi nhấn ổn định 20 ms", "Tăng thêm đúng một lần"],
      ["Xung 0 ngắn 10 ms rồi về 1", "Không tính là nhấn"],
    ],
    criteria: [
      "Xác nhận trạng thái sau đủ 20 ms liên tục.",
      "Đếm theo cạnh; không đếm giữ nút hoặc xung ngắn.",
      "Có trạng thái khởi tạo và xử lý tick quay vòng.",
      "Nguồn, bảng thời gian và log chỉ ra các lần phát sự kiện.",
    ],
  },
  {
    id: "c06",
    module: 6,
    title: "Bộ phân tích lệnh UART theo dòng",
    minutes: 90,
    brief:
      "Nhận từng byte; chấp nhận LED ON, LED OFF, STATUS kết thúc bằng LF hoặc CRLF. Bộ đệm 32 byte kể cả ký tự kết thúc chuỗi.",
    learn: [
      "Luồng UART có thể chia nhỏ ở mọi vị trí; không giả định một lần nhận bằng một lệnh.",
      "Khi dòng vượt 31 byte, bỏ cả dòng đến LF và báo một lỗi; không xử lý phần bị cắt như lệnh hợp lệ.",
    ],
    steps: [
      "Tách hàm feed(byte) khỏi xử lý lệnh; không dùng gets hoặc ghi vượt mảng.",
      "Chỉ xử lý khi đủ dòng; loại CR trước LF; lệnh sai trả ERR, STATUS trả ON/OFF theo trạng thái.",
      "Ghi transcript đầu vào/phản hồi cho dòng đúng, sai, quá dài và dòng hợp lệ sau lỗi.",
    ],
    checks: [
      ["LED ON\\n rồi STATUS\\r\\n", "OK rồi ON"],
      ["LED OFF gửi từng byte rồi LF", "Chỉ thực hiện sau LF; phản hồi OK"],
      ["HELLO\\n", "ERR, trạng thái LED giữ nguyên"],
      [
        "40 ký tự A + LF rồi LED OFF + LF",
        "Một ERR cho dòng dài, sau đó OK; không tràn bộ đệm",
      ],
    ],
    criteria: [
      "Nhận dòng phân mảnh và LF/CRLF đúng.",
      "Lệnh và phản hồi đúng; không thực hiện lệnh chưa hoàn tất.",
      "Chặn tràn, bỏ dòng dài và phục hồi cho dòng tiếp theo.",
      "Nguồn và transcript chứng minh đủ các tình huống lỗi/đúng.",
    ],
  },
  {
    id: "c07",
    module: 7,
    title: "Lọc trung bình trượt tín hiệu ADC",
    minutes: 70,
    brief:
      "Tạo bộ lọc cửa sổ 4 mẫu uint16_t trong miền 0–4095. Trong thời gian khởi động, chia cho số mẫu đã có; làm tròn xuống.",
    learn: [
      "Giữ tổng bằng uint32_t và cập nhật bằng cách trừ mẫu cũ, cộng mẫu mới; không dùng tổng 16 bit cho cửa sổ tùy ý.",
      "Mẫu ngoài miền phải bị từ chối mà không thay đổi lịch sử; nêu rõ độ trễ do lọc.",
    ],
    steps: [
      "Tạo struct lưu bốn mẫu, count, index, sum và hàm reset.",
      "Viết hàm nhận mẫu trả giá trị trung bình hoặc báo lỗi; không dùng heap.",
      "So sánh với cách tính lại tổng từng bước và kiểm tra sau reset.",
    ],
    checks: [
      ["100,200,300,400", "Đầu ra 100,150,200,250"],
      ["Thêm 500 sau chuỗi trên", "350 (cửa sổ 200,300,400,500)"],
      ["Mẫu 4096", "Báo lỗi, cửa sổ không đổi"],
      ["Reset rồi nhận 0,4095", "0 rồi 2047"],
    ],
    criteria: [
      "Trung bình đúng khi khởi động và khi cửa sổ đầy.",
      "Tổng/chỉ số đi vòng an toàn, không dùng cấp phát động.",
      "Mẫu sai và reset xử lý đúng, không làm hỏng lịch sử.",
      "Nguồn, log và giải thích ảnh hưởng của lọc đến tín hiệu.",
    ],
  },
  {
    id: "c08",
    module: 8,
    title: "Đồ án C: trạm đo cảm biến tối giản",
    minutes: 150,
    brief:
      "Ghép module lấy mẫu 100 ms, lọc bốn mẫu, LED cảnh báo có hysteresis và lệnh STATUS. Dùng mẫu ADC mô phỏng hoặc board do bạn chọn.",
    learn: [
      "Tách logic thuần C khỏi driver để kiểm thử bằng dữ liệu giả lập. Báo cáo mô phỏng và đo trên board là hai loại bằng chứng khác nhau.",
      "Cảnh báo bật khi giá trị lọc ≥2500 mV, tắt khi ≤2300 mV, giữ trạng thái trong khoảng giữa. Đặt hệ thống ban đầu không cảnh báo.",
    ],
    steps: [
      "Tách ít nhất module sensor/filter, alarm, command và main; ghi sơ đồ dữ liệu.",
      "Mỗi 100 ms lấy một mẫu, chuyển đổi/lọc, cập nhật cảnh báo; STATUS trả giá trị và trạng thái, không chặn bằng delay dài.",
      "Viết kiểm thử độc lập hysteresis, tick quay vòng và dữ liệu ADC lỗi; nêu giới hạn demo và kế hoạch thử board.",
    ],
    checks: [
      ["Đưa trực tiếp vào alarm: 2200,2500,2400,2300 mV", "OFF,ON,ON,OFF"],
      [
        "STATUS khi hệ thống đang lấy mẫu",
        "Trả thông tin, lịch lấy mẫu vẫn tiếp tục",
      ],
      ["Mẫu ADC ngoài 0–4095", "Báo lỗi; không dùng như mẫu hợp lệ"],
      [
        "Reset hệ thống",
        "Trạng thái bộ lọc/lịch/LED nhất quán, được mô tả trong README",
      ],
    ],
    criteria: [
      "Chia module và luồng lấy mẫu/lọc/lệnh rõ ràng.",
      "Alarm hysteresis đúng ở hai ngưỡng và khoảng giữ.",
      "Scheduler không chặn; xử lý dữ liệu lỗi và reset.",
      "Nộp mã, bảng kiểm thử, ảnh/log và ghi rõ mô phỏng hay board thật.",
    ],
  },
];
const solidworks: Draft[] = [
  {
    id: "s01",
    module: 1,
    title: "Sketch tấm đế có hai lỗ",
    minutes: 50,
    brief:
      "Dựng Sketch tấm chữ nhật 80×50 mm, tâm tại gốc; hai lỗ Ø8 có tâm (-25,0) và (25,0). Tất cả ràng buộc phải đầy đủ.",
    reading: {
      slug: "solidworks-lo-trinh-1",
      label: "Giáo trình: Sketch, trang 4–22",
    },
    learn: [
      "Dùng MMGS, hình học đối xứng và kích thước để thể hiện ý đồ thiết kế.",
      "Sketch màu đen/Fully Defined cần được kiểm tra cùng trạng thái solver; tránh khóa Fix hàng loạt để che thiếu quan hệ.",
    ],
    steps: [
      "Tạo Part, chọn Top Plane và center rectangle tại gốc.",
      "Vẽ hai đường tròn, gán vị trí và đường kính; ưu tiên symmetry/equal phù hợp.",
      "Kiểm tra kéo thử hình, sửa chiều dài 80 thành 90 rồi trở lại 80; lưu file nguồn.",
    ],
    checks: [
      ["Đo bao ngoài và lỗ", "80×50; Ø8; khoảng hai tâm 50 mm"],
      ["Trạng thái Sketch", "Fully Defined, không lỗi over-defined"],
      [
        "Đổi chiều dài sang 90",
        "Tâm tấm vẫn ở gốc, vị trí lỗ giữ theo kích thước đề",
      ],
    ],
    criteria: [
      "Kích thước/hệ tọa độ và đơn vị đúng.",
      "Quan hệ hình học thể hiện đối xứng, không ràng buộc thừa.",
      "Sketch đầy đủ ràng buộc và sửa kích thước được.",
      "Nộp SLDPRT cùng ảnh kích thước và trạng thái Sketch.",
    ],
  },
  {
    id: "s02",
    module: 2,
    title: "Part tấm đế: Extrude và lỗ xuyên",
    minutes: 60,
    brief:
      "Tạo tấm 80×50×8 mm có hai lỗ xuyên Ø8 tại x=±25, y=0. Dùng Extruded Boss và Cut; chưa bo cạnh.",
    reading: {
      slug: "solidworks-lo-trinh-2",
      label: "Giáo trình: Part và Extrude, trang 23–33",
    },
    learn: [
      "Feature tree ghi lịch sử thiết kế; đặt tên theo chức năng. Through All thể hiện lỗ xuyên tốt hơn chiều sâu cố định khi đổi bề dày.",
      "Đối chiếu thể tích với mô hình lý tưởng: 80×50×8 − 2×π×4²×8 ≈ 31195,75 mm³.",
    ],
    steps: [
      "Tạo phôi chữ nhật và Extrude 8 mm.",
      "Tạo hai lỗ đúng vị trí bằng Cut Through All, đặt tên Base và Holes.",
      "Đổi dày 8 lên 12, rebuild để kiểm tra lỗ vẫn xuyên; trở lại 8 rồi lưu SLDPRT/STEP.",
    ],
    checks: [
      ["Measure và section view", "Đúng 80×50×8; hai lỗ xuyên Ø8"],
      ["Mass Properties: volume", "Khoảng 31195,75 mm³, sai khác tối đa 1 mm³"],
      ["Rebuild sau thay bề dày", "Không lỗi, lỗ vẫn xuyên"],
    ],
    criteria: [
      "Kích thước phôi và vị trí lỗ đúng.",
      "Feature tree có Boss/Cut hợp lý, không lỗi rebuild.",
      "Lỗ xuyên vẫn đúng khi thử đổi bề dày.",
      "Nộp SLDPRT, STEP và ảnh Measure/section hoặc volume.",
    ],
  },
  {
    id: "s03",
    module: 3,
    title: "Trục bậc bằng Revolve, Chamfer và Fillet",
    minutes: 75,
    brief:
      "Dựng trục đồng tâm dài 60 mm: đoạn Ø20 dài 40 mm, đoạn Ø12 dài 20 mm. Bo vai R1 và vát mép ngoài đầu Ø12 kích thước 1×45°.",
    reading: {
      slug: "solidworks-lo-trinh-3",
      label: "Giáo trình: Revolve/Chamfer/Fillet, trang 34–45",
    },
    learn: [
      "Sketch tiết diện nằm một phía của trục quay và đóng kín. Đo đường kính, không nhầm bán kính.",
      "Tách feature gốc và feature xử lý cạnh để dễ sửa; xác định rõ vai và đầu cần gia công.",
    ],
    steps: [
      "Vẽ nửa tiết diện dọc trục, đặt chiều dài hai đoạn và bán kính 10/6.",
      "Revolve 360° quanh centerline; chọn đúng cạnh vai để Fillet R1.",
      "Chamfer mép tròn ngoài đầu nhỏ 1×45°; chụp section và feature tree.",
    ],
    checks: [
      ["Measure hình gốc", "Tổng dài 60, Ø20/Ø12, hai đoạn 40/20"],
      ["Kiểm tra feature", "Revolve 360°, Fillet R1 và Chamfer 1×45°"],
      ["Rebuild", "Một solid body, không lỗi feature"],
    ],
    criteria: [
      "Tiết diện/trục quay và kích thước trục bậc đúng.",
      "Bo vai và vát đúng cạnh, đúng giá trị.",
      "Mô hình một solid body, feature sửa được.",
      "Nộp SLDPRT/STEP, ảnh section và feature tree rõ thông số.",
    ],
  },
  {
    id: "s04",
    module: 4,
    title: "Plane nghiêng và lỗ cắt theo pháp tuyến",
    minutes: 80,
    brief:
      "Tạo khối 60×40×20 mm có đáy trên Top Plane. Tạo plane nghiêng 30° quanh một cạnh dài trên mặt trên; dùng plane ấy để cắt lỗ Ø6 đi xuyên khối.",
    reading: {
      slug: "solidworks-lo-trinh-4",
      label: "Giáo trình: hình học tham chiếu, trang 46–55",
    },
    learn: [
      "Plane nghiêng cần mặt/phẳng gốc và trục xoay rõ ràng. Góc plane khác góc với pháp tuyến.",
      "Hướng Extruded Cut vuông góc Sketch; dùng section để xác nhận đường cắt thực sự giao khối.",
    ],
    steps: [
      "Tạo khối bằng Extrude, chọn cạnh dài trên mặt trên làm bản lề; ghi cạnh/mặt tham chiếu.",
      "Tạo Plane 30°, sketch đường tròn Ø6 trên plane tại vị trí mà trục lỗ giao khối; ràng buộc vị trí và ghi kích thước đã chọn.",
      "Cut Through All (hai phía nếu cần); chụp section cho thấy đường cắt và đo góc plane.",
    ],
    checks: [
      ["Kích thước khối/plane", "60×40×20; plane lệch 30° so với mặt trên"],
      [
        "Section qua tâm lỗ",
        "Lỗ xuyên khối, đường kính vuông góc trục là 6 mm",
      ],
      ["Edit plane và rebuild", "Quan hệ tham chiếu rõ, không mất feature"],
    ],
    criteria: [
      "Khối và plane 30° đúng, tham chiếu được chỉ rõ.",
      "Sketch Ø6 có vị trí xác định và đường cắt giao khối.",
      "Lỗ theo pháp tuyến plane, xuyên khối như section chứng minh.",
      "Nộp file nguồn, ảnh plane/section và kích thước vị trí đã chọn.",
    ],
  },
  {
    id: "s05",
    module: 5,
    title: "Sweep theo đường dẫn hai đoạn",
    minutes: 75,
    brief:
      "Tạo thanh tròn Ø6 theo hai đoạn tâm dài 40 và 30 mm vuông góc trong cùng plane, nối góc bằng Sketch Fillet R10.",
    reading: {
      slug: "solidworks-lo-trinh-5",
      label: "Giáo trình: Sweep/Loft, trang 56–65",
    },
    learn: [
      "Profile phải liên hệ đúng với đầu path; plane profile vuông góc tiếp tuyến đầu đường dẫn.",
      "Góc gãy được thay bởi cung tiếp tuyến R10; hai độ dài 40/30 đo đến giao điểm lý thuyết trước bo.",
    ],
    steps: [
      "Vẽ path chữ L 40/30 trước bo, tạo Fillet R10 và ràng buộc cung tiếp tuyến.",
      "Tạo plane/profile Ø6 tại đầu path, dùng Pierce/Coincident phù hợp.",
      "Sweep solid, kiểm tra tiết diện và hướng; lưu file và ảnh cả path/profile.",
    ],
    checks: [
      ["Path trước bo", "Hai đoạn vuông góc 40/30; R10 tiếp tuyến"],
      ["Đo tiết diện", "Ø6, không bị xoắn hoặc tự giao"],
      ["Số body/rebuild", "Một solid body, không lỗi"],
    ],
    criteria: [
      "Đường dẫn và cung bo đúng kích thước/tiếp tuyến.",
      "Profile Ø6 tại đầu path, liên hệ hình học rõ.",
      "Sweep tạo solid liên tục, không tự giao.",
      "Nộp SLDPRT/STEP và ảnh path, profile, kết quả.",
    ],
  },
  {
    id: "s06",
    module: 5,
    title: "Loft chuyển tiếp tròn – chữ nhật",
    minutes: 80,
    brief:
      "Tạo khối đặc chuyển từ hình tròn Ø30 sang chữ nhật 40×25 trên hai plane song song cách 50 mm, hai profile đồng tâm.",
    reading: {
      slug: "solidworks-lo-trinh-5",
      label: "Giáo trình: Sweep/Loft, trang 56–65",
    },
    learn: [
      "Loft nối các tiết diện theo thứ tự. Điểm nối/connector ảnh hưởng xoắn; xem preview trước khi chấp nhận.",
      "Hai profile đóng kín tạo solid; bài này không yêu cầu Shell hay kết cấu thành mỏng.",
    ],
    steps: [
      "Tạo hai plane cách nhau 50, profile tròn/chữ nhật đầy đủ kích thước và đồng tâm.",
      "Loft Boss/Base, chỉnh connector nếu thấy xoắn.",
      "Dùng section và measure kiểm tra, xuất STEP rồi mở lại để so sánh hình dạng.",
    ],
    checks: [
      ["Đo hai đầu và khoảng plane", "Ø30, 40×25, cách 50 mm, tâm thẳng hàng"],
      [
        "Section/preview",
        "Khối nối liên tục, không tự giao hoặc xoắn bất thường",
      ],
      ["Mở STEP", "Một solid body với kích thước hai đầu giữ nguyên"],
    ],
    criteria: [
      "Profile và khoảng plane đúng đề.",
      "Connector/Loft tạo chuyển tiếp hợp lý.",
      "Một solid body, rebuild và xuất STEP đúng.",
      "Nộp nguồn/STEP và ảnh profile, section, kiểm tra mở lại.",
    ],
  },
  {
    id: "s07",
    module: 6,
    title: "Assembly trục và bạc có một bậc quay",
    minutes: 100,
    brief:
      "Lắp trục Ø10×40 vào bạc Ø20 ngoài, Ø10 trong, dài 20 mm. Cố định bạc; trục đồng tâm và một đầu ngang mặt đầu bạc; để trục còn quay quanh trục tâm.",
    reading: {
      slug: "solidworks-lo-trinh-6",
      label: "Giáo trình: Assembly/Drawing, trang 66–74",
    },
    learn: [
      "Fixed một chi tiết làm chuẩn; concentric và coincident khống chế tịnh tiến nhưng vẫn có thể để tự do quay.",
      "Assembly tham chiếu các Part ngoài. Khi nộp phải kèm đủ Part cùng tên; không chỉ gửi file SLDASM.",
    ],
    steps: [
      "Tạo shaft.SLDPRT và sleeve.SLDPRT đúng kích thước; đây là bài hình học danh nghĩa, chưa chỉ định dung sai lắp ghép.",
      "Tạo assembly, cố định bạc, thêm concentric và coincident phù hợp; không bật Lock rotation.",
      "Kéo thử trục, kiểm tra mate/Interference Detection; lưu ba file trong cùng thư mục.",
    ],
    checks: [
      ["Kéo trục dọc tâm", "Không tịnh tiến"],
      ["Quay trục quanh tâm", "Còn đúng bậc quay mong muốn"],
      [
        "Kiểm tra giao thoa",
        "Không có thể tích giao thoa dương; hai mặt danh nghĩa tiếp xúc",
      ],
      ["Mở lại từ thư mục nộp", "Không thiếu Part, không mate lỗi"],
    ],
    criteria: [
      "Hai Part đúng kích thước danh nghĩa.",
      "Mates giữ vị trí, còn bậc quay theo đề.",
      "Không giao thoa dương hoặc mate lỗi; mở lại đủ tham chiếu.",
      "Nộp SLDASM, hai SLDPRT và ảnh mates/kết quả kiểm tra.",
    ],
  },
  {
    id: "s08",
    module: 6,
    title: "Drawing và hồ sơ bàn giao tấm đế",
    minutes: 100,
    brief:
      "Từ tấm đế ở bài S02, lập Drawing A4 có ba hình chiếu và isometric, kích thước cần chế tạo, xuất PDF và STEP để giảng viên kiểm tra.",
    reading: {
      slug: "solidworks-lo-trinh-6",
      label: "Giáo trình: Drawing/đồ án, trang 66–74",
    },
    learn: [
      "Chọn và ghi rõ quy ước chiếu, tỉ lệ, đơn vị. Kích thước phải đủ xác định hình học nhưng không lặp mâu thuẫn.",
      "Đề dùng kích thước danh nghĩa cho học tập; chỉ áp dụng dung sai/vật liệu theo hướng dẫn giảng viên, không tự coi là bản vẽ sẵn sàng sản xuất.",
    ],
    steps: [
      "Dựng hoặc mở lại tấm S02 80×50×8, hai lỗ Ø8 cách tâm ±25.",
      "Tạo Drawing A4; đặt ba hình chiếu, isometric và kích thước bao ngoài/lỗ/vị trí; ghi tỉ lệ, đơn vị, mã bài và người làm.",
      "Xuất PDF, mở lại ở mức 100%; xuất STEP; mở bộ SLDPRT/SLDDRW từ thư mục nộp để kiểm tra tham chiếu.",
    ],
    checks: [
      [
        "Đọc PDF",
        "Chữ/kích thước không chồng hoặc bị cắt; đủ chiều dài/rộng/dày",
      ],
      ["Thông số lỗ", "2×Ø8; vị trí xác định được từ kích thước trên bản vẽ"],
      [
        "Đối chiếu Drawing và Part",
        "Hình chiếu nhất quán, cùng phiên bản mô hình",
      ],
      [
        "Mở lại bộ nộp",
        "SLDDRW tìm được Part, STEP giữ hình dạng, PDF đọc được",
      ],
    ],
    criteria: [
      "Bố cục hình chiếu và quy ước/tỉ lệ rõ ràng.",
      "Kích thước xác định đầy đủ phôi, lỗ và vị trí.",
      "Drawing/Part nhất quán, liên kết không bị mất.",
      "Nộp SLDPRT, SLDDRW, PDF, STEP và ảnh bản vẽ dễ đọc.",
    ],
  },
];
export const courseExercises = [...embedded, ...solidworks].map((e) => ({
  ...e,
  track: e.id.startsWith("c") ? "embedded" : "solidworks",
  difficulty: e.module <= 2 ? "Cơ bản" : "Vận dụng",
  reference: "",
  passScore: 75,
  criteria: e.criteria.map((text, i) => ({
    id: `c${i + 1}`,
    text,
    points: 25,
  })),
  deliverables: e.id.startsWith("c")
    ? [
        "Mã nguồn .c/.h (tối đa 6 tệp), README .txt/.md nếu cần; ghi compiler/board hoặc mô phỏng và lệnh build.",
        "1–2 ảnh kết quả chạy/debug; log các ca kiểm tra, kết quả thực tế và phần chưa đạt trong ghi chú hoặc .txt.",
      ]
    : [
        "Tệp thiết kế theo đề: SLDPRT/SLDASM/SLDDRW, STEP hoặc PDF; tối đa 6 tệp, giữ đúng tên và đủ Part tham chiếu.",
        "1–2 ảnh Sketch/feature tree/kích thước/kết quả kiểm tra; ghi phiên bản SOLIDWORKS và phần cần giảng viên góp ý.",
      ],
}));
export async function installCourseExercises(c: PoolClient) {
  await c.query("SELECT pg_advisory_xact_lock(8493025)");
  if (
    (await c.query("SELECT 1 FROM settings WHERE key='course_practice_v1'"))
      .rowCount
  )
    return { updated: false };
  for (const e of courseExercises) {
    const course = (
      await c.query("SELECT id FROM courses WHERE category=$1", [e.track])
    ).rows[0];
    if (!course)
      throw new Error("Cần seed khóa C và SOLIDWORKS trước khi tạo bài tập.");
    await c.query("INSERT INTO exercises(id,course_id,body) VALUES($1,$2,$3)", [
      e.id,
      course.id,
      JSON.stringify(e),
    ]);
  }
  await c.query(
    "INSERT INTO settings(key,value) VALUES('course_practice_v1',$1)",
    [JSON.stringify({ embedded: 8, solidworks: 8 })],
  );
  await c.query(
    "INSERT INTO audit_logs(action,metadata) VALUES('content.course_practice_installed',$1)",
    [JSON.stringify({ embedded: 8, solidworks: 8 })],
  );
  return { updated: true, embedded: 8, solidworks: 8 };
}
