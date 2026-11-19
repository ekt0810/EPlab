import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { config } from "../apps/api/src/config.js";
import { kicadPhilsLabPreviews } from "../apps/api/src/content/phils-lab-kicad.js";
assert.equal(new URL(config.url).hostname, "127.0.0.1");
const videos = JSON.parse(
  await fs.readFile(
    path.join(config.root, "test-results/video-check-kicad.json"),
    "utf8",
  ),
);
assert.equal(videos.length, 2);
assert.ok(
  videos.every(
    (v: any) =>
      v.playable && v.authorUrl === "https://www.youtube.com/@PhilsLab",
  ),
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const errors: string[] = [];
const checked = [];
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      isMobile: width === 390,
    });
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(config.url + "/khoa-hoc/thiet-ke-mach-kicad");
    await page
      .getByRole("heading", { name: "Thiết kế mạch KiCad", exact: true })
      .waitFor();
    for (const source of kicadPhilsLabPreviews)
      await page
        .locator(".curriculum-row")
        .filter({ hasText: source.title })
        .waitFor();
    for (const source of kicadPhilsLabPreviews) {
      await page.goto(config.url + "/bai-hoc/" + source.slug);
      await page
        .getByRole("heading", { name: source.title, exact: true })
        .waitFor();
      const frame = page.locator("iframe");
      await frame.waitFor();
      const player = page.frameLocator("iframe").locator(".html5-video-player");
      await player.waitFor({ timeout: 25000 });
      await page
        .frameLocator("iframe")
        .getByRole("button", { name: /^(Play video|Play|Phát video|Phát)$/i })
        .waitFor({ state: "visible", timeout: 15000 });
      const youtube = page
        .frames()
        .find((f) => f.url().includes("youtube-nocookie.com/embed/"))!;
      await youtube.evaluate(() => {
        const v = document.querySelector("video");
        if (v) v.muted = true;
      });
      await page
        .frameLocator("iframe")
        .getByRole("button", { name: /^(Play video|Play|Phát video|Phát)$/i })
        .click();
      await youtube.waitForFunction(
        () => {
          const p = document.getElementById("movie_player") as any;
          return p?.getPlayerState?.() === 1 && p?.getCurrentTime?.() > 2;
        },
        undefined,
        { timeout: 20000 },
      );
      assert.ok(
        (await frame.getAttribute("src"))?.includes(
          new URL(source.url).searchParams.get("v")!,
        ),
      );
      assert.ok(
        (await page.locator(".lesson-source").innerText()).includes(
          "Phil's Lab",
        ),
      );
      assert.ok(
        (await page.locator(".lesson-source").innerText()).includes(
          "Tiếng Anh",
        ),
      );
      assert.equal(
        await page.locator(".lesson-source a").getAttribute("href"),
        source.url,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      assert.ok(!(await page.locator("body").innerText()).includes("DigiKey"));
      if (source === kicadPhilsLabPreviews[0])
        await page.screenshot({
          path: path.join(
            config.root,
            `test-results/kicad-phils-lab-${width}.png`,
          ),
          fullPage: true,
        });
      checked.push({
        width,
        lesson: source.slug,
        source: source.url,
        iframe: true,
        actualLessonPlayerPlaying: true,
        attribution: true,
        englishLabel: true,
        noHorizontalOverflow: true,
      });
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  const report = {
    checkedAt: new Date().toISOString(),
    status: "passed",
    videosVerifiedPlaying: 2,
    checks: checked,
    pageErrors: errors,
  };
  await fs.writeFile(
    path.join(config.root, "test-results/kicad-source-check.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
