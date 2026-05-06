import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

const TEST_USERNAME = "e2e_alice";
const TEST_PASSWORD = "test_password_123";

test.beforeAll(() => {
  // Seed a test user in the dev DB (since dev server uses dev DB).
  execSync(
    `pnpm seed:user --username ${TEST_USERNAME} --display "E2E Alice" --password "${TEST_PASSWORD}" --color "#AABBCC"`,
    { stdio: "inherit" }
  );
});

test("未登录访问 / 重定向到 /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("h1")).toContainText("登录");
});

test("错误密码 → 显示错误信息", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="username"]', TEST_USERNAME);
  await page.fill('input[name="password"]', "wrong");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/login\?error=invalid/);
  await expect(page.locator("text=用户名或密码错误")).toBeVisible();
});

test("正确凭据 → 进主页 → 登出 → 回 /login", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="username"]', TEST_USERNAME);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.locator("h1.mv-month-label")).toBeVisible();
  await expect(page.locator("text=E2E Alice")).toBeVisible();

  // Logout
  await page.click('button:has-text("登出")');
  await expect(page).toHaveURL(/\/login$/);

  // After logout, accessing / again should redirect to /login
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
