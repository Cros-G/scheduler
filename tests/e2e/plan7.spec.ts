import { test, expect, type Page } from "@playwright/test";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const ALICE_USERNAME = "e2e_alice";
const ALICE_PASSWORD = "test_password_123";

async function loginAlice(page: Page) {
  await page.goto("/login");
  await page.fill('input[name="username"]', ALICE_USERNAME);
  await page.fill('input[name="password"]', ALICE_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(`${BASE}/`);
  await page.waitForLoadState("networkidle");
}

test.describe.serial("Plan 7: timeline period + emoji manage + stats", () => {
  test.beforeAll(() => {
    execSync("node scripts/e2e-clean-tasks.js", { stdio: "inherit", cwd: process.cwd() });
  });

  // ── Timeline period ──────────────────────────────────────────────

  test("timeline 默认月模式渲染 — .tl-period-label 可见", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/timeline");
    // .tl-period-label is the period heading ("五月 2026" etc.)
    await expect(page.locator(".tl-period-label").first()).toBeVisible({ timeout: 8000 });
    // New calendar grid: weekday headers are exactly 7 (Mon-Sun)
    const headerCells = page.locator(".tl-header-day-cell");
    const count = await headerCells.count();
    expect(count).toBe(7);
    // The calendar grid itself exists
    await expect(page.locator(".tl-cal-grid").first()).toBeVisible({ timeout: 8000 });
  });

  test("timeline period toggle 月/周 按钮存在", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/timeline");
    // .tl-period-toggle is the group; "月" and "周" are the two children
    const monthBtn = page.locator(".tl-toggle-btn").filter({ hasText: "月" });
    const weekBtn = page.locator(".tl-toggle-btn").filter({ hasText: "周" });
    await expect(monthBtn).toBeVisible({ timeout: 8000 });
    await expect(weekBtn).toBeVisible({ timeout: 8000 });
    // In default month mode, "月" button should have aria-pressed=true
    await expect(monthBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("timeline 直接加载 period=week → URL 含 period=week，7 列", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/timeline?period=week");
    await expect(page).toHaveURL(/period=week/);
    // Week mode renders exactly 7 weekday header cells with class week-header
    const weekHeaders = page.locator(".tl-header-day-cell.week-header");
    const count = await weekHeaders.count();
    expect(count).toBe(7);
    // Week mode renders 7 .tl-day-cell.week-cell
    const weekCells = page.locator(".tl-day-cell.week-cell");
    const cellCount = await weekCells.count();
    expect(cellCount).toBe(7);
    // "周" toggle button is active (aria-pressed=true)
    const weekBtn = page.locator(".tl-toggle-btn").filter({ hasText: "周" });
    await expect(weekBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("timeline 点击周按钮 → URL 切换为 period=week", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/timeline");
    // Click the "周" toggle button
    const weekBtn = page.locator(".tl-toggle-btn").filter({ hasText: "周" });
    await weekBtn.click();
    await expect(page).toHaveURL(/period=week/, { timeout: 8000 });
  });

  test("timeline 点击月按钮 → 回到月模式 (无 period=week)", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/timeline?period=week");
    // Click the "月" toggle button
    const monthBtn = page.locator(".tl-toggle-btn").filter({ hasText: "月" });
    await monthBtn.click();
    // URL should no longer contain period=week
    await expect(page).not.toHaveURL(/period=week/, { timeout: 8000 });
    // Month mode: exactly 7 weekday header cells (Mon-Sun)
    const headerCells = page.locator(".tl-header-day-cell");
    const count = await headerCells.count();
    expect(count).toBe(7);
    // Calendar grid visible
    await expect(page.locator(".tl-cal-grid").first()).toBeVisible({ timeout: 8000 });
  });

  // ── Emoji manage ─────────────────────────────────────────────────

  test("/settings/emojis 加载 — 标题 'Emoji 管理' 可见", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/settings/emojis");
    await expect(page).toHaveURL(/\/settings\/emojis/);
    // Page heading from .emm-heading
    await expect(page.locator(".emm-heading")).toBeVisible({ timeout: 8000 });
    await expect(page.locator(".emm-heading")).toContainText("Emoji 管理");
  });

  test("创建分类 → 新分类出现在列表", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/settings/emojis");
    // Click "新建分类" button (.emm-new-cat-btn)
    await page.locator(".emm-new-cat-btn").click();
    // Input appears with placeholder "分类名称…"
    const nameInput = page.locator('.emm-text-input[placeholder="分类名称…"]');
    await expect(nameInput).toBeVisible({ timeout: 5000 });
    await nameInput.fill("E2E 测试分类");
    // Click the "建" submit button (.emm-submit-btn)
    await page.locator(".emm-submit-btn").filter({ hasText: "建" }).click();
    // New category appears in the list (.emm-cat-name)
    await expect(page.locator(".emm-cat-name").filter({ hasText: "E2E 测试分类" })).toBeVisible({
      timeout: 8000,
    });
  });

  test("添加 emoji 到分类 (自定义输入 🍎)", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/settings/emojis");
    // Select the test category
    await page.locator(".emm-cat-name").filter({ hasText: "E2E 测试分类" }).click();
    // Click "添加 emoji" button (.emm-add-emoji-btn)
    const addBtn = page.locator(".emm-add-emoji-btn");
    await expect(addBtn).toBeVisible({ timeout: 5000 });
    await addBtn.click();
    // Dialog opens — use the custom text input (.emm-dialog-custom-input)
    const customInput = page.locator(".emm-dialog-custom-input");
    await expect(customInput).toBeVisible({ timeout: 5000 });
    await customInput.fill("🍎");
    // Click "添加" button in the dialog (.emm-dialog-add-btn)
    await page.locator(".emm-dialog-add-btn").click();
    // 🍎 appears in the emoji grid (.emm-emoji-tile)
    await expect(page.locator(".emm-emoji-tile").filter({ hasText: "🍎" }).first()).toBeVisible({
      timeout: 8000,
    });
  });

  test("删除分类 → 分类消失", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/settings/emojis");
    // Select the test category
    await page.locator(".emm-cat-name").filter({ hasText: "E2E 测试分类" }).click();
    // Register dialog handler BEFORE clicking delete
    page.on("dialog", (d) => d.accept());
    // Click "删除" button (.emm-delete-btn)
    await page.locator(".emm-delete-btn").click();
    // Category should disappear from the list
    await expect(
      page.locator(".emm-cat-name").filter({ hasText: "E2E 测试分类" })
    ).toHaveCount(0, { timeout: 8000 });
  });

  // ── Stats ─────────────────────────────────────────────────────────

  test("/stats 加载 (默认) — 概览卡片可见", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/stats");
    await expect(page).toHaveURL(/\/stats/);
    // Page title "统计" from .sv-page-title
    await expect(page.locator(".sv-page-title")).toBeVisible({ timeout: 8000 });
    await expect(page.locator(".sv-page-title")).toContainText("统计");
    // Overview section visible
    await expect(page.locator(".sv-overview")).toBeVisible({ timeout: 8000 });
  });

  test("/stats period toggle 年/月/周 按钮存在", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/stats");
    const yearBtn = page.locator(".sv-period-btn").filter({ hasText: "年" });
    const monthBtn = page.locator(".sv-period-btn").filter({ hasText: "月" });
    const weekBtn = page.locator(".sv-period-btn").filter({ hasText: "周" });
    await expect(yearBtn).toBeVisible({ timeout: 8000 });
    await expect(monthBtn).toBeVisible({ timeout: 8000 });
    await expect(weekBtn).toBeVisible({ timeout: 8000 });
  });

  test("/stats?period=year 加载 — 年视图 SVG 可见", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/stats?period=year");
    await expect(page).toHaveURL(/period=year/);
    // Year mode renders .sv-heatmap-year with an SVG
    await expect(page.locator(".sv-heatmap-year svg").first()).toBeVisible({ timeout: 8000 });
    // Year button should be active
    const yearBtn = page.locator(".sv-period-btn").filter({ hasText: "年" });
    await expect(yearBtn).toHaveAttribute("data-active", "true");
  });

  test("/stats?period=week 加载 — 周热力图可见", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/stats?period=week");
    await expect(page).toHaveURL(/period=week/);
    // Week mode renders .sv-heatmap-week
    await expect(page.locator(".sv-heatmap-week").first()).toBeVisible({ timeout: 8000 });
    // No crash
    await expect(page.locator("body")).not.toContainText(/Error|崩溃|500/i);
    // Week button should be active
    const weekBtn = page.locator(".sv-period-btn").filter({ hasText: "周" });
    await expect(weekBtn).toHaveAttribute("data-active", "true");
  });

  test("/stats?period=month 加载 — 月热力图 SVG 可见", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/stats?period=month");
    await expect(page).toHaveURL(/period=month/);
    // Month mode renders .sv-heatmap-month with an SVG
    await expect(page.locator(".sv-heatmap-month svg").first()).toBeVisible({ timeout: 8000 });
    const monthBtn = page.locator(".sv-period-btn").filter({ hasText: "月" });
    await expect(monthBtn).toHaveAttribute("data-active", "true");
  });

  test("nav 含统计链接", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/");
    // Nav bar link with text "统计" pointing to /stats
    const statsLink = page.locator('a[href="/stats"]').filter({ hasText: "统计" }).first();
    await expect(statsLink).toBeVisible({ timeout: 8000 });
  });

  test("点击统计链接跳转 /stats", async ({ page }) => {
    await loginAlice(page);
    await page.goto("/");
    const statsLink = page.locator('a[href="/stats"]').filter({ hasText: "统计" }).first();
    await statsLink.click();
    await expect(page).toHaveURL(/\/stats/, { timeout: 8000 });
  });
});
