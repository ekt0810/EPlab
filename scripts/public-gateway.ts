import http, { type IncomingMessage } from "node:http";
import { isIP } from "node:net";

function last(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value.join(",") : value || "")
    .split(",")
    .at(-1)!
    .trim();
}
export function upstreamHeaders(
  req: Pick<IncomingMessage, "headers">,
  origin: string,
): http.OutgoingHttpHeaders {
  const expected = new URL(origin);
  if (
    req.headers.host !== expected.host ||
    last(req.headers["x-forwarded-proto"]) !== "https"
  )
    throw new Error("Invalid public host or scheme");
  const ip = last(req.headers["x-forwarded-for"]);
  if (!isIP(ip)) throw new Error("Missing ngrok client address");
  const headers = { ...req.headers };
  const hop = [
    "connection",
    "keep-alive",
    "transfer-encoding",
    "te",
    "trailer",
    "upgrade",
    "proxy-authorization",
    "proxy-authenticate",
    ...String(headers.connection || "")
      .toLowerCase()
      .split(",")
      .map((x) => x.trim()),
  ];
  for (const key of Object.keys(headers))
    if (
      hop.includes(key) ||
      key === "forwarded" ||
      key.startsWith("x-forwarded-") ||
      key === "x-real-ip"
    )
      delete headers[key];
  return {
    ...headers,
    host: expected.host,
    "x-forwarded-for": ip,
    "x-forwarded-host": expected.host,
    "x-forwarded-proto": "https",
  };
}

export function publicGateway(options: {
  origin: string;
  ready: () => Promise<boolean>;
  webPort?: number;
  apiPort?: number;
}) {
  const server = http.createServer(
    { maxHeaderSize: 16384, requestTimeout: 60000, headersTimeout: 10000 },
    async (req, res) => {
      const fail = (status: number) => {
        if (!res.headersSent) {
          res.shouldKeepAlive = false;
          res.writeHead(status, {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "no-store",
            connection: "close",
          });
          res.end(
            status === 503
              ? "EP LAB đang chuẩn bị hoặc bảo trì. Vui lòng quay lại sau."
              : "Yêu cầu không hợp lệ.",
          );
          req.resume();
        } else res.destroy();
      };
      try {
        if (!req.url?.startsWith("/") || req.url.startsWith("//"))
          return fail(400);
        const headers = upstreamHeaders(req, options.origin);
        if (!(await options.ready())) return fail(503);
        const max = 27 * 1024 * 1024;
        if (Number(req.headers["content-length"] || 0) > max) return fail(413);
        const port =
          req.url === "/api" || req.url.startsWith("/api/")
            ? options.apiPort || 4100
            : options.webPort || 3100;
        const upstream = http.request(
          {
            host: "127.0.0.1",
            port,
            method: req.method,
            path: req.url,
            headers,
            timeout: 60000,
          },
          (response) => {
            const outgoing = { ...response.headers };
            delete outgoing.connection;
            res.writeHead(response.statusCode || 502, {
              ...outgoing,
              "strict-transport-security": "max-age=86400",
            });
            response.on("error", () => res.destroy());
            response.pipe(res);
          },
        );
        upstream.on("timeout", () => upstream.destroy());
        upstream.on("error", () => fail(502));
        req.on("aborted", () => upstream.destroy());
        res.on("close", () => {
          if (!res.writableFinished) upstream.destroy();
        });
        let bytes = 0;
        req.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > max) {
            upstream.destroy();
            fail(413);
            req.resume();
          }
        });
        req.pipe(upstream);
      } catch {
        fail(503);
      }
    },
  );
  server.on("upgrade", (_req, socket) => socket.destroy());
  return server;
}
