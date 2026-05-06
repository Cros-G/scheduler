import { test, expect, Page } from "@playwright/test";
import { execSync } from "node:child_process";

const BASE = "http://localhost:3000";
const ADMIN_USERNAME = "e2e_admin";
const ADMIN_PASSWORD = "test_admin_pw";
const ALICE_USERNAME = "e2e_alice";
const ALICE_PASSWORD = "test_password_123";

async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(`${BASE}/`);
  await page.waitForLoadState("networkidle");
}

test.describe.serial("管理员用户管理", () => {
  test.beforeAll(() => {
    // Clean any prior temp users
    execSync("node scripts/e2e-clean-tasks.js", { stdio: "inherit", cwd: process.cwd() });
    // Seed admin user (idempotent — seed-user upserts)
    execSync(
      `pnpm seed:user --username ${ADMIN_USERNAME} --display "E2E Admin" --password "${ADMIN_PASSWORD}" --color "#5089C6" --admin`,
      { stdio: "inherit", cwd: process.cwd() }
    );
  });

  test("普通用户无法访问 /admin → redirect /", async ({ page }) => {
    await login(page, ALICE_USERNAME, ALICE_PASSWORD);
    await page.goto("/admin");
    await expect(page).toHaveURL(`${BASE}/`);
  });

  test("普通用户 nav 没有「管理员」链接", async ({ page }) => {
    await login(page, ALICE_USERNAME, ALICE_PASSWORD);
    // Desktop nav uses class nb-link-admin; mobile drawer also has "管理员" text
    await expect(page.locator('a.nb-link-admin')).toHaveCount(0);
  });

  test("admin nav 看到「管理员」链接", async ({ page }) => {
    await login(page, ADMIN_USERNAME, ADMIN_PASSWORD);
    // Desktop nav renders <a class="nb-link-admin"> only for admins
    await expect(page.locator('a.nb-link-admin').first()).toBeVisible();
  });

  test("admin 访问 /admin 看到用户列表", async ({ page }) => {
    await login(page, ADMIN_USERNAME, ADMIN_PASSWORD);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin/);
    // Both users should appear in the table
    await expect(page.locator(`table.aut-table td span.aut-username`).filter({ hasText: ADMIN_USERNAME }).first()).toBeVisible();
    await expect(page.locator(`table.aut-table td span.aut-username`).filter({ hasText: ALICE_USERNAME }).first()).toBeVisible();
  });

  test("创建新账号", async ({ page }) => {
    await login(page, ADMIN_USERNAME, ADMIN_PASSWORD);
    await page.goto("/admin");

    // Open create form via toggle button
    await page.locator('button.cuf-toggle').click();
    // Wait for panel to appear
    await expect(page.locator('div.cuf-panel')).toBeVisible();

    // Fill in the form fields (scoped to the panel)
    const panel = page.locator('div.cuf-panel');
    await panel.locator('input[name="username"]').fill("e2e_temp_alice");
    await panel.locator('input[name="displayName"]').fill("临时用户");
    await panel.locator('input[name="password"]').fill("tempsecret123");

    // Submit (the primary submit button inside the panel's form)
    await panel.locator('button[type="submit"]').click();

    // Panel closes on success; new user should appear in table
    await expect(page.locator('div.cuf-panel')).not.toBeVisible({ timeout: 5000 });
    await expect(
      page.locator('table.aut-table td span.aut-username').filter({ hasText: "e2e_temp_alice" }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("用新账号登录成功", async ({ page }) => {
    await login(page, "e2e_temp_alice", "tempsecret123");
    // Should be on home page and welcome should show displayName
    await expect(page.locator("text=临时用户").first()).toBeVisible({ timeout: 5000 });
  });

  test("admin 编辑账号 displayName", async ({ page }) => {
    await login(page, ADMIN_USERNAME, ADMIN_PASSWORD);
    await page.goto("/admin");

    // Find row for e2e_temp_alice in the table and click 编辑
    const row = page.locator('table.aut-table tbody tr').filter({ hasText: "e2e_temp_alice" }).first();
    await row.locator('button.aut-op-btn', { hasText: "编辑" }).click();

    // Edit dialog opens — backdrop has role="dialog"
    const backdrop = page.locator('[role="dialog"]').first();
    await expect(backdrop).toBeVisible();

    // Change displayName (field id="ed-displayName", name="displayName")
    const displayInput = backdrop.locator('input[name="displayName"]');
    await displayInput.fill("临时用户改名");

    // Save — primary button text is "保存修改"
    await backdrop.locator('button.aut-btn-primary').click();

    // Dialog closes and updated displayName appears in table
    await expect(backdrop).not.toBeVisible({ timeout: 5000 });
    // Look for the updated displayName inside the table (not mobile nav which may be hidden)
    await expect(
      page.locator('table.aut-table tbody tr').filter({ hasText: "e2e_temp_alice" })
        .locator('td div.aut-display-cell').filter({ hasText: "临时用户改名" }).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test("admin 重置新账号密码 + 旧密码登录失败 + 新密码成功", async ({ page }) => {
    await login(page, ADMIN_USERNAME, ADMIN_PASSWORD);
    await page.goto("/admin");

    // Find row and click 重置密码
    const row = page.locator('table.aut-table tbody tr').filter({ hasText: "e2e_temp_alice" }).first();
    await row.locator('button.aut-op-btn', { hasText: "重置密码" }).click();

    const backdrop = page.locator('[role="dialog"]').first();
    await expect(backdrop).toBeVisible();

    // Fill new password (id="rp-pw") and confirm (id="rp-confirm")
    await backdrop.locator('input#rp-pw').fill("newsecret456");
    await backdrop.locator('input#rp-confirm').fill("newsecret456");

    // Submit — text "确认重置"
    await backdrop.locator('button.aut-btn-primary').click();

    // Wait for dialog to close
    await expect(backdrop).not.toBeVisible({ timeout: 5000 });

    // Log out admin first, then test old/new password for e2e_temp_alice
    await page.locator('button:has-text("登出")').first().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    // Login with old password should fail
    await page.fill('input[name="username"]', "e2e_temp_alice");
    await page.fill('input[name="password"]', "tempsecret123");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/login\?error=invalid/, { timeout: 10000 });

    // Login with new password should succeed
    await page.fill('input[name="username"]', "e2e_temp_alice");
    await page.fill('input[name="password"]', "newsecret456");
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(`${BASE}/`, { timeout: 10000 });

    // Log out temp alice so next test (admin 不能删自己) starts fresh
    await page.locator('button:has-text("登出")').first().click();
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
  });

  test("admin 不能删自己（按钮 disabled）", async ({ page }) => {
    await login(page, ADMIN_USERNAME, ADMIN_PASSWORD);
    await page.goto("/admin");

    // The row for the current user has data-self="true"
    const ownRow = page.locator('table.aut-table tbody tr[data-self="true"]').first();
    await expect(ownRow).toBeVisible();

    // Delete button should be disabled for self
    const deleteBtn = ownRow.locator('button.aut-op-btn-danger', { hasText: "删除" });
    await expect(deleteBtn).toBeDisabled();
  });

  test("admin 不能取消自己的 admin 标记", async ({ page }) => {
    await login(page, ADMIN_USERNAME, ADMIN_PASSWORD);
    await page.goto("/admin");

    // Click 编辑 on own row
    const ownRow = page.locator('table.aut-table tbody tr[data-self="true"]').first();
    await ownRow.locator('button.aut-op-btn', { hasText: "编辑" }).click();

    const backdrop = page.locator('[role="dialog"]').first();
    await expect(backdrop).toBeVisible();

    // isAdmin checkbox (name="isAdmin") should be disabled for self
    const adminCheckbox = backdrop.locator('input[name="isAdmin"]');
    await expect(adminCheckbox).toBeDisabled();

    // Close dialog
    await backdrop.locator('button.aut-btn-ghost').click();
    await expect(backdrop).not.toBeVisible({ timeout: 3000 });
  });

  test("admin 删除新账号", async ({ page }) => {
    await login(page, ADMIN_USERNAME, ADMIN_PASSWORD);
    await page.goto("/admin");

    // Find e2e_temp_alice row and click 删除
    const row = page.locator('table.aut-table tbody tr').filter({ hasText: "e2e_temp_alice" }).first();
    await row.locator('button.aut-op-btn-danger', { hasText: "删除" }).click();

    const backdrop = page.locator('[role="dialog"]').first();
    await expect(backdrop).toBeVisible();

    // Type username in confirmation input (id="del-confirm")
    await backdrop.locator('input#del-confirm').fill("e2e_temp_alice");

    // Confirm delete button should now be enabled — text "永久删除"
    const confirmBtn = backdrop.locator('button.aut-btn-danger', { hasText: "永久删除" });
    await expect(confirmBtn).toBeEnabled();
    await confirmBtn.click();

    // Wait for dialog to close and row to disappear
    await expect(backdrop).not.toBeVisible({ timeout: 5000 });
    await page.waitForLoadState("networkidle");

    // e2e_temp_alice should no longer appear in the table
    await expect(
      page.locator('table.aut-table td span.aut-username').filter({ hasText: "e2e_temp_alice" })
    ).toHaveCount(0);
  });
});
