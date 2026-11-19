import type { FastifyInstance } from "fastify";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { z } from "zod";
import { one, rows, db, sql, audit } from "./db.js";
import { ApiError, admin, canLearn } from "./security.js";
import { storage } from "./storage.js";
export function inspectResource(name: string, b: Buffer) {
  if (
    !name ||
    name.length > 180 ||
    /[\x00-\x1f\x7f/\\:\u202a-\u202e\u2066-\u2069]/.test(name) ||
    /[. ]$/.test(name)
  )
    throw new ApiError(400, "Tên tệp không hợp lệ.");
  const ext = path.extname(name).toLowerCase(),
    text = b.subarray(0, 500).toString("utf8");
  if (!b.length) throw new ApiError(400, "Tệp rỗng.");
  const plain = [
    ".c",
    ".h",
    ".txt",
    ".md",
    ".kicad_sch",
    ".kicad_pcb",
    ".step",
    ".stp",
  ];
  let plainValid = false;
  if (plain.includes(ext)) {
    try {
      const decoded = new TextDecoder("utf-8", { fatal: true }).decode(b);
      plainValid = !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(decoded);
      if ([".step", ".stp"].includes(ext))
        plainValid = plainValid && decoded.includes("END-ISO-10303-21;");
    } catch {
      plainValid = false;
    }
  }
  const valid = plain.includes(ext)
    ? plainValid &&
      (ext === ".kicad_sch"
        ? text.trimStart().startsWith("(kicad_sch")
        : ext === ".kicad_pcb"
          ? text.trimStart().startsWith("(kicad_pcb")
          : [".step", ".stp"].includes(ext)
            ? text.includes("ISO-10303-21")
            : true)
    : ext === ".pdf"
      ? b.subarray(0, 5).toString() === "%PDF-" &&
        b.subarray(-2048).includes(Buffer.from("%%EOF"))
      : [".sldprt", ".sldasm"].includes(ext)
        ? b.length >= 512 &&
          b.subarray(0, 8).toString("hex") === "d0cf11e0a1b11ae1"
        : ext === ".stl"
          ? text.trimStart().startsWith("solid") ||
            (b.length >= 84 && b.readUInt32LE(80) * 50 + 84 === b.length)
          : false;
  if (!valid)
    throw new ApiError(
      400,
      "Định dạng hoặc nội dung tệp không được hỗ trợ. Chỉ nhận tài liệu C, KiCad, CAD, STEP/STL, PDF và văn bản.",
    );
}
export async function fileRoutes(app: FastifyInstance) {
  app.get("/api/files/:id/view", async (req, reply) => {
    const id = z
      .string()
      .uuid()
      .parse((req.params as any).id);
    const r = await one(
      sql`SELECT r.*,l.status,l.preview,l.audience,c.status AS course_status FROM resources r JOIN lessons l ON l.id=r.lesson_id JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE r.id=${id}`,
    );
    if (!r || !canLearn(req.actor, r as any))
      throw new ApiError(403, "Bạn chưa có quyền đọc giáo trình.");
    if (
      r.content_type !== "application/pdf" ||
      !r.name.toLowerCase().endsWith(".pdf")
    )
      throw new ApiError(415, "Chỉ mở trực tiếp tài liệu PDF.");
    reply
      .header("Content-Type", "application/pdf")
      .header(
        "Content-Disposition",
        `inline; filename="textbook.pdf"; filename*=UTF-8''${encodeURIComponent(r.name)}`,
      )
      .header(
        "Content-Security-Policy",
        "sandbox; default-src 'none'; frame-ancestors 'self'",
      )
      .header("X-Frame-Options", "SAMEORIGIN")
      .header("X-Content-Type-Options", "nosniff");
    return reply.send(await storage.get(r.storage_key));
  });
  app.get("/api/files/:id", async (req, reply) => {
    const id = z
      .string()
      .uuid()
      .parse((req.params as any).id);
    const r = await one(
      sql`SELECT r.*,l.status,l.preview,l.audience,c.status AS course_status FROM resources r JOIN lessons l ON l.id=r.lesson_id JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE r.id=${id}`,
    );
    if (!r || !canLearn(req.actor, r as any))
      throw new ApiError(403, "Bạn chưa có quyền tải tài liệu.");
    reply
      .header(
        "Content-Disposition",
        `attachment; filename="download"; filename*=UTF-8''${encodeURIComponent(r.name)}`,
      )
      .header("Content-Type", "application/octet-stream")
      .header("Content-Security-Policy", "sandbox; default-src 'none'")
      .header("X-Content-Type-Options", "nosniff");
    return reply.send(await storage.get(r.storage_key));
  });
  app.get("/api/admin/lessons/:id/resources", async (req) => {
    admin(req);
    const id = z
      .string()
      .uuid()
      .parse((req.params as any).id);
    return rows(
      sql`SELECT id,name,size,sha256,created_at FROM resources WHERE lesson_id=${id}`,
    );
  });
  app.post(
    "/api/admin/lessons/:id/resources",
    { bodyLimit: 27 * 1024 * 1024 },
    async (req) => {
      const u = admin(req),
        lesson = z
          .string()
          .uuid()
          .parse((req.params as any).id);
      if (!(await one(sql`SELECT id FROM lessons WHERE id=${lesson}`)))
        throw new ApiError(404, "Không tìm thấy bài.");
      const f = await req.file();
      if (!f) throw new ApiError(400, "Chọn tệp để tải lên.");
      const data = await f.toBuffer();
      if (f.file.truncated) throw new ApiError(413, "Tệp tối đa 25 MB.");
      const name = f.filename;
      inspectResource(name, data);
      const key = randomUUID();
      await storage.put(key, data);
      try {
        const r = await one(
          sql`INSERT INTO resources(lesson_id,name,storage_key,content_type,size,sha256) VALUES(${lesson},${name},${key},${path.extname(name).toLowerCase() === ".pdf" ? "application/pdf" : "application/octet-stream"},${data.length},${createHash("sha256").update(data).digest("hex")}) RETURNING id`,
        );
        await audit(u.id, "resource.uploaded", r!.id, {
          name,
          size: data.length,
        });
        return r;
      } catch (e) {
        await storage.remove(key);
        throw e;
      }
    },
  );
  app.delete("/api/admin/resources/:id", async (req) => {
    const u = admin(req),
      id = z
        .string()
        .uuid()
        .parse((req.params as any).id);
    const r = await one(
      sql`DELETE FROM resources WHERE id=${id} RETURNING storage_key`,
    );
    if (r) await storage.remove(r.storage_key);
    await audit(u.id, "resource.deleted", id);
    return { ok: true };
  });
}
