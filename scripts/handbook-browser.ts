import assert from "node:assert/strict";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Page } from "playwright";
import { participantHandbooks } from "../apps/api/src/content/participant-handbooks.js";

export async function handbookBrowser({
  page,
  admin,
  base,
  out,
  checks,
}: {
  page: Page;
  admin: Page;
  base: string;
  out: string;
  checks: string[];
}) {
  const guestContext = await page
    .context()
    .browser()!
    .newContext({ viewport: { width: 390, height: 844 } });
  try {
    const guest = await guestContext.newPage();
    for (const book of participantHandbooks) {
      const materialPath = `${book.practiceBase}/tai-lieu`;
      await guest.goto(base + materialPath);
      await guest.locator(".cr-handbook-card").waitFor();
      assert.equal(
        new URL(guest.url()).pathname,
        `${book.practiceBase}/lop-hoc`,
      );
      assert.equal(new URL(guest.url()).searchParams.get("tab"), "resources");
      assert.equal(await guest.locator('a[href^="/api/files/"]').count(), 0);
      assert.equal(
        await guest
          .getByRole("link", { name: "Tải giáo trình v6", exact: true })
          .count(),
        0,
      );
      assert.equal(await guest.locator(".cr-host-documents").count(), 0);
      assert.equal(
        await guest.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
      );
      await guest.screenshot({
        path: path.join(out, `${book.category}-materials-guest-mobile.png`),
        fullPage: true,
      });

      await admin.goto(base + materialPath);
      await admin.locator(".cr-handbook-card").waitFor();
      await admin.locator(".cr-host-documents summary").click();
      await admin
        .locator('.cr-host-documents a[href^="/api/files/"]')
        .first()
        .waitFor();
      assert.equal(
        await admin
          .getByRole("link", { name: "Tải giáo trình v6", exact: true })
          .count(),
        1,
      );
      await admin.screenshot({
        path: path.join(out, `${book.category}-materials-admin-desktop.png`),
        fullPage: true,
      });

      await page.goto(base + `${book.practiceBase}/bai-hoc/${book.lessonSlug}`);
      await page.locator(".handbook-chapters li").nth(11).waitFor();
      assert.equal(await page.locator("iframe,.video-box").count(), 0);
      assert.equal(await page.locator(".handbook-chapters li").count(), 12);
      const href = await page
        .getByRole("link", { name: "Tải PDF", exact: true })
        .first()
        .getAttribute("href");
      assert.ok(href);
      const response = await page.request.get(base + href);
      assert.equal(response.status(), 200);
      assert.equal(
        createHash("sha256")
          .update(await response.body())
          .digest("hex"),
        book.sha256,
      );
      const first = book.chapters[0];
      await page
        .getByRole("link", {
          name: `Làm bài ${first.id.toUpperCase()}`,
          exact: true,
        })
        .click();
      await page.waitForURL(`**${book.practiceBase}/thuc-hanh/${first.id}`);
      await page.locator(".practice-upload").waitFor();
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      base +
        `${participantHandbooks[0].practiceBase}/bai-hoc/${participantHandbooks[0].lessonSlug}`,
    );
    await page.locator(".handbook-chapters li").nth(11).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: path.join(out, "handbook-learner-mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
    checks.push(
      "Current classroom PDF resources preserve guest lock and admin host files; legacy v5 bookmarks, hashes and exercise links remain compatible",
    );
  } finally {
    await guestContext.close();
  }
}
