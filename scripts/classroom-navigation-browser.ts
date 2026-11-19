import assert from "node:assert/strict";
import path from "node:path";
import type { Page } from "playwright";

export async function classroomNavigationBrowser(
  page: Page,
  url: string,
  out: string,
  checks: string[],
  password: string,
) {
  await page.goto(url + "/tai-khoan");
  await page.locator('.progress-row[href="/nhung-c/lop-hoc/cb01"]').waitFor();
  // The preceding journey already exercises one account extensively. Use the second
  // seeded administrator for this independent navigation journey, keeping real rate limits.
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page.waitForURL(url + "/");
  await page.goto(url + "/dang-nhap");
  await page.getByLabel("Email", { exact: true }).fill("two@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.waitForURL(url + "/quan-tri");
  await page.goto(url + "/");
  await page.locator(".hub-subject-card").nth(2).waitFor();
  for (const count of [32, 44, 24])
    assert.ok(
      (await page.locator(".hub-home-grid").innerText()).includes(
        `${count} bài trong giáo trình`,
      ),
    );
  await page.goto(url + "/hoc-thu");
  await page.locator(".cr-trial-list a").nth(5).waitFor();
  assert.equal(await page.locator(".cr-trial-list a").count(), 6);
  for (const href of await page
    .locator(".cr-trial-list a")
    .evaluateAll((a) => a.map((n) => n.getAttribute("href"))))
    assert.ok(href?.includes("/lop-hoc/"));
  for (const [base, count] of [
    ["nhung-c", 32],
    ["kicad", 44],
    ["solidworks", 24],
  ] as const) {
    for (const suffix of ["", "/tong-quan", "/bai-hoc"]) {
      await page.goto(`${url}/${base}${suffix}`);
      await page.waitForURL((u) => u.pathname === `/${base}/lop-hoc`);
      await page
        .locator(".cr-lesson-link")
        .nth(count - 1)
        .waitFor()
        .catch(async (error) => {
          console.log(
            "NAVIGATION_FAILURE",
            page.url(),
            "count",
            await page.locator(".cr-lesson-link").count(),
            (await page.locator("main").innerText()).slice(0, 1600),
          );
          throw error;
        });
      assert.equal(await page.locator(".cr-lesson-link").count(), count);
      assert.deepEqual(
        await page
          .getByRole("navigation", { name: "Menu chính", exact: true })
          .locator("a")
          .allTextContents(),
        ["Lớp học", "Thực hành"],
      );
      assert.equal(await page.locator(".subject-tabs a").count(), 2);
    }
    await page.goto(`${url}/${base}/tai-lieu`);
    await page.waitForURL(
      (u) =>
        u.pathname === `/${base}/lop-hoc` &&
        u.searchParams.get("tab") === "resources",
    );
    await page.locator(".cr-handbook-card").waitFor();
    assert.equal(
      await page.locator(".hub-material, .hub-lesson-card").count(),
      0,
    );
    assert.equal(
      await page
        .getByRole("link", { name: "Tải giáo trình v6", exact: true })
        .count(),
      1,
    );
    await page.getByRole("tab", { name: "Lộ trình học", exact: true }).click();
    await page
      .locator(".cr-lesson-link")
      .nth(count - 1)
      .waitFor()
      .catch(async (error) => {
        console.log(
          "NAVIGATION_FAILURE",
          page.url(),
          "count",
          await page.locator(".cr-lesson-link").count(),
          (await page.locator("main").innerText()).slice(0, 1600),
        );
        throw error;
      });
    await page.getByLabel("Lọc quyền học").selectOption("free");
    assert.equal(await page.locator(".cr-lesson-link").count(), 2);
    await page.getByLabel("Lọc quyền học").selectOption("all");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      ),
      false,
    );
    await page.screenshot({
      path: path.join(out, `${base}-unified-mobile.png`),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto(url + "/kicad/tai-lieu?q=impedance&tab=old");
  await page
    .getByRole("tab", { name: "Video & giáo trình PDF", selected: true })
    .waitFor();
  assert.equal(new URL(page.url()).searchParams.get("q"), "impedance");
  await page.getByLabel("Đổi môn", { exact: true }).selectOption("solidworks");
  await page.waitForURL(
    (u) =>
      u.pathname === "/solidworks/lop-hoc" &&
      u.searchParams.get("tab") === "resources",
  );
  await page.locator(".cr-handbook-card").waitFor();
  await page.goto(url + "/kicad/lop-hoc");
  await page.getByLabel("Tìm bài trong môn", { exact: true }).fill("impedance");
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).click();
  await page.waitForURL((u) => u.searchParams.get("q") === "impedance");
  await page.locator(".cr-lesson-link").first().waitFor();
  assert.equal(
    await page.getByLabel("Tìm trong lớp học").inputValue(),
    "impedance",
  );
  assert.ok((await page.locator(".cr-lesson-link").count()) < 44);
  for (const [base, id] of [
    ["nhung-c", "c01"],
    ["solidworks", "s01"],
  ]) {
    await page.goto(`${url}/${base}/thuc-hanh/${id}`);
    const link = page.getByRole("link", {
      name: `Ôn bài ${id.toUpperCase()} trong lớp học`,
      exact: false,
    });
    await link.waitFor();
    assert.equal(await link.getAttribute("href"), `/${base}/lop-hoc/${id}`);
  }
  await page.goto(url + "/kicad/lop-hoc?tab=resources");
  await page.locator(".cr-handbook-card").waitFor();
  await page.getByLabel("Lọc loại nguồn").selectOption("kicad");
  await page.screenshot({
    path: path.join(out, "unified-resources-desktop.png"),
    fullPage: true,
  });
  checks.push(
    "Unified curricula: two main sections, 32/44/24 lessons, six current previews, old URL redirects, PDF resources, search, subject switch, practice links and account progress",
  );
}
