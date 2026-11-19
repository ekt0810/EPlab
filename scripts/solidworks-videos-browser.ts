import assert from "node:assert/strict";
import path from "node:path";
import type { Page } from "playwright";
import { waitForBrowserQuota } from "./browser-quota.js";

export async function solidworksVideosBrowser(
  page: Page,
  base: string,
  out: string,
  checks: string[],
) {
  await waitForBrowserQuota(page, base);
  await page.goto(base + "/solidworks/lop-hoc?tab=resources");
  await page.locator(".cr-source-list article").nth(26).waitFor();
  assert.equal(await page.locator(".cr-source-list article").count(), 27);
  await page.getByLabel("Lọc ngôn ngữ video").selectOption("vi");
  assert.equal(await page.locator(".cr-source-list article").count(), 6);
  await page.getByRole("link", { name: "Học bài SB03 →", exact: true }).click();
  await page
    .getByRole("tab", { name: "Video", selected: true, exact: true })
    .waitFor();
  await page.locator(".cr-watch-guide").waitFor();
  assert.equal(await page.locator(".cr-watch-guide li").count(), 3);
  assert.ok(
    (await page.locator(".cr-panel .cr-video-metadata").innerText()).includes(
      "Tiếng Việt",
    ),
  );
  await page
    .getByRole("button", { name: "Mở video gốc:", exact: false })
    .click();
  assert.ok(
    (await page.locator(".cr-panel iframe").getAttribute("src"))?.includes(
      "8xTwqSKv-GU",
    ),
  );
  await page.goto(base + "/solidworks/lop-hoc/s09");
  await page.locator(".cr-watch-guide").waitFor();
  assert.equal(
    await page.getByLabel("Video tham khảo").locator("option").count(),
    2,
  );
  await page.getByLabel("Video tham khảo").selectOption("qqnilDbzoWE");
  assert.ok(
    (await page.locator(".cr-panel .cr-video-metadata").innerText()).includes(
      "Too Tall Toby",
    ),
  );
  await page
    .getByRole("button", { name: "Mở video gốc:", exact: false })
    .click();
  assert.ok(
    (await page.locator(".cr-panel iframe").getAttribute("src"))?.includes(
      "qqnilDbzoWE",
    ),
  );
  await page.getByLabel("Video tham khảo").selectOption("6biwIeGUvUA");
  assert.equal(await page.locator(".cr-panel iframe").count(), 0);
  await page.goto(base + "/solidworks/lop-hoc/s12");
  await page.locator(".cr-watch-guide").waitFor();
  await page
    .getByRole("button", { name: "Mở video gốc:", exact: false })
    .click();
  assert.ok(
    (await page.locator(".cr-panel iframe").getAttribute("src"))?.includes(
      "start=2086",
    ),
  );
  await page.getByText("Các chương trong video", { exact: true }).click();
  await page.getByRole("button", { name: /Preparing STEP files/ }).click();
  assert.ok(
    (await page.locator(".cr-panel iframe").getAttribute("src"))?.includes(
      "start=2905",
    ),
  );
  await page.goto(base + "/solidworks/lop-hoc/s05");
  await page.locator(".cr-watch-guide").waitFor();
  await page.screenshot({
    path: path.join(out, "solidworks-video-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".cr-panel").scrollIntoViewIfNeeded();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 2,
    ),
    false,
  );
  await page.screenshot({
    path: path.join(out, "solidworks-video-mobile.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  checks.push(
    "SOLIDWORKS: 27 attributed videos, six Vietnamese sources, lesson links, watch guides, language filtering, video switching and verified chapter offsets on desktop/mobile",
  );
}
