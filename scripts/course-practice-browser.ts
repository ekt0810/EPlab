import type { Page } from "playwright";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { waitForBrowserQuota } from "./browser-quota.js";
export async function coursePracticeBrowser({
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
  const image = await sharp({
    create: { width: 800, height: 600, channels: 3, background: "#dcebec" },
  })
    .png()
    .toBuffer();
  for (const track of [
    {
      base: "/nhung-c",
      name: "C nhúng",
      id: "c01",
      file: "main.c",
      bytes: Buffer.from("#include <stdint.h>\nint main(void) { return 0; }\n"),
    },
    {
      base: "/solidworks",
      name: "SOLIDWORKS",
      id: "s02",
      file: "part.step",
      bytes: Buffer.from(
        "ISO-10303-21;\nHEADER;\nENDSEC;\nDATA;\nENDSEC;\nEND-ISO-10303-21;\n",
      ),
    },
  ]) {
    await Promise.all([
      waitForBrowserQuota(page, base),
      waitForBrowserQuota(admin, base),
    ]);
    await page.goto(base + track.base + "/thuc-hanh");
    await page.locator(".practice-exercise-card").first().waitFor();
    assert.equal(await page.locator(".practice-exercise-card").count(), 12);
    await page.getByLabel("Tìm bài tập", { exact: true }).fill(track.id);
    assert.ok(
      await page
        .locator(`.practice-exercise-card[href$="/${track.id}"]`)
        .count(),
    );
    assert.ok((await page.locator(".practice-exercise-card").count()) < 12);
    await page
      .getByLabel("Tìm bài tập", { exact: true })
      .fill("zz-no-matching-exercise");
    await page.getByText("Không có bài phù hợp.", { exact: false }).waitFor();
    await page.getByLabel("Tìm bài tập", { exact: true }).fill("");
    await page.screenshot({
      path: path.join(out, track.id + "-exercises-desktop.png"),
      fullPage: true,
    });
    await admin.goto(base + "/quan-tri" + track.base);
    await admin.getByRole("button", { name: "Giao bài", exact: true }).click();
    await admin.getByLabel("Bài tập", { exact: true }).selectOption(track.id);
    await admin
      .getByLabel("Giao cho", { exact: true })
      .selectOption({ label: `Người tham gia kiểm thử · ${email}` });
    const instructions = `Bài ${track.name} kiểm thử ${email}`;
    await admin
      .getByLabel("Yêu cầu bổ sung", { exact: true })
      .fill(instructions);
    await admin
      .getByRole("button", { name: "Giao bài cho người tham gia", exact: true })
      .click();
    await admin
      .getByText("Đã giao bài cho người tham gia.", { exact: true })
      .waitFor();
    await page.goto(base + track.base + "/bai-duoc-giao");
    await page
      .locator(".practice-assignment")
      .filter({ hasText: instructions })
      .getByRole("link", { name: "Xem đề bài", exact: true })
      .click();
    await page.locator(".practice-upload").waitFor();
    assert.ok((await page.locator(".exercise-checks article").count()) >= 3);
    assert.equal(await page.locator("iframe,.video-box").count(), 0);
    assert.equal(
      await page.locator(".exercise-guide a").getAttribute("href"),
      `${track.base}/lop-hoc/${track.id}`,
    );
    await page
      .getByLabel("Ghi chú bài làm", { exact: true })
      .fill("Bản nháp cần giữ qua tải lại, chưa phải lời giải.");
    await page
      .getByLabel("Kết quả tự kiểm tra 1", { exact: true })
      .selectOption("fail");
    await page
      .getByLabel("Quan sát thực tế 1", { exact: true })
      .fill("Fixture: còn vướng, cần người chấm góp ý.");
    await page.getByText("Đã lưu nháp ghi chú", { exact: false }).waitFor();
    await page.reload();
    await page.locator(".practice-upload").waitFor();
    assert.match(
      await page.getByLabel("Ghi chú bài làm", { exact: true }).inputValue(),
      /Bản nháp cần giữ/,
    );
    assert.equal(
      await page
        .getByLabel("Kết quả tự kiểm tra 1", { exact: true })
        .inputValue(),
      "fail",
    );
    assert.equal(
      await page.getByLabel("Quan sát thực tế 1", { exact: true }).inputValue(),
      "Fixture: còn vướng, cần người chấm góp ý.",
    );
    const assignedExerciseUrl = page.url();
    await page.goto(base + track.base + "/thuc-hanh/" + track.id);
    await page.locator(".practice-upload").waitFor();
    assert.equal(
      await page.getByLabel("Ghi chú bài làm", { exact: true }).inputValue(),
      "",
    );
    await page.goto(assignedExerciseUrl);
    await page.locator(".practice-upload").waitFor();
    assert.match(
      await page.getByLabel("Ghi chú bài làm", { exact: true }).inputValue(),
      /Bản nháp cần giữ/,
    );
    await page.getByLabel("Chọn ảnh bài làm", { exact: true }).setInputFiles({
      name: "check.png",
      mimeType: "image/png",
      buffer: image,
    });
    await page.getByLabel("Tệp bài làm", { exact: true }).setInputFiles({
      name: track.file,
      mimeType: "application/octet-stream",
      buffer: track.bytes,
    });
    await page
      .getByLabel("Ghi chú bài làm", { exact: true })
      .fill(
        "Tệp fixture kiểm thử upload/download; không phải lời giải đã được xác minh.",
      );
    await page
      .getByRole("button", {
        name: "Gửi bài để người chủ trì chấm",
        exact: true,
      })
      .click();
    await page
      .getByText("Đã lưu bài. Chờ người chủ trì chấm.", { exact: false })
      .waitFor();
    assert.equal(
      await page.getByLabel("Ghi chú bài làm", { exact: true }).inputValue(),
      "",
    );
    assert.equal(
      await page
        .getByLabel("Kết quả tự kiểm tra 1", { exact: true })
        .inputValue(),
      "not_run",
    );
    await page
      .getByRole("link", { name: "Xem bài nộp và nhận xét", exact: false })
      .click();
    await page.locator(".practice-result").waitFor();
    const submissionUrl = page.url();
    await page.goto(base + track.base + "/thuc-hanh");
    await page.locator(".practice-exercise-card").first().waitFor();
    await page
      .getByLabel("Trạng thái", { exact: true })
      .selectOption("pending_manual");
    assert.ok(
      await page
        .locator(`.practice-exercise-card[href$="/${track.id}"]`)
        .count(),
    );
    await page
      .getByLabel("Trạng thái", { exact: true })
      .selectOption("needs_revision");
    assert.equal(
      await page
        .locator(`.practice-exercise-card[href$="/${track.id}"]`)
        .count(),
      0,
    );
    await page.goto(submissionUrl);
    await page.locator(".practice-result").waitFor();
    await page
      .locator(".submission-self-checks")
      .getByText("Fixture: còn vướng, cần người chấm góp ý.", { exact: true })
      .waitFor();
    assert.match(
      await page.locator(".practice-result").innerText(),
      /Chờ người chủ trì chấm/,
    );
    const downloadPromise = page.waitForEvent("download");
    await page.locator(".practice-files a").first().click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), track.file);
    assert.deepEqual(await fs.readFile((await download.path())!), track.bytes);
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
    assert.equal(await admin.locator(".practice-files a").count(), 1);
    await admin
      .locator(".submission-self-checks")
      .getByText("Fixture: còn vướng, cần người chấm góp ý.", { exact: true })
      .waitFor();
    for (const id of ["C1", "C2", "C3", "C4"]) {
      await admin
        .getByLabel("Kết quả " + id, { exact: true })
        .selectOption("met");
      await admin
        .getByLabel("Nhận xét " + id, { exact: true })
        .fill("Nhận xét thử luồng chấm thủ công.");
    }
    const feedback = `Người chủ trì đã nhận xét bài ${track.name} trong kiểm thử.`;
    await admin.getByLabel("Nhận xét chung", { exact: true }).fill(feedback);
    await admin
      .getByRole("button", { name: "Lưu điểm và nhận xét", exact: true })
      .click();
    await admin
      .getByText("Đã lưu điểm và nhận xét.", { exact: true })
      .waitFor();
    await page.goto(submissionUrl);
    await page.getByText(feedback, { exact: true }).waitFor();
    assert.equal(
      await page.locator(".practice-score strong").innerText(),
      "100/100",
    );
    await page.reload();
    await page.getByText(feedback, { exact: true }).waitFor();
    await page.screenshot({
      path: path.join(out, track.id + "-feedback-desktop.png"),
      fullPage: true,
    });
    checks.push(
      `${track.name}: 12 exercises, learning/self-check instructions, assigned upload, exact file download and persisted manual grade`,
    );
    await page.setViewportSize({ width: 390, height: 844 });
    for (const suffix of [
      "/thuc-hanh",
      "/thuc-hanh/" + track.id,
      "/bai-duoc-giao",
      "/bai-nop",
    ]) {
      await page.goto(base + track.base + suffix);
      await page.locator(".practice-nav").first().waitFor();
      await page.waitForFunction(() => !document.querySelector(".loading"));
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        track.base + suffix,
      );
    }
    await page.goto(base + track.base + "/thuc-hanh/" + track.id);
    await page.locator(".practice-upload").waitFor();
    await page.screenshot({
      path: path.join(out, track.id + "-exercise-mobile.png"),
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
    );
    checks.push(
      `${track.name}: learning, upload, assignment/submission list and admin grading fit 390px`,
    );
    await page.setViewportSize({ width: 1440, height: 1050 });
    await admin.setViewportSize({ width: 1440, height: 1050 });
  }
}
