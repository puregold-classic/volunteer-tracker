const { test } = require('playwright/test');

const base = 'http://localhost:3000';
const prefix = process.env.SHOT_PREFIX || 'before';

async function waitStable(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
}

test.use({ viewport: { width: 1512, height: 982 }, colorScheme: 'dark' });

test('capture ui screens', async ({ page }) => {
  await page.goto(`${base}/#/`);
  await waitStable(page);
  await page.screenshot({ path: `qa-screenshots/${prefix}-home.png`, fullPage: true });

  await page.goto(`${base}/#/login`);
  await page.fill('input[type="email"]', 'admin@example.com');
  await page.fill('input[type="password"]', 'ChangeMe123!');
  await page.click('button[type="submit"]');
  await waitStable(page);
  await page.screenshot({ path: `qa-screenshots/${prefix}-me.png`, fullPage: true });

  await page.goto(`${base}/#/review`);
  await waitStable(page);
  await page.screenshot({ path: `qa-screenshots/${prefix}-review.png`, fullPage: true });
});
