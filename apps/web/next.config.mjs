const api = process.env.EP_API_URL || "http://127.0.0.1:4100";
export default {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  devIndicators: false,
  poweredByHeader: false,
  experimental: { cpus: 2 },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cache-Control", value: "private, no-store" },
        ],
      },
    ];
  },
};
