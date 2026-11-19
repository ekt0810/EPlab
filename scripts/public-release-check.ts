import { waitForBrowserQuota } from "./browser-quota.js";
import { chromium } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { config } from "../apps/api/src/config.js";
const base = config.url;
assert.equal(new URL(base).protocol, "https:");
const out = path.join(config.root, "test-results/public-release");
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const checks: string[] = [],
  errors: string[] = [];
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    extraHTTPHeaders: { "ngrok-skip-browser-warning": "1" },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (
      r.status() >= 400 &&
      r.url().startsWith(base) &&
      !r.url().endsWith("/handbook")
    )
      console.log("PUBLIC_HTTP", r.status(), r.url());
  });
  const health = await page.request.get(base + "/api/health");
  assert.equal(health.status(), 200);
  const catalog = await (
    await page.request.get(base + "/api/classroom")
  ).json();
  assert.deepEqual(
    catalog.map((c: any) => c.lessonCount),
    [32, 44, 24],
  );
  assert.equal(
    catalog.reduce((n: number, c: any) => n + c.previews.length, 0),
    6,
  );
  checks.push(
    "Public HTTPS health; current catalog 32/44/24 with six previews",
  );
  await page.goto(base);
  await page.locator(".hub-subject-card").first().waitFor();
  assert.equal(await page.locator(".hub-subject-card").count(), 3);
  for (const [track, route] of [
    ["embedded", "nhung-c"],
    ["kicad", "kicad"],
    ["solidworks", "solidworks"],
  ]) {
    await waitForBrowserQuota(page, base, 100);
    const list = await (
      await page.request.get(`${base}/api/${track}/exercises`)
    ).json();
    assert.equal(list.length, 12);
    assert.ok(list.every((e: any) => e.latest === null && !e.accessible));
    const pdf = await page.request.get(
      `${base}/api/classroom/${track}/handbook`,
    );
    assert.equal(pdf.status(), 403);
    await page.goto(`${base}/${route}/thuc-hanh`);
    await page.locator(".practice-exercise-card").first().waitFor();
    await page.getByLabel("Tìm bài tập", { exact: true }).fill(list[0].id);
    assert.ok(
      await page
        .locator(`.practice-exercise-card[href$="/${list[0].id}"]`)
        .count(),
    );
    assert.ok((await page.locator(".practice-exercise-card").count()) < 12);
    await page.screenshot({
      path: path.join(out, `${track}-practice.png`),
      fullPage: true,
    });
    await page.goto(`${base}/${route}/tai-lieu`);
    await page.waitForURL(`**/${route}/lop-hoc?tab=resources`, {
      waitUntil: "domcontentloaded",
    });
    await page.locator(".cr-source-list article").first().waitFor();
    checks.push(
      `${track}: 12 searchable exercises, guest privacy, resources redirect to classroom`,
    );
  }
  const sources = await (
    await page.request.get(base + "/api/classroom/solidworks/sources")
  ).json();
  assert.equal(sources.videos.length, 27);
  assert.equal(
    sources.videos.filter((v: any) => v.language === "vi").length,
    6,
  );
  checks.push(
    "27 SOLIDWORKS videos with six Vietnamese sources are publicly listed",
  );
  const sw = await (
    await page.request.get(base + "/api/classroom/solidworks")
  ).json();
  assert.equal(sw.lessons.length, 24);
  const preview = sw.lessons.find((l: any) => l.preview);
  const lesson = await (
    await page.request.get(
      `${base}/api/classroom/solidworks/lessons/${preview.id}`,
    )
  ).json();
  assert.ok(
    lesson.videos?.length || lesson.lesson?.videos?.length,
    "Preview includes video guidance",
  );
  await page.goto(`${base}/solidworks/lop-hoc/${preview.id}`);
  await page.locator(".cr-watch-guide").waitFor();
  await page.screenshot({
    path: path.join(out, "solidworks-classroom.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base + "/solidworks/thuc-hanh");
  await page.locator(".practice-exercise-card").first().waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: path.join(out, "practice-mobile.png"),
    fullPage: true,
  });
  assert.deepEqual(errors, []);
  checks.push(
    "SOLIDWORKS public preview video guidance; mobile 390px fits; no page errors",
  );
  const report = {
    checkedAt: new Date().toISOString(),
    base,
    status: "passed",
    checks,
    errors,
  };
  await fs.writeFile(
    path.join(out, "check.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
