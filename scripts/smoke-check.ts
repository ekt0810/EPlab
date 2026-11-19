import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { config } from "../apps/api/src/config.js";
const out = path.join(config.root, "test-results");
await fs.mkdir(out, { recursive: true });
const base = config.url;
assert.equal(
  new URL(base).hostname,
  "127.0.0.1",
  "This check is localhost-only.",
);
const headers = (await fetch(base)).headers;
assert.ok(
  !headers.get("content-security-policy")?.includes("unsafe-eval"),
  "Run npm start production first.",
);
const courses = (await (await fetch(base + "/api/courses")).json()) as any[];
const previews = (await (await fetch(base + "/api/previews")).json()) as any[];
assert.equal(courses.length, 3);
assert.equal(previews.length, 6);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const pageErrors: string[] = [];
const checks: string[] = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1050 },
  });
  page.on("pageerror", (e) => pageErrors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(
    () => document.querySelectorAll(".course-card").length === 3,
  );
  await page.locator(".brand img").evaluate(async (img: any) => {
    if (!img.complete) await new Promise((r) => (img.onload = r));
  });
  assert.ok(
    await page
      .locator(".brand img")
      .evaluate((img: any) => img.naturalWidth > 0),
  );
  await page.screenshot({
    path: path.join(out, "production-desktop.png"),
    fullPage: true,
  });
  checks.push("Production home, logo and three course cards");
  for (const [route, apiTrack, count] of [
    ["nhung-c", "embedded", 12],
    ["kicad", "kicad", 12],
    ["solidworks", "solidworks", 12],
  ] as const) {
    await page.goto(base + `/${route}/thuc-hanh`);
    await page.locator(".practice-exercise-card").first().waitFor();
    assert.equal(await page.locator(".practice-exercise-card").count(), count);
    const list = (await (
      await fetch(base + `/api/${apiTrack}/exercises`)
    ).json()) as any[];
    assert.equal(list.length, count);
    assert.ok(list.every((e) => !e.accessible));
    assert.equal(
      (await fetch(base + `/api/${apiTrack}/exercises/${list[0].id}`)).status,
      403,
    );
  }
  checks.push(
    "Three practice tracks show 12 C, 12 KiCad and 12 SOLIDWORKS exercises; guests cannot fetch private detail",
  );
  for (const query of ["KiCad", "SOLIDWORKS"]) {
    await page.getByLabel("Tìm khóa học", { exact: true }).fill(query);
    await page.getByLabel("Tìm khóa học", { exact: true }).press("Enter");
    await page.waitForURL("**/khoa-hoc?q=" + query);
    await page.waitForFunction((q) => {
      const cards = document.querySelectorAll(".course-card");
      return cards.length === 1 && cards[0].textContent?.includes(q);
    }, query);
  }
  checks.push("Search updates correctly on the same route");
  for (const course of courses) {
    await page.goto(base + "/khoa-hoc/" + course.slug);
    await page
      .getByRole("heading", { level: 1 })
      .filter({ hasText: course.title })
      .waitFor();
  }
  checks.push("Three course outlines load");
  for (const preview of previews) {
    const response = await fetch(base + "/api/lessons/" + preview.slug);
    assert.equal(response.status, 200);
    const data = (await response.json()) as any;
    if (data.category === "solidworks") {
      assert.equal(data.video_type, "none");
      assert.equal(data.video_url, null);
    } else assert.equal(data.embed_verified, true);
    assert.equal(data.answer, undefined);
  }
  checks.push(
    "Four verified video previews and two SOLIDWORKS text introductions; answers excluded",
  );
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 1,
  });
  mobile.on("pageerror", (e) => pageErrors.push(e.message));
  await mobile.goto(base);
  await mobile.waitForFunction(
    () => document.querySelectorAll(".course-card").length === 3,
  );
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await mobile.screenshot({
    path: path.join(out, "production-mobile.png"),
    fullPage: true,
  });
  await mobile.getByRole("button", { name: "Mở menu", exact: true }).click();
  await mobile
    .getByRole("link", { name: "Học thử miễn phí", exact: true })
    .click();
  await mobile.waitForFunction(
    () => document.querySelectorAll(".preview-row").length === 6,
  );
  checks.push("390px mobile home and menu, no horizontal overflow");
  assert.deepEqual(pageErrors, []);
} finally {
  await browser.close();
}
// Bounded read-only smoke load. This is not a capacity or Internet latency promise.
const durations: number[] = [];
const statuses: Record<string, number> = {};
const start = performance.now();
await Promise.all(
  Array.from({ length: 4 }, async () => {
    for (let i = 0; i < 10; i++) {
      const t = performance.now();
      const response = await fetch(
        base + (i % 2 ? "/api/courses" : "/api/previews"),
      );
      await response.arrayBuffer();
      durations.push(performance.now() - t);
      statuses[response.status] = (statuses[response.status] || 0) + 1;
    }
  }),
);
const elapsed = performance.now() - start;
assert.equal(statuses["200"], 40);
durations.sort((a, b) => a - b);
const report = {
  checkedAt: new Date().toISOString(),
  mode: "production localhost",
  checks,
  pageErrors,
  load: {
    requests: 40,
    concurrency: 4,
    statuses,
    elapsedMs: Math.round(elapsed),
    p50Ms: Math.round(durations[19]),
    p95Ms: Math.round(durations[37]),
    maxMs: Math.round(durations[39]),
  },
};
await fs.writeFile(
  path.join(out, "production-check.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
