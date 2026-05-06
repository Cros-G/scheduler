import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

const TEST_USERNAME = "e2e_alice";
const TEST_PASSWORD = "test_password_123";
const BASE = "http://localhost:3000";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function loginAsAlice(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.fill('input[name="username"]', TEST_USERNAME);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(`${BASE}/`);
  // Wait for the page to be fully loaded and React hydration to complete
  await page.waitForLoadState("networkidle");
}

// ── Serial suite — tests share state (tasks + occurrences) ───────────────────

test.describe.serial("月视图 occurrence 流程", () => {
  test.beforeAll(() => {
    execSync("node scripts/e2e-clean-tasks.js", {
      stdio: "inherit",
      cwd: "/Users/gongqipeng/Desktop/scheduler",
    });
  });

  // ── 1. 登录后月历显示当月 ─────────────────────────────────────────────────

  test("登录后访问 / 显示五月 2026", async ({ page }) => {
    await loginAsAlice(page);
    // Month label h1 contains "五月 2026"
    await expect(page.locator("h1.mv-month-label")).toContainText("五月 2026");
    // Today cell should have the 'today' class (day 6)
    await expect(page.locator(".mv-day-cell.today")).toBeVisible();
    // Today's day number should be "6"
    await expect(
      page.locator(".mv-day-cell.today .mv-day-num span").first()
    ).toContainText("6");
  });

  // ── 2. 空任务面板显示提示 ─────────────────────────────────────────────────

  test("空任务面板显示提示文字", async ({ page }) => {
    await loginAsAlice(page);
    await expect(page.locator(".mv-task-empty")).toBeVisible();
    await expect(page.locator(".mv-task-empty")).toContainText("还没有任务");
  });

  // ── 3. 通过 /tasks 创建 COUNTED 和 CHECK 任务 ─────────────────────────────

  test("创建 COUNTED 任务「吃苹果」和 CHECK 任务「冥想」", async ({ page }) => {
    await loginAsAlice(page);
    await page.goto("/tasks");

    // ---- Create COUNTED task ----
    await page.click('button:has-text("新建任务")');
    await expect(page.locator('h2:has-text("新建任务")')).toBeVisible();

    await page.fill('input[name="name"]', "吃苹果");

    // Pick emoji 🍎 from 食物 tab
    await page.click('button[aria-label="选择 emoji"]');
    await page.click('button:has-text("食物")');
    await page.click('button[title="🍎"]');

    // Type defaults to COUNTED; set count and period
    await page.fill('input[name="targetCount"]', "3");
    await page.selectOption('select[name="targetPeriod"]', "WEEK");

    await page.click('button[type="submit"]:has-text("创建任务")');
    await expect(page.locator('span:has-text("吃苹果")')).toBeVisible({
      timeout: 8000,
    });

    // ---- Create CHECK task ----
    await page.click('button:has-text("新建任务")');
    await expect(page.locator('h2:has-text("新建任务")')).toBeVisible();

    await page.fill('input[name="name"]', "冥想");

    // Pick emoji from 放松 or similar tab; fall back to 心情
    await page.click('button[aria-label="选择 emoji"]');
    await page.click('button:has-text("心情")');
    await page.click('button[title="😌"]');

    // Switch to CHECK type
    await page.check('input[type="radio"][value="CHECK"]');

    await page.click('button[type="submit"]:has-text("创建任务")');
    await expect(page.getByText("冥想", { exact: true })).toBeVisible({
      timeout: 8000,
    });
  });

  // ── 4. 选 COUNTED 任务 + 点今天 → 图标出现 ───────────────────────────────

  test("选「吃苹果」后点今天格 → 🍎 chip 出现在今天格", async ({ page }) => {
    await loginAsAlice(page);

    // Wait for the task panel to hydrate and show the task
    await expect(
      page.locator('li[role="option"][title="吃苹果"]')
    ).toBeVisible({ timeout: 8000 });

    // Click the task row for 吃苹果 in the panel
    await page.locator('li[role="option"][title="吃苹果"]').click();
    // Verify it's selected (has aria-selected="true")
    await expect(
      page.locator('li[role="option"][title="吃苹果"]')
    ).toHaveAttribute("aria-selected", "true");

    // Click today's grid cell (use icons-area to avoid the ··· hover button)
    await page.locator(".mv-day-cell.today .mv-icons-area").click();

    // An icon chip with 🍎 should appear in today's cell
    await expect(
      page.locator(".mv-day-cell.today .mv-icon-chip")
    ).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator(".mv-day-cell.today .mv-icon-chip")
    ).toContainText("🍎");
  });

  // ── 5. 再点今天 → count 角标显示 ·2 ──────────────────────────────────────

  test("再点今天格 → 今天格内吃苹果角标变为 ·2", async ({ page }) => {
    await loginAsAlice(page);

    // Wait for the task panel to hydrate
    await expect(
      page.locator('li[role="option"][title="吃苹果"]')
    ).toBeVisible({ timeout: 8000 });

    // Re-select 吃苹果
    await page.locator('li[role="option"][title="吃苹果"]').click();
    await expect(
      page.locator('li[role="option"][title="吃苹果"]')
    ).toHaveAttribute("aria-selected", "true");

    // Click today again (use icons-area to avoid the ··· hover button)
    await page.locator(".mv-day-cell.today .mv-icons-area").click();

    // Count badge should now show ·2
    await expect(
      page.locator(".mv-day-cell.today .mv-icon-badge")
    ).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator(".mv-day-cell.today .mv-icon-badge")
    ).toContainText("2");
  });

  // ── 6. 选 CHECK 任务 + 点今天 → 出现打钩 ────────────────────────────────

  test("选「冥想」后点今天格 → ✓ 出现在今天格", async ({ page }) => {
    await loginAsAlice(page);

    // Wait for the task panel to hydrate
    await expect(
      page.locator('li[role="option"][title="冥想"]')
    ).toBeVisible({ timeout: 8000 });

    // Click the task row for 冥想
    await page.locator('li[role="option"][title="冥想"]').click();
    await expect(
      page.locator('li[role="option"][title="冥想"]')
    ).toHaveAttribute("aria-selected", "true");

    // Click today's cell (use icons-area to avoid the ··· hover button)
    await page.locator(".mv-day-cell.today .mv-icons-area").click();

    // Check indicator should appear in today's cell
    await expect(
      page.locator(".mv-day-cell.today .mv-icon-check")
    ).toBeVisible({ timeout: 8000 });
    await expect(
      page.locator(".mv-day-cell.today .mv-icon-check")
    ).toContainText("✓");
  });

  // ── 7. 再点同 CHECK 任务今天 → 取消打钩 ──────────────────────────────────

  test("再点今天格（冥想已选中）→ 取消打钩", async ({ page }) => {
    await loginAsAlice(page);

    // Wait for the task panel to hydrate
    await expect(
      page.locator('li[role="option"][title="冥想"]')
    ).toBeVisible({ timeout: 8000 });

    // Re-select 冥想
    await page.locator('li[role="option"][title="冥想"]').click();
    await expect(
      page.locator('li[role="option"][title="冥想"]')
    ).toHaveAttribute("aria-selected", "true");

    // Click today to toggle off (use icons-area to avoid the ··· hover button)
    await page.locator(".mv-day-cell.today .mv-icons-area").click();

    // The check chip for 冥想 should disappear
    await expect(
      page.locator(".mv-day-cell.today .mv-icon-check")
    ).not.toBeVisible({ timeout: 8000 });
  });

  // ── 8. 月份切换：点上月 → 月份改变 + 今天高亮消失 ──────────────────────

  test("点上月按钮 → 月份变为四月 2026，今天 cell 消失", async ({ page }) => {
    await loginAsAlice(page);

    await page.click('button[aria-label="上个月"]');

    // Month label changes to 四月
    await expect(page.locator("h1.mv-month-label")).toContainText(
      "四月 2026",
      { timeout: 8000 }
    );

    // No today cell in a different month
    await expect(page.locator(".mv-day-cell.today")).not.toBeVisible();
  });

  // ── 9. 点"今天"按钮 → 回到当月 ──────────────────────────────────────────

  test("点「今天」按钮 → 回到五月 2026", async ({ page }) => {
    await loginAsAlice(page);

    // Navigate to previous month first
    await page.click('button[aria-label="上个月"]');
    await expect(page.locator("h1.mv-month-label")).toContainText("四月 2026", {
      timeout: 8000,
    });

    // Click 今天 button
    await page.click('button.mv-today-btn');

    // Back to current month
    await expect(page.locator("h1.mv-month-label")).toContainText("五月 2026", {
      timeout: 8000,
    });
    // Today cell should reappear
    await expect(page.locator(".mv-day-cell.today")).toBeVisible();
  });

  // ── 10. 点格子打开日详情（无任务选中时）────────────────────────────────

  test("无任务选中时点今天格 → 日详情面板弹出", async ({ page }) => {
    await loginAsAlice(page);

    // Ensure no task is selected by clicking an already-selected task to deselect
    // or just reload fresh (no selection state in URL, it's client state)
    // After login the state is fresh (no task selected)

    // Click today's cell — should open day detail sheet
    await page.locator(".mv-day-cell.today").click();

    // Sheet dialog should appear
    const sheet = page.locator('[role="dialog"][aria-label="日期详情"]');
    await expect(sheet).toBeVisible({ timeout: 8000 });

    // Date should mention 5月 6日
    await expect(sheet.locator(".sheet-date")).toContainText("5 月 6 日");

    // Close sheet via close button
    await sheet.locator('button[aria-label="关闭"]').click();
    await expect(sheet).not.toBeVisible({ timeout: 5000 });
  });

  // ── 11. 日详情里 - 按钮减少事件 ─────────────────────────────────────────

  test("日详情中点 − 按钮 → 吃苹果 count 减少", async ({ page }) => {
    await loginAsAlice(page);

    // Open day detail for today (no task selected, so click opens sheet)
    await page.locator(".mv-day-cell.today").click();

    const sheet = page.locator('[role="dialog"][aria-label="日期详情"]');
    await expect(sheet).toBeVisible({ timeout: 8000 });

    // The 吃苹果 occurrence row should show "× 2"
    const countSpan = sheet.locator(".sheet-event-count");
    await expect(countSpan).toContainText("2", { timeout: 5000 });

    // Click the first remove button (deletes one occurrence)
    const removeBtn = sheet.locator('.sheet-remove-btn').first();
    await removeBtn.click();

    // After removal, count should drop (either "× 1" or the task disappears if count was 1)
    // We had 2 occurrences, so now "× 1"
    await expect(countSpan).toContainText("1", { timeout: 8000 });
  });

  // ── 12. 有事件的任务在 /tasks 真删 → 失败/被拒 ──────────────────────────

  test("有 occurrence 的任务永久删除 → 操作被拒，任务仍在列表", async ({
    page,
  }) => {
    await loginAsAlice(page);
    await page.goto("/tasks");

    // 吃苹果 is still active (not archived). Archive it first so 永久删除 appears.
    await expect(page.locator('span:has-text("吃苹果")')).toBeVisible({
      timeout: 8000,
    });

    const taskCard = page
      .locator("li")
      .filter({ hasText: "吃苹果" })
      .first();
    await taskCard.locator('button:has-text("归档")').click();

    // Wait for archived section
    await expect(page.locator("details.archived-details")).toBeVisible({
      timeout: 8000,
    });
    await page.click("details.archived-details > summary");

    // Register dialog handler BEFORE clicking (accepts the confirm dialog)
    page.on("dialog", (d) => d.accept());

    // Click 永久删除 on 吃苹果
    const archivedRow = page
      .locator("details.archived-details li")
      .filter({ hasText: "吃苹果" });
    await archivedRow.locator('button:has-text("永久删除")').click();

    // Since the task has occurrences, the server action throws.
    // Next.js App Router wraps form action errors as a route error page.
    // The task should still be present in the archived list (no deletion happened).
    // We verify by navigating back to /tasks and confirming the task is still archived.
    await page.goto("/tasks");
    await expect(page.locator("details.archived-details")).toBeVisible({
      timeout: 8000,
    });
    await page.click("details.archived-details > summary");
    await expect(
      page
        .locator("details.archived-details li")
        .filter({ hasText: "吃苹果" })
    ).toBeVisible({ timeout: 5000 });
  });
});
