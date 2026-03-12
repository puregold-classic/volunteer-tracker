const { test, expect } = require('@playwright/test');

test('home page loads', async ({ page }) => {
  await page.goto('http://localhost:3000/#/');
  await expect(page.locator('#root')).toBeVisible();
  await expect(page.getByText('志愿者结果列表')).toBeVisible();
});

test('mobile can switch map/list tabs', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('http://localhost:3000/#/');
  await page.getByRole('button', { name: /列表/ }).click();
  await expect(page.getByText('查看详情').first()).toBeVisible();
  await page.getByRole('button', { name: /地图/ }).click();
  await expect(page.getByText('地图概览')).toBeVisible();
  await context.close();
});

test('can open volunteer detail from card', async ({ page }) => {
  await page.goto('http://localhost:3000/#/');
  await page.getByRole('button', { name: '查看详情' }).first().click();
  await expect(page.getByRole('button', { name: /返回首页/ })).toBeVisible();
});
