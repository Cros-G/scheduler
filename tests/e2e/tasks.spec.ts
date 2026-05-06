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
}

// ── Redirect test (no login required, can run in parallel) ───────────────────

test("未登录访问 /tasks 重定向到 /login", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page).toHaveURL(/\/login$/);
});

// ── Serial CRUD suite — must run in order ────────────────────────────────────

test.describe.serial("tasks CRUD flow", () => {
  test.beforeAll(() => {
    // Wipe e2e_alice's tasks so the suite starts from a clean slate
    execSync("node scripts/e2e-clean-tasks.js", {
      stdio: "inherit",
      cwd: "/Users/gongqipeng/Desktop/scheduler",
    });
  });

  test("登录后空状态显示", async ({ page }) => {
    await loginAsAlice(page);
    await page.goto("/tasks");
    await expect(page.locator("h1")).toContainText("我的任务");
    await expect(
      page.locator("text=还没有任务，从这里开始记录今天的故事吧")
    ).toBeVisible();
  });

  test("创建 COUNTED 任务，出现在进行中列表", async ({ page }) => {
    await loginAsAlice(page);
    await page.goto("/tasks");

    // Open the create form
    await page.click('button:has-text("新建任务")');
    await expect(page.locator('h2:has-text("新建任务")')).toBeVisible();

    // Fill name
    await page.fill('input[name="name"]', "每日跑步");

    // Pick an emoji — open picker and click 🏃 in "运动" tab
    await page.click('button[aria-label="选择 emoji"]');
    await page.click('button:has-text("运动")');
    await page.click('button[title="🏃"]');

    // Color has a valid default (COLOR_PALETTE[0]). Type defaults to COUNTED.
    // Set targetCount and targetPeriod
    await page.fill('input[name="targetCount"]', "5");
    await page.selectOption('select[name="targetPeriod"]', "WEEK");

    // Submit
    await page.click('button[type="submit"]:has-text("创建任务")');

    // Wait for the task to appear in the active list
    await expect(
      page.locator('span:has-text("每日跑步")')
    ).toBeVisible({ timeout: 8000 });

    // Type badge
    await expect(
      page.locator('li').filter({ hasText: '每日跑步' }).locator('span:has-text("次数")')
    ).toBeVisible();
  });

  test("创建 CHECK 任务（无目标字段），出现在列表", async ({ page }) => {
    await loginAsAlice(page);
    await page.goto("/tasks");

    await page.click('button:has-text("新建任务")');
    await expect(page.locator('h2:has-text("新建任务")')).toBeVisible();

    await page.fill('input[name="name"]', "每日冥想");

    // Pick emoji 😌 from 心情 tab
    await page.click('button[aria-label="选择 emoji"]');
    await page.click('button:has-text("心情")');
    await page.click('button[title="😌"]');

    // Select CHECK type — target fields should disappear
    await page.check('input[type="radio"][value="CHECK"]');
    await expect(page.locator('input[name="targetCount"]')).not.toBeVisible();
    await expect(page.locator('select[name="targetPeriod"]')).not.toBeVisible();

    // Submit
    await page.click('button[type="submit"]:has-text("创建任务")');

    // Task appears in list
    await expect(
      page.locator('span:has-text("每日冥想")')
    ).toBeVisible({ timeout: 8000 });

    // Type badge shows "打卡"
    await expect(
      page.locator('li').filter({ hasText: '每日冥想' }).locator('span:has-text("打卡")')
    ).toBeVisible();
  });

  test("校验失败：图标为空时显示行内错误", async ({ page }) => {
    await loginAsAlice(page);
    await page.goto("/tasks");

    await page.click('button:has-text("新建任务")');
    await expect(page.locator('h2:has-text("新建任务")')).toBeVisible();

    // Fill name but deliberately skip emoji selection
    await page.fill('input[name="name"]', "无图标任务");

    // Clear the hidden icon value so it's truly empty
    await page.evaluate(() => {
      const el = document.querySelector<HTMLInputElement>(
        'input[type="hidden"][name="icon"]'
      );
      if (el) el.value = "";
    });

    // Submit — icon is empty, server will return validation error
    await page.click('button[type="submit"]:has-text("创建任务")');

    // Error banner: use the form's error div specifically (not Next.js route announcer)
    const errorBanner = page.locator('[role="alert"]:not([aria-live])');
    await expect(errorBanner).toBeVisible({ timeout: 8000 });
    await expect(errorBanner).toContainText("图标不能为空");
  });

  test("编辑 COUNTED 任务：名称更新，类型 radio 不可改", async ({ page }) => {
    await loginAsAlice(page);
    await page.goto("/tasks");

    // Wait for the task list to load
    await expect(page.locator('span:has-text("每日跑步")')).toBeVisible({
      timeout: 8000,
    });

    // Click the edit button on the "每日跑步" card
    const taskCard = page
      .locator("li")
      .filter({ hasText: "每日跑步" })
      .first();
    await taskCard.locator('button:has-text("编辑")').click();

    // Inline edit form should open
    await expect(page.locator('h2:has-text("编辑任务")')).toBeVisible();

    // Type radio should be disabled in edit mode
    const radios = page.locator('input[type="radio"][name="type"]');
    await expect(radios.first()).toBeDisabled();

    // Change name via the visible tf-name input inside the edit form
    const nameInput = page
      .locator('.task-form-inner input#tf-name')
      .or(page.locator('h2:has-text("编辑任务") ~ form input[name="name"]'));
    // Fallback: just get all visible tf-input inputs and fill the first one
    await page.locator('.task-form-inner').locator('input[name="name"]').fill("每日晨跑");

    // Submit
    await page.click('button[type="submit"]:has-text("保存修改")');

    // Updated name appears
    await expect(page.locator('span:has-text("每日晨跑")')).toBeVisible({
      timeout: 8000,
    });
    // Old name gone
    await expect(page.locator('span:has-text("每日跑步")')).not.toBeVisible({
      timeout: 5000,
    });
  });

  test("归档任务 → 移到已归档区", async ({ page }) => {
    await loginAsAlice(page);
    await page.goto("/tasks");

    // Wait for active task to be visible
    await expect(page.locator('span:has-text("每日晨跑")')).toBeVisible({
      timeout: 8000,
    });

    // Archive "每日晨跑"
    const taskCard = page
      .locator("li")
      .filter({ hasText: "每日晨跑" })
      .first();
    await taskCard.locator('button:has-text("归档")').click();

    // Archived section should now appear
    await expect(page.locator("details.archived-details")).toBeVisible({
      timeout: 8000,
    });

    // Open the archived section
    await page.click("details.archived-details > summary");

    // The task should appear in the archived list
    await expect(
      page.locator("details.archived-details").locator("text=每日晨跑")
    ).toBeVisible({ timeout: 5000 });

    // The archive button for that task should no longer be in the active section
    const activeSectionArchiveBtn = page
      .locator("section")
      .filter({ hasText: "进行中" })
      .locator("li")
      .filter({ hasText: "每日晨跑" });
    await expect(activeSectionArchiveBtn).not.toBeVisible();
  });

  test("反归档 → 任务回到进行中", async ({ page }) => {
    await loginAsAlice(page);
    await page.goto("/tasks");

    // Archived section must be visible
    await expect(page.locator("details.archived-details")).toBeVisible({
      timeout: 8000,
    });

    // Open archived section
    await page.click("details.archived-details > summary");

    // Click unarchive (恢复) on "每日晨跑"
    const archivedRow = page
      .locator("details.archived-details li")
      .filter({ hasText: "每日晨跑" });
    await archivedRow.locator('button:has-text("恢复")').click();

    // "每日晨跑" should reappear in the active section
    await expect(
      page
        .locator("section")
        .filter({ hasText: "进行中" })
        .locator('span:has-text("每日晨跑")')
    ).toBeVisible({ timeout: 8000 });
  });

  test("删除已归档任务（confirm 对话框）→ 任务消失", async ({ page }) => {
    await loginAsAlice(page);
    await page.goto("/tasks");

    // Archive "每日冥想" to put something in the archive
    await expect(page.locator('span:has-text("每日冥想")')).toBeVisible({
      timeout: 8000,
    });
    const taskCard = page
      .locator("li")
      .filter({ hasText: "每日冥想" })
      .first();
    await taskCard.locator('button:has-text("归档")').click();

    // Wait for archived section to appear
    await expect(page.locator("details.archived-details")).toBeVisible({
      timeout: 8000,
    });

    // Open archived section
    await page.click("details.archived-details > summary");

    // Register dialog handler BEFORE triggering delete
    page.on("dialog", (dialog) => dialog.accept());

    // Click delete on "每日冥想"
    const archivedRow = page
      .locator("details.archived-details li")
      .filter({ hasText: "每日冥想" });
    await archivedRow.locator('button:has-text("永久删除")').click();

    // Task should disappear from archived list
    await expect(
      page
        .locator("details.archived-details li")
        .filter({ hasText: "每日冥想" })
    ).not.toBeVisible({ timeout: 8000 });
  });
});
