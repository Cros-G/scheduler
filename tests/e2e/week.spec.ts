import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

const TEST_USERNAME = "e2e_alice";
const TEST_PASSWORD = "test_password_123";
const BASE = "http://localhost:3000";
const CWD = "/Users/gongqipeng/Desktop/scheduler";

async function loginAlice(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="username"]', TEST_USERNAME);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(`${BASE}/`);
  await page.waitForLoadState("networkidle");
}

test.describe.serial("/week 周视图", () => {
  test.beforeAll(() => {
    execSync("node scripts/e2e-clean-tasks.js", { stdio: "inherit", cwd: CWD });
  });

  test("访问 /week 显示当周 7 列", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/week");
    await expect(page).toHaveURL(/\/week/);
    // Today's cell should be visible and highlighted
    await expect(page.locator(".wv-day-cell.today")).toBeVisible();
    // Should have exactly 7 day cells
    const cells = page.locator(".wv-day-cell");
    await expect(cells).toHaveCount(7);
  });

  test("nav 周历 链接 active", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/week");
    // Active nav link uses aria-current="page" (matches both desktop + mobile, first() is fine)
    const activeLink = page.locator('a[aria-current="page"]').filter({ hasText: "周历" }).first();
    await expect(activeLink).toBeVisible();
  });

  test("创建任务并在周视图中记录", async ({ page }) => {
    await loginAlice(page);
    // Create a COUNTED task
    await page.goto("/tasks");
    await page.click('button:has-text("新建任务")');
    await expect(page.locator('h2:has-text("新建任务")')).toBeVisible();
    await page.fill('input[name="name"]', "测试周任务");
    // Icon: click emoji picker, pick something from first tab
    await page.click('button[aria-label="选择 emoji"]');
    // Pick the first emoji button available
    await page.locator('button[title]').first().click();
    await page.fill('input[name="targetCount"]', "3");
    await page.selectOption('select[name="targetPeriod"]', "WEEK");
    await page.click('button[type="submit"]:has-text("创建任务")');
    await expect(page.locator('span:has-text("测试周任务")')).toBeVisible({ timeout: 8000 });

    // Navigate to week view
    await page.goto("/week");
    await page.waitForLoadState("networkidle");

    // Task panel should show the task
    const taskRow = page.locator(".wv-task-row").filter({ hasText: "测试周任务" });
    await expect(taskRow).toBeVisible();

    // Select the task (click it)
    await taskRow.click();
    await expect(taskRow).toHaveAttribute("aria-selected", "true");

    // Click today's cell to add an occurrence
    await page.locator(".wv-day-cell.today").click();

    // Wait for icon chip to appear in today's cell
    await expect(page.locator(".wv-day-cell.today .wv-icon-chip")).toBeVisible({ timeout: 8000 });
  });

  test("Counted task 进度徽章显示", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/week");
    await page.waitForLoadState("networkidle");
    // Progress badge should show something like "1/3" for the counted task
    await expect(page.locator(".wv-progress-badge")).toContainText(/\d+\/3/);
  });
});
