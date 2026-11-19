import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { startBrowserEnvironment } from "./browser-environment.js";
import { classroomNavigationBrowser } from "./classroom-navigation-browser.js";
import { solidworksVideosBrowser } from "./solidworks-videos-browser.js";
import { courses } from "../apps/api/src/classroom/catalog.js";
const env = await startBrowserEnvironment(),
  { browser, config } = env;
const out = path.join(config.root, "test-results/classroom");
await fs.mkdir(out, { recursive: true });
const checks: string[] = [],
  errors: string[] = [];
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(config.url + "/kicad/lop-hoc");
  await page
    .getByRole("heading", { name: "Thiết kế mạch KiCad", exact: true })
    .waitFor();
  assert.equal(await page.locator(".cr-lesson-link").count(), 44);
  await page.getByLabel("Tìm trong lớp học").fill("impedance");
  assert.ok((await page.locator(".cr-lesson-link").count()) > 0);
  await page.getByLabel("Tìm trong lớp học").fill("khong-co-chu-de-xyz");
  await page.getByText("Không có bài phù hợp.", { exact: false }).waitFor();
  await page.getByLabel("Tìm trong lớp học").fill("");
  checks.push("Catalog search and empty state");
  await page.getByRole("tab", { name: "Video & giáo trình PDF" }).click();
  await page.locator(".cr-source-list article").first().waitFor();
  await page.getByLabel("Lọc loại nguồn").selectOption("kicad");
  assert.equal(await page.locator(".cr-source-list article").count(), 8);
  checks.push("Eight direct KiCad tutorials separated from companion sources");
  await page.goto(config.url + "/nhung-c/lop-hoc/cb01");
  await page.locator(".cr-slide").waitFor();
  await page.getByRole("tab", { name: "Video", exact: true }).click();
  await page
    .getByRole("button", { name: "Mở video gốc", exact: false })
    .click();
  assert.ok(
    (await page.locator(".cr-video iframe").getAttribute("src"))?.includes(
      "youtube-nocookie.com/embed/rVSXMW4fJzA",
    ),
  );
  checks.push("Guest preview and real source iframe URL");
  await page.goto(config.url + "/kicad/lop-hoc/ka01");
  await page
    .getByText("Tham gia Lab và được duyệt để học nội dung này.", {
      exact: true,
    })
    .waitFor();
  checks.push("Member classroom is gated for guest");
  await page.goto(config.url + "/dang-nhap");
  await page.locator("input[type=email]").fill("one@example.test");
  await page.locator("input[type=password]").fill(env.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL((u) => !u.pathname.includes("dang-nhap"));
  await page.goto(config.url + "/nhung-c/lop-hoc/cb01");
  await page.locator(".cr-slide").waitFor();
  await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
  await page
    .getByLabel("Ghi chú bài học")
    .fill("Ghi chú kiểm thử EP LAB: scope khác lifetime.");
  await page.getByRole("button", { name: "Lưu ghi chú", exact: true }).click();
  await page.getByText("Đã lưu vào tài khoản", { exact: true }).waitFor();
  await page.reload();
  await page.locator(".cr-slide").waitFor();
  await page.getByRole("tab", { name: "Ghi chú", exact: true }).click();
  assert.equal(
    await page.getByLabel("Ghi chú bài học").inputValue(),
    "Ghi chú kiểm thử EP LAB: scope khác lifetime.",
  );
  checks.push("Private notes persist across reload");
  await page.getByLabel(/Bước \d+: Đến lượt bạn thực hành/).click();
  const boxes = page.locator(".cr-checklist input");
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).check();
  await page.getByLabel(/Bước \d+: Kiểm tra điều đã hiểu/).click();
  const l = courses.embedded.lessons[0];
  await page
    .locator(".cr-answers input")
    .nth((l.quiz.answer + 1) % l.quiz.options.length)
    .check();
  await page
    .getByRole("button", { name: "Kiểm tra câu trả lời", exact: true })
    .click();
  await page.locator(".cr-quiz-result.retry").waitFor();
  await page.locator(".cr-answers input").nth(l.quiz.answer).check();
  await page
    .getByRole("button", { name: "Kiểm tra câu trả lời", exact: true })
    .click();
  await page.locator(".cr-quiz-result.correct").waitFor();
  await page
    .getByRole("button", { name: "Hoàn thành bài học", exact: true })
    .click();
  await page.getByText("Bạn đã hoàn thành bài.", { exact: false }).waitFor();
  checks.push("Wrong/correct quiz, practice checklist and completion flow");
  await page.getByRole("tab", { name: "Hỏi giáo trình", exact: true }).click();
  await page
    .getByRole("button", { name: "Giải thích ý chính của bài", exact: true })
    .click();
  await page.locator(".cr-chat-answer").waitFor();
  assert.ok(
    (await page.locator(".cr-chat-answer").innerText()).includes("GIÁO TRÌNH"),
  );
  assert.equal(await page.getByLabel("Vai trò", { exact: true }).count(), 0);
  assert.equal(await page.getByLabel("Chế độ", { exact: true }).count(), 0);
  const firstAnswer = page.locator(".cr-answer-card").first();
  assert.ok((await firstAnswer.locator(".cr-answer-references a").count()) > 0);
  const videoLink = await firstAnswer
    .getByRole("link", { name: "Mở trên YouTube", exact: true })
    .first()
    .getAttribute("href");
  assert.ok(videoLink?.startsWith("https://www.youtube.com/watch?v="));
  await firstAnswer
    .getByRole("button", { name: "Xem video ví dụ:", exact: false })
    .first()
    .click();
  const embed = await firstAnswer.locator("iframe").first().getAttribute("src");
  const linked = new URL(videoLink!);
  assert.ok(embed?.includes(linked.searchParams.get("v")!));
  await page.reload();
  await page.locator(".cr-answer-card").first().waitFor();
  assert.equal(
    await page
      .locator(".cr-answer-card")
      .first()
      .getByRole("link", { name: "Mở trên YouTube", exact: true })
      .first()
      .getAttribute("href"),
    videoLink,
  );
  await page
    .getByLabel("Câu hỏi về bài học", { exact: true })
    .fill("Con trỏ là gì?");
  await page.getByRole("button", { name: "Gửi câu hỏi", exact: true }).click();
  await page
    .locator(".cr-answer-card")
    .first()
    .getByText("Con trỏ là gì?", { exact: false })
    .waitFor();
  assert.ok(
    (
      await page
        .locator(".cr-answer-card")
        .first()
        .locator(".cr-answer-references a")
        .first()
        .getAttribute("href")
    )?.endsWith("/cb03"),
  );
  await page
    .getByLabel("Câu hỏi về bài học", { exact: true })
    .fill("Giá vàng hôm nay là bao nhiêu?");
  await page.getByRole("button", { name: "Gửi câu hỏi", exact: true }).click();
  await page
    .locator(".cr-answer-card")
    .first()
    .getByText("Chưa tìm thấy đoạn giáo trình", { exact: false })
    .waitFor();
  assert.equal(
    await page
      .locator(".cr-answer-card")
      .first()
      .locator(".cr-answer-video")
      .count(),
    0,
  );
  checks.push(
    "Question-only handbook answers, cited lessons, inline video, saved evidence and honest no-match response",
  );

  for (const [track, base, id] of [
    ["embedded", "nhung-c", "cb11"],
    ["kicad", "kicad", "l07"],
    ["solidworks", "solidworks", "s05"],
  ] as const) {
    await page.goto(config.url + `/${base}/lop-hoc/${id}`);
    await page.locator(".cr-slide").waitFor();
    await page.getByRole("button", { name: "Tiếp", exact: true }).click();
    await page.getByText("Đã lưu vào tài khoản", { exact: true }).waitFor();
    await page.screenshot({
      path: path.join(out, track + "-desktop.png"),
      fullPage: true,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      ),
      false,
      "Desktop horizontal overflow",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await page.locator(".cr-slide").waitFor();
    assert.ok(
      (await page.locator(".cr-scene-bar").innerText()).includes("BƯỚC 2"),
    );
    await page.getByLabel(/Bước \d+: Đến lượt bạn thực hành/).click();
    await page.getByText("Tiêu chí và lỗi cần kiểm", { exact: true }).click();
    assert.ok((await page.locator(".cr-slide details li").count()) > 0);
    await page.getByLabel("Bước 2:", { exact: false }).click();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      ),
      false,
      "Mobile horizontal overflow",
    );
    await page
      .getByRole("tab", { name: "Hỏi giáo trình", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Giải thích ý chính của bài", exact: true })
      .click();
    const answerCard = page.locator(".cr-answer-card").first();
    await answerCard.waitFor();
    assert.ok(
      await answerCard
        .getByRole("heading", { name: "Đọc trong giáo trình" })
        .isVisible(),
    );
    assert.ok((await answerCard.locator(".cr-answer-video").count()) > 0);
    if (track === "solidworks")
      assert.ok(
        (await answerCard.locator(".cr-video-metadata").innerText()).includes(
          "Tiếng Việt",
        ),
      );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      ),
      false,
      "Mobile Q&A overflow",
    );
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      (document.activeElement as HTMLElement)?.blur();
    });
    await page.screenshot({
      path: path.join(out, track + "-mobile.png"),
      fullPage: true,
    });
    const pdf = await page.request.get(
      config.url + `/api/classroom/${track}/handbook`,
    );
    assert.equal(pdf.status(), 200);
    assert.ok((await pdf.body()).subarray(0, 5).equals(Buffer.from("%PDF-")));
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  checks.push(
    "All three subjects: desktop/mobile layout and private PDF download",
  );
  for (const base of ["nhung-c", "kicad", "solidworks"]) {
    await page.goto(config.url + `/${base}/tai-lieu`);
    const card = page.locator(".cr-handbook-card");
    await card.waitFor();
    assert.equal(new URL(page.url()).pathname, `/${base}/lop-hoc`);
    assert.equal(new URL(page.url()).searchParams.get("tab"), "resources");
    assert.ok(
      await card
        .getByRole("link", { name: "Tải giáo trình v6", exact: true })
        .isVisible(),
    );
  }
  checks.push(
    "Legacy materials routes lead to v6 resources inside each classroom",
  );
  await page.goto(config.url + "/kicad/lop-hoc");
  await page.locator(".cr-modules").waitFor();
  await page.screenshot({
    path: path.join(out, "catalog-desktop.png"),
    fullPage: true,
  });
  await classroomNavigationBrowser(page, config.url, out, checks, env.password);
  await solidworksVideosBrowser(page, config.url, out, checks);
  assert.deepEqual(errors, []);
  await fs.writeFile(
    path.join(out, "verification.json"),
    JSON.stringify({ checks, errors, status: "passed" }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors, status: "passed" }, null, 2));
} finally {
  await env.stop();
}
