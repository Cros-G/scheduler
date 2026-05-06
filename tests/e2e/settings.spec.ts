import { test, expect, type Page } from "@playwright/test";

const BASE = "http://localhost:3000";

async function loginAlice(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="username"]', "e2e_alice");
  await page.fill('input[name="password"]', "test_password_123");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(`${BASE}/`);
  await page.waitForLoadState("networkidle");
}

test.describe.serial("/settings 设置", () => {
  test("设置页面加载正常", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.locator("h1")).toContainText("个人设置");
    // The display name input exists
    await expect(page.locator("#sf-displayName")).toBeVisible();
    // Save button exists
    await expect(page.locator('button.sf-btn-primary')).toContainText("保存");
  });

  test("改昵称后保存 → 再次打开设置页昵称已更新", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/settings");

    const input = page.locator('input[name="displayName"]');
    await input.fill("E2E Alicia");
    // Verify input value is set (confirms fill was applied)
    await expect(input).toHaveValue("E2E Alicia");
    // Select a valid color from the palette (alice may have been seeded with a non-palette color)
    await page.locator('.sf-color-dot').first().click();
    // Small wait to ensure React reconciliation completes
    await page.waitForTimeout(200);
    await page.click('button.sf-btn-primary');

    // The save button disables while saving, then re-enables when done
    await expect(page.locator('button.sf-btn-primary')).not.toBeDisabled({ timeout: 10000 });

    // Reload the settings page — server re-fetches from DB, input should reflect new name
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sf-displayName")).toHaveValue("E2E Alicia");

    // Reset for other suites
    const resetInput = page.locator('input[name="displayName"]');
    await resetInput.fill("E2E Alice");
    await expect(resetInput).toHaveValue("E2E Alice");
    // Ensure a valid palette color is selected
    await page.locator('.sf-color-dot').first().click();
    await page.waitForTimeout(200);
    await page.click('button.sf-btn-primary');
    await expect(page.locator('button.sf-btn-primary')).not.toBeDisabled({ timeout: 10000 });
    // Verify reset
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("#sf-displayName")).toHaveValue("E2E Alice");
  });

  test("空昵称 → 服务器返回报错", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/settings");
    const input = page.locator('input[name="displayName"]');
    await input.fill("");
    // Select a valid color so only the name triggers the error
    await page.locator('.sf-color-dot').first().click();
    await page.waitForTimeout(200);
    await page.click('button.sf-btn-primary');
    // Server-side validation: "昵称不能为空" error banner (exclude Next.js route announcer)
    const errorAlert = page.locator('[role="alert"]:not([aria-live])');
    await expect(errorAlert).toBeVisible({ timeout: 8000 });
    await expect(errorAlert).toContainText("昵称不能为空");
    // URL stays on settings
    await expect(page).toHaveURL(/\/settings/);
    // Restore
    await input.fill("E2E Alice");
  });

  test("设置 nav 链接 active", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/settings");
    const activeLink = page.locator('a[aria-current="page"]').filter({ hasText: "设置" }).first();
    await expect(activeLink).toBeVisible();
  });
});
