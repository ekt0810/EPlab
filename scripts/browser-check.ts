import { practiceBrowser } from "./practice-browser.js";
import { handbookBrowser } from "./handbook-browser.js";
import { coursePracticeBrowser } from "./course-practice-browser.js";
import { pathwayConversationBrowser } from "./pathway-conversation-browser.js";
import type { Page } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { startBrowserEnvironment } from "./browser-environment.js";
const { pool, config, password, browser, stop } =
  await startBrowserEnvironment();
const { textbookSha256 } =
  await import("../apps/api/src/content/install-solidworks-textbook.js");
const { solidworksTextbook } =
  await import("../apps/api/src/content/solidworks-textbook.js");
const errors: string[] = [];
const checks: string[] = [];
const out = path.join(config.root, "test-results");
await fs.mkdir(out, { recursive: true });
await fs.writeFile(
  path.join(out, "browser-check.json"),
  JSON.stringify({ checkedAt: new Date().toISOString(), status: "running" }),
);
const assertVisible = async (page: Page, text: string) =>
  page.getByText(text, { exact: false }).first().waitFor({ timeout: 15000 });
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) =>
    console.log("BROWSER_REQUEST_FAILED", r.url(), r.failure()?.errorText),
  );
  await page.goto(config.url);
  await page.waitForFunction(
    () => document.querySelectorAll(".hub-subject-card").length === 3,
  );
  checks.push("Desktop: three real course cards");
  await page.goto(config.url + "/hoc-thu");
  await page.waitForFunction(
    () => document.querySelectorAll(".cr-trial-list li").length === 6,
  );
  checks.push("Six previews from the current three classroom curricula");
  await page.goto(config.url + "/bai-hoc/chi-tiet-solidworks-dau-tien");
  await page.locator(".document-card").waitFor();
  assert.equal(await page.locator("iframe, .video-box").count(), 0);
  assert.equal(
    await page.getByRole("link", { name: "Tải PDF", exact: true }).count(),
    0,
  );
  await page
    .getByRole("link", { name: "Xem giáo trình đầy đủ", exact: false })
    .click();
  await assertVisible(page, "Mở nội dung đầy đủ");
  checks.push(
    "SOLIDWORKS guest introduction uses textbook UI without a video; full PDF remains locked",
  );

  const email = `browser-${Date.now()}@example.test`;
  await page.goto(config.url + "/dang-ky");
  await page.getByLabel("Tên của bạn").fill("Người tham gia kiểm thử");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page
    .getByLabel("Số điện thoại / Zalo", { exact: true })
    .fill("0900000010");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Tạo tài khoản miễn phí", exact: true })
    .click();
  await assertVisible(page, "Nếu email đủ điều kiện");
  let token = "";
  for (const file of (
    await fs.readdir(path.join(config.data, "mail"))
  ).reverse()) {
    const mail = JSON.parse(
      await fs.readFile(path.join(config.data, "mail", file), "utf8"),
    );
    if (mail.to === email) {
      token = mail.text.match(/#token=([a-f0-9]{64})/)[1];
      break;
    }
  }
  assert.ok(token);
  await page.goto(config.url + "/xac-minh#token=" + token);
  await page
    .getByRole("button", { name: "Xác minh email", exact: true })
    .click();
  await assertVisible(page, "Email đã xác minh");
  checks.push("Browser registration and single-use email verification");
  await page.goto(config.url + "/dang-nhap");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(config.url + "/");
  await page.goto(config.url + "/tai-khoan");
  await assertVisible(page, "Chào Người tham gia kiểm thử");
  const trial = (
    await pool.query(
      "SELECT slug FROM lessons WHERE preview ORDER BY slug LIMIT 1",
    )
  ).rows[0].slug;
  await page.goto(config.url + "/bai-hoc/" + trial);
  await page
    .getByRole("button", { name: "Ghi chú của tôi", exact: true })
    .click();
  await page
    .getByLabel("Ghi chú riêng")
    .fill(
      "Ghi chú kiểm thử trình duyệt — không phải dữ liệu người tham gia thật.",
    );
  await page
    .getByRole("button", { name: "Lưu ghi chú riêng", exact: true })
    .click();
  await assertVisible(page, "Đã lưu tiến độ");
  await page.reload();
  await page
    .getByRole("button", { name: "Ghi chú của tôi", exact: true })
    .click();
  assert.ok(
    (await page.getByLabel("Ghi chú riêng").inputValue()).includes("kiểm thử"),
  );
  checks.push("Private notes survive reload");
  const locked = (
    await pool.query(
      "SELECT slug FROM lessons WHERE status='published' AND NOT preview LIMIT 1",
    )
  ).rows[0].slug;
  await page.goto(config.url + "/bai-hoc/" + locked);
  await assertVisible(page, "Mở nội dung đầy đủ");
  checks.push("Pending learner sees locked lesson");
  await page.goto(config.url + "/tham-gia-lab");
  await page
    .getByLabel("Mục tiêu học tập", { exact: true })
    .fill("Kiểm thử học và thực hành ba môn trong môi trường riêng.");
  await page
    .getByRole("button", { name: "Gửi yêu cầu tham gia Lab", exact: true })
    .click();
  await assertVisible(page, "Yêu cầu đã được lưu");
  checks.push("Free learner submits a Lab membership request without payment");
  const adminContext = await browser.newContext({
    viewport: { width: 1440, height: 1050 },
  });
  const admin = await adminContext.newPage();
  admin.on("pageerror", (e) => errors.push(e.message));
  await admin.goto(config.url + "/dang-nhap");
  await admin.getByLabel("Email", { exact: true }).fill("two@example.test");
  await admin.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await admin.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await admin.waitForURL(config.url + "/quan-tri");
  assert.equal(
    (await admin.request.get(config.url + "/api/auth/me")).status(),
    200,
  );
  await admin.goto(
    config.url + "/solidworks/bai-hoc/eplab-giao-trinh-solidworks-v5",
  );
  await admin.waitForURL("**/bai-hoc/eplab-giao-trinh-solidworks-v5");
  await admin.locator(".handbook-chapters li").nth(11).waitFor();
  checks.push(
    "SOLIDWORKS current subject route opens the v5 participant handbook",
  );
  await admin.goto(config.url + "/tai-khoan?tab=security");
  await admin
    .getByRole("button", { name: "Thiết lập xác thực hai bước", exact: true })
    .waitFor();
  checks.push(
    "Account security deep link opens Vietnamese two-step setup without handling real secrets",
  );
  await admin.goto(config.url + "/bai-hoc/solidworks-thuc-hanh");
  await admin.locator(".document-card").waitFor();
  assert.equal(await admin.locator("iframe, .video-box").count(), 0);
  const pdfLink = admin.getByRole("link", {
    name: "Mở giáo trình",
    exact: true,
  });
  const pdfHref = await pdfLink.getAttribute("href");
  assert.ok(pdfHref?.endsWith("/view#page=1"));
  const pdfResponse = await adminContext.request.get(config.url + pdfHref);
  assert.equal(pdfResponse.status(), 200);
  assert.equal(pdfResponse.headers()["content-type"], "application/pdf");
  const pdfHash = textbookSha256;
  assert.equal(
    createHash("sha256")
      .update(await pdfResponse.body())
      .digest("hex"),
    pdfHash,
  );
  const popupPromise = admin.waitForEvent("popup");
  await pdfLink.click();
  const pdfPage = await popupPromise;
  await pdfPage.waitForLoadState("domcontentloaded");
  assert.ok(pdfPage.url().includes("/view#page=1"));
  // Native PDF rendering finishes after DOMContentLoaded; allow the browser viewer to paint.
  await pdfPage.waitForTimeout(2500);
  await pdfPage.screenshot({
    path: path.join(out, "solidworks-pdf-viewer.png"),
  });
  await pdfPage.close();
  const downloadPromise = admin.waitForEvent("download");
  await admin.getByRole("link", { name: "Tải PDF", exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), solidworksTextbook.fileName);
  assert.equal(
    createHash("sha256")
      .update(await fs.readFile((await download.path())!))
      .digest("hex"),
    pdfHash,
  );
  await admin.screenshot({
    path: path.join(out, "solidworks-textbook-desktop.png"),
    fullPage: true,
  });
  checks.push(
    "Admin opens SOLIDWORKS PDF in a new tab and downloads the exact original textbook without payment",
  );

  const draft = (
    await pool.query(
      "SELECT l.slug,l.title,c.id AS course_id,c.slug AS course_slug,c.status AS course_status,c.category FROM lessons l JOIN chapters ch ON ch.id=l.chapter_id JOIN courses c ON c.id=ch.course_id WHERE l.status='draft' AND l.content!='' LIMIT 1",
    )
  ).rows[0];
  await pool.query("UPDATE courses SET status='draft' WHERE id=$1", [
    draft.course_id,
  ]);
  try {
    const base = draft.category === "embedded" ? "nhung-c" : draft.category;
    await admin.goto(config.url + "/" + base + "/bai-hoc/" + draft.slug);
    assert.equal(await admin.locator('a[href="/kich-hoat"]').count(), 0);
    await admin.locator(".lesson-content").waitFor();
    await assertVisible(admin, "Bạn đang xem bản nháp");
    await admin.locator(".lesson-outline a").first().waitFor();
    await admin.screenshot({
      path: path.join(out, "admin-draft-access.png"),
      fullPage: true,
    });
  } finally {
    await pool.query("UPDATE courses SET status=$1 WHERE id=$2", [
      draft.course_status,
      draft.course_id,
    ]);
  }
  await admin.goto(config.url + "/quan-tri");
  await admin.getByRole("button", { name: "Bài học", exact: true }).click();
  await admin
    .getByRole("link", { name: "Xem " + draft.title, exact: true })
    .click();
  await admin.locator(".lesson-content").waitFor();
  await assertVisible(admin, "Quyền chủ trì: xem toàn bộ bài học miễn phí.");
  checks.push(
    "Admin opens draft course, its full outline and draft lesson directly from management without payment",
  );
  await admin.goto(config.url + "/quan-tri");
  await admin
    .getByRole("button", { name: "Tham gia Lab", exact: true })
    .click();
  const request = admin.locator("article").filter({ hasText: email });
  await request
    .getByRole("button", { name: "Xét duyệt yêu cầu", exact: true })
    .click();
  await request
    .getByLabel("Phản hồi cho học viên", { exact: true })
    .fill("Đã duyệt tài khoản kiểm thử, không thu phí.");
  await request
    .getByRole("button", { name: "Duyệt và cấp quyền", exact: true })
    .click();
  await request.waitFor({ state: "hidden" });
  assert.equal(
    (await pool.query("SELECT count(*)::int AS n FROM orders")).rows[0].n,
    0,
  );
  await admin.screenshot({
    path: path.join(out, "admin-membership-desktop.png"),
    fullPage: true,
  });
  checks.push(
    "Admin approves free Lab access through UI without creating any order",
  );
  await page.goto(config.url + "/bai-hoc/" + locked);
  await page.locator(".lesson-content").waitFor();
  await page
    .getByRole("button", { name: "Hoàn thành bài học", exact: true })
    .click();
  await assertVisible(page, "Bạn đã hoàn thành bài này");
  checks.push("Activated learner opens and completes premium lesson");
  await handbookBrowser({ page, admin, base: config.url, out, checks });
  await practiceBrowser({ page, admin, email, base: config.url, out, checks });
  await coursePracticeBrowser({
    page,
    admin,
    email,
    base: config.url,
    out,
    checks,
  });
  await pathwayConversationBrowser({
    page,
    admin,
    email,
    base: config.url,
    out,
    checks,
  });
  await page.goto(config.url + "/bai-hoc/solidworks-lo-trinh-5");
  await page.locator(".document-card").waitFor();
  await assertVisible(page, "trang 20–25");
  assert.ok(
    (
      await page
        .getByRole("link", { name: "Mở giáo trình", exact: true })
        .getAttribute("href")
    )?.endsWith("#page=20"),
  );
  assert.equal(await page.locator("iframe, .video-box").count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () =>
      document.querySelector(".sidebar")!.getBoundingClientRect().right <= 0,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({
    path: path.join(out, "solidworks-textbook-mobile.png"),
    fullPage: true,
  });
  checks.push(
    "Activated learner reads the Sweep/Loft section at page 20; textbook UI fits 390px without video",
  );

  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    deviceScaleFactor: 1,
  });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(config.url);
  await mobile.waitForFunction(
    () => document.querySelectorAll(".hub-subject-card").length === 3,
  );
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await mobile.screenshot({
    path: path.join(out, "home-mobile.png"),
    fullPage: true,
  });
  await mobile.getByRole("button", { name: "Mở menu", exact: true }).click();
  await mobile
    .getByRole("link", { name: "Học thử miễn phí", exact: true })
    .click();
  await mobile.waitForURL("**/hoc-thu");
  await mobile.waitForFunction(
    () => document.querySelectorAll(".cr-trial-list li").length === 6,
  );
  await mobile.locator(".cr-trial-list a").first().click();
  await mobile.waitForURL("**/lop-hoc/**");
  await mobile.locator(".cr-slide").waitFor();
  assert.equal(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await mobile.screenshot({
    path: path.join(out, "lesson-mobile.png"),
    fullPage: true,
  });
  checks.push(
    "390px mobile navigation, current classroom previews and lesson without horizontal overflow",
  );
  assert.deepEqual(errors, []);
  checks.push("No JavaScript page errors");
  console.log(
    JSON.stringify(
      { passed: checks.length, checks, pageErrors: errors },
      null,
      2,
    ),
  );
  await fs.writeFile(
    path.join(out, "browser-check.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        status: "passed",
        passed: checks.length,
        checks,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
} catch (error) {
  for (const ctx of browser.contexts())
    for (const p of ctx.pages()) {
      console.log(
        "FAILURE_PAGE",
        p.url(),
        (
          await p
            .locator("body")
            .innerText()
            .catch(() => "")
        ).slice(0, 2500),
      );
      await p
        .screenshot({
          path: path.join(out, "browser-failure.png"),
          fullPage: true,
        })
        .catch(() => {});
    }
  await fs.writeFile(
    path.join(out, "browser-check.json"),
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        status: "failed",
        checks,
        pageErrors: errors,
        error: String(error),
      },
      null,
      2,
    ),
  );
  throw error;
} finally {
  await stop();
}
