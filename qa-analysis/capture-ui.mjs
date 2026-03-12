import { chromium } from 'playwright';

const base = 'http://localhost:3000';
const outPrefix = process.argv[2] || 'before';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1512, height: 982 }, colorScheme: 'dark' });

async function waitStable() {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
}

await page.goto(`${base}/#/`, { waitUntil: 'domcontentloaded' });
await waitStable();
await page.screenshot({ path: `qa-screenshots/${outPrefix}-home.png`, fullPage: true });

await page.goto(`${base}/#/login`, { waitUntil: 'domcontentloaded' });
await page.fill('input[type="email"]', 'admin@example.com');
await page.fill('input[type="password"]', 'ChangeMe123!');
await page.click('button[type="submit"]');
await waitStable();
await page.screenshot({ path: `qa-screenshots/${outPrefix}-me.png`, fullPage: true });

await page.goto(`${base}/#/review`, { waitUntil: 'domcontentloaded' });
await waitStable();
await page.screenshot({ path: `qa-screenshots/${outPrefix}-review.png`, fullPage: true });

await browser.close();
