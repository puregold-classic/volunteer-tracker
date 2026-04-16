// Wave-2 end-to-end smoke: login as a_admin, build a project, batch-enter
// attendance, then log in as a participant and verify the project tag
// appears on their attendance record. Captures screenshots at each step.
//
// Frontend is expected on http://localhost:3001 (Vite fell back from 3000).
// Run: npx playwright test e2e/wave2.spec.js --headed=false

import { test, expect } from 'playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE = process.env.FRONTEND_BASE || 'http://localhost:3001';
const SHOT_DIR = path.join(__dirname, '..', 'e2e-shots');

test.beforeAll(() => {
  if (!fs.existsSync(SHOT_DIR)) fs.mkdirSync(SHOT_DIR, { recursive: true });
});

test.use({ viewport: { width: 1400, height: 900 } });

async function login(page, email, password) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: /登录|登陆/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10000 });
}

async function logout(page) {
  const btn = page.getByRole('button', { name: /退出登录/ });
  if (await btn.isVisible().catch(() => false)) {
    await btn.click();
    await page.waitForTimeout(500);
  }
}

test('wave-2 happy path: a_admin creates project, batch-enters, user sees tag', async ({ page }) => {
  const PROJECT_NAME = `E2E 笔译培训 ${Date.now()}`;

  // 1. Login as a_admin
  await login(page, 'sample-ky-reviewer@vt.local', 'Sample@123');
  await page.screenshot({ path: path.join(SHOT_DIR, '01-home-as-admin.png'), fullPage: true });

  // 2. Go to /projects
  await page.getByRole('link', { name: /项目级录入/ }).first().click();
  await expect(page.getByRole('heading', { name: '项目级录入' })).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '02-projects-page.png'), fullPage: true });

  // 3. Open create dialog + fill + submit
  await page.getByRole('button', { name: /新建项目/ }).click();
  await expect(page.getByText('新建受训考勤项目')).toBeVisible();
  await page.getByPlaceholder('2026-04 笔译培训 第 12 期').fill(PROJECT_NAME);
  // department + date + duration have defaults; just submit
  await page.screenshot({ path: path.join(SHOT_DIR, '03-create-dialog.png'), fullPage: true });
  await page.getByRole('button', { name: '创建项目' }).click();

  // 4. Project should appear in list
  await expect(page.getByText(PROJECT_NAME, { exact: true }).first()).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: path.join(SHOT_DIR, '04-project-created.png'), fullPage: true });

  // 5. Open the project detail → batch-enter 4 names (1 unmatched, 1 duplicate alias)
  await page.getByRole('button').filter({ hasText: PROJECT_NAME }).click();
  await expect(page.getByText('批量考勤录入')).toBeVisible();
  const namesTextarea = page.getByPlaceholder(/王技术/);
  await namesTextarea.fill('王技术\nPG-0003\n陈推广\nfake-volunteer');
  await page.screenshot({ path: path.join(SHOT_DIR, '05-batch-form-filled.png'), fullPage: true });

  await page.getByRole('button', { name: /核验并批量录入/ }).click();

  // 6. Result panel should show summary. "fake-volunteer" also exists in
  // the textarea, so match the li row in the unmatched list specifically.
  await expect(page.getByText(/批量录入结果：共 \d+ 个输入/)).toBeVisible({ timeout: 10000 });
  await expect(page.locator('li').filter({ hasText: 'fake-volunteer' })).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '06-batch-result.png'), fullPage: true });

  // 7. Close dialog + logout
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await logout(page);

  // 8. Login as tech-user (PG-0003 = 王技术)
  await login(page, 'sample-tech-user@vt.local', 'Sample@123');
  await page.getByRole('link', { name: /个人中心/ }).first().click();
  await expect(page.getByRole('heading', { name: /王技术/ }).first()).toBeVisible();
  await page.screenshot({ path: path.join(SHOT_DIR, '07-me-as-tech-user.png'), fullPage: true });

  // 9. Verify the project tag appears on a support record card
  await expect(page.getByText(PROJECT_NAME).first()).toBeVisible({ timeout: 5000 });
  await page.screenshot({ path: path.join(SHOT_DIR, '08-me-tag-visible.png'), fullPage: true });
});
