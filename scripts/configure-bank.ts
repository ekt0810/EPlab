import { pool, tx } from "../apps/api/src/db.js";
import { parseVietQR } from "../apps/api/src/qr.js";
// Original payload decoded from the QR supplied by the owner. No amount/order is encoded.
const payload =
  "0002010102111531397007040052044600005169946888838550010A000000727012500069704230111516994688880208QRIBFTTA5204513753037045802VN5916NGUYEN KIM TRUNG6006Ha Noi8707CLASSIC63044859";
const qr = parseVietQR(payload);
await tx(async (c) => {
  const current = (
    await c.query("SELECT value FROM settings WHERE key='billing' FOR UPDATE")
  ).rows[0].value;
  if (current.accountNumber && current.accountNumber !== qr.accountNumber)
    throw new Error("Tài khoản hiện tại khác QR. Không tự ghi đè.");
  await c.query("UPDATE settings SET value=$1 WHERE key='billing'", [
    JSON.stringify({
      ...current,
      bankName: "TPBank",
      accountNumber: qr.accountNumber,
      accountHolder: qr.accountHolder,
      qrPayload: payload,
      enabled: Boolean(current.enabled),
    }),
  ]);
  await c.query(
    "INSERT INTO audit_logs(action,metadata) VALUES('billing.owner_qr_configured',$1)",
    [
      JSON.stringify({
        bank: "TPBank",
        accountSuffix: qr.accountNumber?.slice(-4),
        enabled: Boolean(current.enabled),
      }),
    ],
  );
});
console.log(
  "QR và người nhận đã được kiểm chứng, lưu cấu hình. Giữ nguyên trạng thái nhận đơn hiện tại; lệnh này không tự bật thu phí.",
);
await pool.end();
