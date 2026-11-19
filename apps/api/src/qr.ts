import QRCode from "qrcode";
export function tlv(text: string) {
  const result = new Map<string, string>();
  let i = 0;
  while (i < text.length) {
    const tag = text.slice(i, i + 2),
      len = Number(text.slice(i + 2, i + 4));
    if (
      !/^\d{2}$/.test(tag) ||
      !Number.isInteger(len) ||
      i + 4 + len > text.length
    )
      throw new Error("Invalid VietQR payload");
    result.set(tag, text.slice(i + 4, i + 4 + len));
    i += 4 + len;
  }
  return result;
}
export function parseVietQR(payload: string) {
  let crc = 0xffff;
  for (const b of Buffer.from(payload.slice(0, -4), "utf8")) {
    crc ^= b << 8;
    for (let n = 0; n < 8; n++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  if (
    crc.toString(16).padStart(4, "0").toUpperCase() !==
    payload.slice(-4).toUpperCase()
  )
    throw new Error("Invalid QR checksum");
  const tags = tlv(payload);
  const provider = tlv(tags.get("38") || "");
  if (provider.get("00") !== "A000000727")
    throw new Error("Not a supported VietQR account");
  const account = tlv(provider.get("01") || "");
  return {
    bankBin: account.get("00"),
    accountNumber: account.get("01"),
    accountHolder: tags.get("59"),
    amount: tags.get("54") || null,
  };
}
export async function qrImage(payload: string, accountNumber: string) {
  const p = parseVietQR(payload);
  if (p.accountNumber !== accountNumber)
    throw new Error("QR recipient mismatch");
  return QRCode.toDataURL(payload, {
    width: 420,
    margin: 3,
    errorCorrectionLevel: "M",
  });
}
