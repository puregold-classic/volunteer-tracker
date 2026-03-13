import { chromium } from '/home/zsy666/dev/volunteer-tracker/frontend/node_modules/playwright/lib/index.js';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 2400 }, colorScheme: 'dark', deviceScaleFactor: 1.5 });
await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });
await page.screenshot({ path: '/home/zsy666/dev/volunteer-tracker/test-cards/comparison.png', fullPage: true });
await browser.close();
console.log('screenshot saved: test-cards/comparison.png');
