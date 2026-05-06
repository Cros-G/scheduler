import { test, expect, Page } from "@playwright/test";
import { execSync } from "node:child_process";

const TEST_USERNAME = "e2e_alice";
const TEST_PASSWORD = "test_password_123";
const BASE = "http://localhost:3000";

// 1×1 transparent PNG, 67 bytes
const TINY_PNG_BYTES = Buffer.from(
  "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000158a72f8d0000000049454e44ae426082",
  "hex"
);

async function loginAsAlice(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="username"]', TEST_USERNAME);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(`${BASE}/`);
  await page.waitForLoadState("networkidle");
}

async function openTodaySheet(page: Page) {
  // mv-view-btn has opacity:0 by default; hover the today cell first to reveal it
  const todayCell = page.locator(".mv-day-cell.today");
  await todayCell.hover();
  await todayCell.locator(".mv-view-btn").click();
  // Wait for the sheet panel to render
  await expect(page.locator('.sheet-panel[role="dialog"]')).toBeVisible({ timeout: 5000 });
}

async function closeSheet(page: Page) {
  await page.locator('button.sheet-close-btn[aria-label="关闭"]').click();
}

test.describe.serial("心声 + 图片上传流程", () => {
  test.beforeAll(() => {
    execSync("node scripts/e2e-clean-tasks.js", {
      stdio: "inherit",
      cwd: "/Users/gongqipeng/Desktop/scheduler",
    });
  });

  test("打开今天日详情，看到心声编辑器（空）", async ({ page }) => {
    await loginAsAlice(page);
    await openTodaySheet(page);

    // Textarea exists and is empty
    const textarea = page.locator("textarea.ne-textarea");
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue("");

    // Counter shows 0/10000
    await expect(page.locator(".ne-char-counter")).toContainText("0/10000");

    // Upload "+" button is visible
    await expect(page.locator('button.ne-upload-btn[aria-label="上传图片"]')).toBeVisible();
  });

  test("输入文本，保存后再打开仍在", async ({ page }) => {
    await loginAsAlice(page);
    await openTodaySheet(page);

    const textarea = page.locator("textarea.ne-textarea");
    await textarea.fill("今天试一下心声功能");

    // Save button should be enabled (content is dirty)
    const saveBtn = page.locator("button.ne-save-btn");
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // Wait for save to complete: label changes to "已保存" when action succeeds
    await expect(saveBtn).toContainText("已保存", { timeout: 8000 });
    // Then wait for RSC refresh to settle
    await page.waitForLoadState("networkidle");

    // Close sheet (no confirm needed since dirty=false)
    await closeSheet(page);
    await expect(page.locator('.sheet-panel[role="dialog"]')).not.toBeVisible({ timeout: 5000 });

    // Reopen
    await openTodaySheet(page);

    // Content should persist
    await expect(page.locator("textarea.ne-textarea")).toHaveValue("今天试一下心声功能", { timeout: 5000 });
  });

  test("月视图格子显示心声 ✎ 指示", async ({ page }) => {
    await loginAsAlice(page);
    // Today's cell should have the .mv-note-indicator (has note from prior test)
    await expect(page.locator(".mv-day-cell.today .mv-note-indicator")).toBeVisible({ timeout: 5000 });
  });

  test("上传一张 PNG，缩略图出现", async ({ page }) => {
    await loginAsAlice(page);
    await openTodaySheet(page);

    // Locate hidden file input inside the editor
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles({
      name: "tiny.png",
      mimeType: "image/png",
      buffer: TINY_PNG_BYTES,
    });

    // Thumbnail appears (uploaded via /api/uploads)
    await expect(page.locator('img[src*="/api/uploads/"]').first()).toBeVisible({ timeout: 8000 });
  });

  test("删除上传的图片，缩略图消失", async ({ page }) => {
    await loginAsAlice(page);
    await openTodaySheet(page);

    // Should have 1 thumbnail from prior test
    const thumbs = page.locator('img[src*="/api/uploads/"]');
    await expect(thumbs).toHaveCount(1, { timeout: 5000 });

    // Hover over the thumbnail container so the × button becomes visible
    const thumbContainer = page.locator(".ne-img-thumb").first();
    await thumbContainer.hover();

    // Click the × delete button
    const deleteBtn = thumbContainer.locator("button.ne-img-delete");
    await expect(deleteBtn).toBeVisible({ timeout: 3000 });
    await deleteBtn.click();

    // Thumbnail removed
    await expect(thumbs).toHaveCount(0, { timeout: 8000 });
  });

  test("未保存修改尝试关闭 → 弹 confirm，可取消保留编辑状态", async ({ page }) => {
    await loginAsAlice(page);
    await openTodaySheet(page);

    const textarea = page.locator("textarea.ne-textarea");
    await textarea.fill("一段未保存的草稿");

    // Register dialog handler BEFORE triggering the close action
    let dialogShown = false;
    page.on("dialog", async (d) => {
      dialogShown = true;
      expect(d.message()).toContain("未保存");
      await d.dismiss(); // dismiss = stay open
    });

    // Click close — this should trigger the window.confirm
    await closeSheet(page);

    // Wait briefly for dialog handling
    await page.waitForTimeout(500);
    expect(dialogShown).toBe(true);

    // Sheet should still be open (user dismissed the confirm)
    await expect(page.locator('.sheet-panel[role="dialog"]')).toBeVisible();
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue("一段未保存的草稿");
  });
});
