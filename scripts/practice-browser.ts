import type { Page } from "playwright";
import sharp from "sharp";
import assert from "node:assert/strict";
import path from "node:path";
import { waitForBrowserQuota } from "./browser-quota.js";
export async function practiceBrowser({
  page,
  admin,
  email,
  base,
  out,
  checks,
}: {
  page: Page;
  admin: Page;
  email: string;
  base: string;
  out: string;
  checks: string[];
}) {
  await Promise.all([
    waitForBrowserQuota(page, base),
    waitForBrowserQuota(admin, base),
  ]);
  await page.goto(base + "/kicad/bai-hoc");
  await page.locator(".cr-lesson-link").nth(43).waitFor();
  assert.equal(new URL(page.url()).pathname, "/kicad/lop-hoc");
  assert.equal(await page.locator(".cr-lesson-link").count(), 44);
  await page.screenshot({
    path: path.join(out, "kicad-curriculum-desktop.png"),
    fullPage: true,
  });
  // Old lesson bookmarks remain readable; new navigation uses the classroom curriculum.
  await page.goto(base + "/kicad/bai-hoc/kicad-l02");
  await page.locator(".practice-reading").waitFor();
  await page.getByRole("button", { name: "Tự kiểm tra", exact: true }).click();
  await page
    .getByLabel("Lưu thư viện trong project và dùng đường dẫn tương đối", {
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Kiểm tra đáp án", exact: true })
    .click();
  await page
    .getByText("Đúng rồi. Tiến độ đã được lưu.", { exact: true })
    .waitFor();
  await page.reload();
  await page.getByText("Bạn đã hoàn thành bài này.", { exact: true }).waitFor();
  checks.push(
    "KiCad: unified 44-lesson classroom plus compatible legacy self-check progress",
  );
  await page.goto(base + "/kicad/bai-hoc/video");
  await page.locator(".cr-source-list article").first().waitFor();
  assert.equal(new URL(page.url()).searchParams.get("tab"), "resources");
  assert.equal(await page.locator(".cr-source-list article").count(), 95);
  await page.getByLabel("Tìm nguồn video", { exact: true }).fill("KiCad 9");
  await page.waitForFunction(
    () => document.querySelectorAll(".cr-source-list article").length === 2,
  );
  assert.ok(
    (
      await page
        .locator(".cr-source-list article a")
        .first()
        .getAttribute("href")
    )?.includes("youtube.com"),
  );
  checks.push(
    "KiCad: legacy video route opens the current 95-source library inside the classroom",
  );
  await admin.goto(base + "/quan-tri/kicad");
  await admin.getByRole("button", { name: "Giao bài", exact: true }).click();
  await admin.getByLabel("Bài tập", { exact: true }).selectOption("e03");
  await admin
    .getByLabel("Giao cho", { exact: true })
    .selectOption({ label: `Người tham gia kiểm thử · ${email}` });
  const instructions = "Kiểm thử quy trình giao bài " + email;
  await admin.getByLabel("Yêu cầu bổ sung", { exact: true }).fill(instructions);
  await admin
    .getByRole("button", { name: "Giao bài cho người tham gia", exact: true })
    .click();
  await admin
    .getByText("Đã giao bài cho người tham gia.", { exact: true })
    .waitFor();
  await page.goto(base + "/kicad/bai-duoc-giao");
  const card = page
    .locator(".practice-assignment")
    .filter({ hasText: instructions });
  await card.getByRole("link", { name: "Xem đề bài", exact: true }).click();
  await page.locator(".practice-upload").waitFor();
  assert.ok(new URL(page.url()).searchParams.get("assignment"));
  const fixture = await sharp({
    create: { width: 1200, height: 800, channels: 3, background: "#d5e9e8" },
  })
    .png()
    .toBuffer();
  await page.getByLabel("Chọn ảnh bài làm", { exact: true }).setInputFiles({
    name: "browser-fixture.png",
    mimeType: "image/png",
    buffer: fixture,
  });
  await page.waitForFunction(() =>
    Array.from(
      document.querySelectorAll<HTMLImageElement>(
        ".practice-image-previews img",
      ),
    ).every((img) => img.complete && img.naturalWidth > 0),
  );
  await page
    .getByLabel("Ghi chú bài làm", { exact: true })
    .fill(
      "Đây là ảnh kiểm thử luồng nộp bài, không phải mạch được kiểm chứng.",
    );
  await page
    .getByText("Báo cáo ERC/DRC JSON (tùy chọn)", { exact: true })
    .click();
  await page.getByLabel("Dán JSON xuất từ KiCad", { exact: true }).fill(
    JSON.stringify({
      kicad_version: "9.0",
      violations: [{ severity: "warning" }],
    }),
  );
  await page
    .getByRole("button", { name: "Gửi bài để người chủ trì chấm", exact: true })
    .click();
  await page
    .getByText("Đã lưu bài. Chờ người chủ trì chấm.", { exact: false })
    .waitFor();
  await page
    .getByRole("link", { name: "Xem bài nộp và nhận xét", exact: false })
    .click();
  await page.locator(".practice-result").waitFor();
  await page.getByText("Chờ người chủ trì chấm", { exact: true }).waitFor();
  const submissionUrl = page.url();
  assert.ok(
    await page
      .locator(".practice-images img")
      .first()
      .evaluate((img: any) => img.complete && img.naturalWidth > 0),
  );
  await admin.getByRole("button", { name: "Chấm bài", exact: true }).click();
  await admin
    .getByRole("button", { name: "Làm mới danh sách", exact: true })
    .click();
  await admin
    .locator(".practice-submission-list button")
    .filter({ hasText: email })
    .first()
    .click();
  await admin.locator(".practice-review-form").waitFor();
  for (const id of ["C1", "C2", "C3", "C4"]) {
    await admin
      .getByLabel("Kết quả " + id, { exact: true })
      .selectOption(id === "C4" ? "not_met" : "met");
    await admin
      .getByLabel("Nhận xét " + id, { exact: true })
      .fill("Nhận xét kiểm thử giao diện; không xác nhận chức năng mạch.");
    await admin
      .getByLabel("Hướng sửa " + id, { exact: true })
      .fill("Đối chiếu lại yêu cầu và gửi ảnh rõ hơn.");
  }
  await admin
    .getByLabel("Nhận xét chung", { exact: true })
    .fill("Đã kiểm thử luồng người chủ trì chấm bài bằng tiêu chí.");
  await admin
    .getByRole("button", { name: "Lưu điểm và nhận xét", exact: true })
    .click();
  await admin.getByText("Đã lưu điểm và nhận xét.", { exact: true }).waitFor();
  await admin.locator(".practice-result .practice-score strong").waitFor();
  await admin.screenshot({
    path: path.join(out, "kicad-manual-review-desktop.png"),
    fullPage: true,
  });
  await page.goto(submissionUrl);
  await page
    .getByText("Đã kiểm thử luồng người chủ trì chấm bài bằng tiêu chí.", {
      exact: true,
    })
    .waitFor();
  assert.equal(
    await page.locator(".practice-score strong").innerText(),
    "75/100",
  );
  checks.push(
    "KiCad: admin assigns to a learner; learner submits image/report; admin grades 75/100 and feedback persists",
  );
  await waitForBrowserQuota(page, base);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    "/kicad/bai-hoc",
    "/kicad/thuc-hanh",
    "/kicad/thuc-hanh/e03",
    "/kicad/bai-duoc-giao",
    "/kicad/bai-nop",
  ]) {
    await page.goto(base + route);
    await page.locator(".subject-tabs").waitFor();
    await page.waitForFunction(() => !document.querySelector(".loading"));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
      route,
    );
  }
  await page.goto(base + "/kicad/thuc-hanh/e03");
  await page.locator(".practice-upload").waitFor();
  await page.screenshot({
    path: path.join(out, "kicad-exercise-mobile.png"),
    fullPage: true,
  });
  await admin.setViewportSize({ width: 390, height: 844 });
  await admin.waitForFunction(
    () =>
      document.querySelector(".sidebar")!.getBoundingClientRect().right <= 0,
  );
  assert.equal(
    await admin.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "admin grading mobile",
  );
  checks.push(
    "KiCad: curriculum, assignments, submission forms and admin grading fit 390px",
  );
  await page.setViewportSize({ width: 1440, height: 1050 });
  await admin.setViewportSize({ width: 1440, height: 1050 });
}
