import type { Page } from "playwright";

// The browser suite navigates much faster than a person. Wait for the real
// server quota between journeys without weakening the application's limits.
export async function waitForBrowserQuota(
  page: Page,
  base: string,
  minimumRemaining = 125,
) {
  const response = await page.request.get(base + "/api/auth/me");
  const headers = response.headers();
  if (
    Number(headers["x-ratelimit-remaining"] ?? 180) < minimumRemaining ||
    response.status() === 429
  ) {
    let remaining =
      (Number(headers["x-ratelimit-reset"] || headers["retry-after"] || 60) + 1) *
      1000;
    while (remaining > 0) {
      const step = Math.min(remaining, 30000);
      await new Promise((resolve) => setTimeout(resolve, step));
      remaining -= step;
    }
  }
}
