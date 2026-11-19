import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./practice.css";
import "./theme.css";
import "./learning-hubs.css";
import "./accounts.css";
import "./competitions.css";
import "./auth.css";
import "./classroom.css";
export const metadata: Metadata = {
  title: "EP LAB · Không gian học kỹ thuật",
  icons: { icon: "/ep-lab-logo.svg" },
  description:
    "Học lập trình nhúng C, thiết kế PCB với KiCad và thiết kế cơ khí SOLIDWORKS. Từ kiến thức nền tảng đến sản phẩm của bạn.",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = (await headers()).get("x-nonce") || undefined;
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <meta name="darkreader-lock" />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ep-lab-theme');document.documentElement.dataset.theme=t==='dark'||t==='light'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})();`,
          }}
        />
      </head>
      <body
        className={
          process.env.EP_LOCAL_REVIEW === "true" ? "is-local-review" : undefined
        }
      >
        {process.env.EP_LOCAL_REVIEW === "true" && (
          <div className="local-review-banner">
            Bản local · Chưa đồng bộ ngrok
          </div>
        )}
        {children}
      </body>
    </html>
  );
}
