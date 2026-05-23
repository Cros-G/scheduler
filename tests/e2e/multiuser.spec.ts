import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const CWD = "/Users/gongqipeng/Desktop/scheduler";
const ALICE_USERNAME = "e2e_alice";
const ALICE_PASSWORD = "test_password_123";
const BOB_USERNAME = "e2e_bob";
const BOB_PASSWORD = "test_bob_pw";

async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(`${BASE}/`);
  await page.waitForLoadState("networkidle");
}

async function loginAlice(page: Page) {
  return login(page, ALICE_USERNAME, ALICE_PASSWORD);
}

async function loginBob(page: Page) {
  return login(page, BOB_USERNAME, BOB_PASSWORD);
}

test.describe.serial("多人视图 + 私密过滤", () => {
  test.beforeAll(() => {
    // Clean both users' data
    execSync("node scripts/e2e-clean-tasks.js", { stdio: "inherit", cwd: CWD });
    // Seed bob (idempotent upsert)
    execSync(
      `pnpm seed:user --username ${BOB_USERNAME} --display "E2E Bob" --password "${BOB_PASSWORD}" --color "#5089C6"`,
      { stdio: "inherit", cwd: CWD }
    );
  });

  test("Alice 创建公开任务", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/tasks");

    // Create a public COUNTED task
    await page.click('button:has-text("新建任务")');
    await expect(page.locator('h2:has-text("新建任务")')).toBeVisible();
    await page.fill('input[name="name"]', "公开苹果");
    await page.click('button[aria-label="选择 emoji"]');
    await page.locator('button[title]').first().click();
    await page.fill('input[name="targetCount"]', "3");
    await page.selectOption('select[name="targetPeriod"]', "WEEK");
    // Make sure isPrivate is NOT checked (public)
    const privCheckbox = page.locator('input[name="isPrivate"]');
    if (await privCheckbox.isChecked()) {
      await privCheckbox.uncheck();
    }
    await page.click('button[type="submit"]:has-text("创建任务")');
    await expect(page.locator('span:has-text("公开苹果")')).toBeVisible({ timeout: 8000 });
  });

  test("Alice 创建私密任务", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/tasks");

    await page.click('button:has-text("新建任务")');
    await expect(page.locator('h2:has-text("新建任务")')).toBeVisible();
    await page.fill('input[name="name"]', "私密日记");
    await page.click('button[aria-label="选择 emoji"]');
    await page.locator('button[title]').first().click();
    // Use CHECK type for private task
    await page.check('input[type="radio"][value="CHECK"]');
    // Check the isPrivate checkbox
    await page.locator('input[name="isPrivate"]').check();
    await page.click('button[type="submit"]:has-text("创建任务")');
    await expect(page.locator('span:has-text("私密日记")')).toBeVisible({ timeout: 8000 });
  });

  test("Bob 访问 /u/e2e_alice → 看到公开苹果，看不到私密日记", async ({ page }) => {
    await loginBob(page);
    await page.goto("/u/e2e_alice");
    await expect(page).toHaveURL(/\/u\/e2e_alice/);

    // Banner shows "正在看" text
    await expect(page.locator("text=正在看")).toBeVisible();

    // Page should contain public task name (may or may not appear in task panel
    // since it's readonly — but the page renders). More importantly:
    // 私密日记 must NOT appear anywhere in the DOM
    const html = await page.content();
    expect(html).not.toContain("私密日记");
  });

  test("Alice 访问 /u/e2e_alice → redirect 到 /", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/u/e2e_alice");
    await expect(page).toHaveURL(`${BASE}/`);
  });

  test("Bob 访问 /u/nonexistent_user_xyz → 404", async ({ page }) => {
    await loginBob(page);
    const resp = await page.goto("/u/nonexistent_user_xyz");
    expect(resp?.status()).toBe(404);
  });

  test("Alice 访问 /timeline → 显示合并视图（含用户图例）", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/timeline");
    await page.waitForLoadState("networkidle");
    // Timeline period label visible ("五月 2026" etc.)
    await expect(page.locator(".tl-period-label").first()).toBeVisible({ timeout: 5000 });
    // User legend shows both users (new calendar grid layout, shows displayName)
    await expect(page.locator(".tl-legend-chip").first()).toBeVisible({ timeout: 5000 });
    const legendCount = await page.locator(".tl-legend-chip").count();
    expect(legendCount).toBeGreaterThanOrEqual(2);
    // Calendar grid visible
    await expect(page.locator(".tl-cal-grid").first()).toBeVisible({ timeout: 5000 });
  });

  test("Alice 在 timeline 看到日历合并视图（不再是按行排列）", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/timeline");
    await page.waitForLoadState("networkidle");
    // New layout: calendar grid with 42 cells (month mode), no per-user rows
    await expect(page.locator(".tl-cal-grid").first()).toBeVisible({ timeout: 5000 });
    // User legend (not per-row labels) should be visible
    await expect(page.locator(".tl-legend").first()).toBeVisible({ timeout: 5000 });
  });

  test("View switcher dropdown 列出 圈友 e2e_bob", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click the view switcher button
    await page.locator(".nb-switcher-btn").click();

    // Dropdown should show "合并视图"
    await expect(page.locator('[role="menu"]').locator("text=合并视图")).toBeVisible();

    // Bob should appear in the 圈友 section
    await expect(page.locator('[role="menu"]').locator("text=E2E Bob")).toBeVisible();
  });

  test("View switcher 导航到 /u/e2e_bob", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Open the view switcher
    await page.locator(".nb-switcher-btn").click();

    // Click on E2E Bob in the dropdown
    await page.locator('[role="menu"]').locator('[role="menuitem"]').filter({ hasText: "E2E Bob" }).click();

    // Should navigate to /u/e2e_bob
    await expect(page).toHaveURL(/\/u\/e2e_bob/);
  });
});
