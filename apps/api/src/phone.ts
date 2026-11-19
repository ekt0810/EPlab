import { z } from "zod";

// Store one consistent format. Formatting separators and +84 are accepted on input.
export const phoneNumber = z
  .string()
  .trim()
  .max(32)
  .transform((value) => value.replace(/[\s().-]/g, "").replace(/^\+84/, "0"))
  .pipe(
    z
      .string()
      .regex(
        /^0[35789]\d{8}$/,
        "Nhập số di động Việt Nam gồm 10 số, hoặc dùng đầu +84.",
      ),
  );
