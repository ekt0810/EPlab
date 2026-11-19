import type { Page } from "playwright";
import assert from "node:assert/strict";
import path from "node:path";
export async function pathwayConversationBrowser({
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
  async function pace(p: Page) {
    const r = await p.request.get(base + "/api/auth/me"),
      h = r.headers();
    if (Number(h["x-ratelimit-remaining"] ?? 180) < 120) {
      let ms = (Number(h["x-ratelimit-reset"] || 60) + 1) * 1000;
      while (ms > 0) {
        const part = Math.min(ms, 30000);
        await new Promise((r) => setTimeout(r, part));
        ms -= part;
      }
    }
  }
  for (const track of [
    { base: "nhung-c", id: "c09" },
    { base: "kicad", id: "e12" },
    { base: "solidworks", id: "s12" },
  ]) {
    await Promise.all([pace(page), pace(admin)]);
    await page.goto(`${base}/${track.base}/thuc-hanh`);
    await page.locator(".practice-exercise-card").first().waitFor();
    assert.equal(await page.locator(".practice-exercise-card").count(), 12);
    assert.equal(await page.locator(".pathway-level").count(), 3);
    assert.ok(
      (await page.locator(".pathway-levels").innerText()).includes(
        "1/4 bài đã đạt",
      ),
    );
    for (const level of ["basic", "intermediate", "advanced"]) {
      await page.getByLabel("Mức độ", { exact: true }).selectOption(level);
      await page.waitForFunction(
        () => document.querySelectorAll(".practice-exercise-card").length === 4,
      );
    }
    await page.screenshot({
      path: path.join(out, track.base + "-advanced-path.png"),
      fullPage: true,
    });
    await page
      .locator(`a[href="/${track.base}/thuc-hanh/${track.id}"]`)
      .click();
    await page.locator(".pathway-prerequisites").waitFor();
    await page
      .getByRole("link", { name: "Trao đổi với người chủ trì", exact: true })
      .click();
    await page.locator(".conversation-create").waitFor();
    await page
      .getByLabel("Bài cần trao đổi", { exact: true })
      .selectOption(track.id);
    const subject = `Câu hỏi ${track.id} của ${email}`;
    await page.getByLabel("Chủ đề", { exact: true }).fill(subject);
    await page
      .getByLabel("Câu hỏi", { exact: true })
      .fill("Tôi cần làm rõ bằng chứng cho phần kiểm tra nâng cao.");
    await page
      .getByRole("button", { name: "Gửi câu hỏi", exact: true })
      .click();
    await page.locator(".conversation-thread").waitFor();
    assert.ok(
      (await page.locator(".conversation-messages").innerText()).includes(
        "Người tham gia",
      ),
    );
    await admin.goto(`${base}/quan-tri/${track.base}`);
    await admin.getByRole("button", { name: "Trao đổi", exact: true }).click();
    await admin
      .locator(".conversation-item")
      .filter({ hasText: subject })
      .click();
    await admin.locator(".conversation-thread").waitFor();
    const answer =
      "Bạn hãy ghi kết quả thực tế theo từng ca và giải thích phần chưa đạt.";
    await admin.getByLabel("Nội dung tin nhắn", { exact: true }).fill(answer);
    await admin
      .getByRole("button", { name: "Gửi tin nhắn", exact: true })
      .click();
    await admin
      .locator(".conversation-message")
      .getByText(answer, { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Làm mới tin nhắn", exact: true })
      .click();
    await page
      .locator(".conversation-message")
      .getByText(answer, { exact: true })
      .waitFor();
    assert.equal(
      await page.locator(".conversation-message.host strong").innerText(),
      "Người chủ trì",
    );
    const literal = "<img src=x onerror=alert(1)> chỉ là văn bản để kiểm thử.";
    await page.getByLabel("Nội dung tin nhắn", { exact: true }).fill(literal);
    await page
      .getByRole("button", { name: "Gửi tin nhắn", exact: true })
      .click();
    await page
      .locator(".conversation-message")
      .getByText(literal, { exact: true })
      .waitFor();
    assert.equal(await page.locator(".conversation-message img").count(), 0);
    await admin
      .getByRole("button", { name: "Đánh dấu đã giải đáp", exact: true })
      .click();
    await admin
      .getByText("Cuộc trao đổi đã được giải đáp.", { exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Làm mới tin nhắn", exact: true })
      .click();
    await page
      .getByText("Cuộc trao đổi đã được giải đáp.", { exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: "Gửi tin nhắn", exact: true })
        .isDisabled(),
      true,
    );
    await page
      .getByRole("button", { name: "Tiếp tục trao đổi", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        !document.querySelector<HTMLButtonElement>(".conversation-reply button")
          ?.disabled,
    );
    await page.reload();
    await page
      .locator(".conversation-item")
      .filter({ hasText: subject })
      .click();
    await page
      .locator(".conversation-message")
      .getByText(answer, { exact: true })
      .waitFor();
    await page.screenshot({
      path: path.join(out, track.base + "-conversation-desktop.png"),
      fullPage: true,
    });
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
      path: path.join(out, track.base + "-conversation-mobile.png"),
      fullPage: true,
    });
    await page.setViewportSize({ width: 1440, height: 1050 });
    checks.push(
      `${track.base}: 4 basic/4 intermediate/4 advanced, own progress, private participant-host Q&A, resolve/reopen and literal HTML on desktop/mobile`,
    );
  }
}
