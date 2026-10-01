import { test, expect } from 'playwright/test';

async function login(page, email) {
  await page.goto('/forum');
  await expect(page.getByRole('heading', { name: '账号登录' })).toBeVisible();
  await page.getByLabel('邮箱 / 手机号 / 志愿者 ID').fill(email);
  await page.getByLabel('密码', { exact: true }).fill('TestOnly@123');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '论坛', exact: true })).toBeVisible();
  await expect(page.getByText('让知识和经验更有温度', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '圈务工作台', exact: true })).toHaveCount(0);
}
async function logout(page) {
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByRole('link', { name: '登录', exact: true })).toBeVisible();
}
async function choose(page, name) {
  await page.getByLabel('查找账号').fill(name);
  await page.getByLabel('账号搜索结果').getByRole('button', { name: new RegExp(name) }).click();
}

// Serial because the second test inspects the archive produced by the first.
test.describe.serial('forum circles', () => {
  test('create → appoint steward → transfer owner → archive; roles take effect immediately', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await login(page, 'reset-admin@example.test');
    await expect(page.getByRole('link', { name: '论坛', exact: true }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: '新人圈', exact: true })).toBeVisible();
    await page.screenshot({ path: '/tmp/volunteer-forum-desktop.png', fullPage: true });
    await page.getByRole('button', { name: '新建圈子', exact: true }).click();
    await page.getByLabel('圈名', { exact: true }).fill('测试交流圈');
    await page.getByLabel('圈子地址').fill('e2e-circle');
    await page.getByLabel('简介', { exact: true }).fill('分享志愿经历，认识一起同行的伙伴。');
    await choose(page, '圈主测试');
    await page.getByRole('button', { name: '创建圈子', exact: true }).click();
    await expect(page.getByRole('heading', { name: '测试交流圈 · 圈子管理' })).toBeVisible();
    await expect(page.getByRole('listitem').filter({ hasText: '圈主测试' })).toContainText('圈主');
    await logout(page);

    await login(page, 'forum-owner@example.test');
    await expect(page.getByRole('button', { name: '新建圈子', exact: true })).toHaveCount(0);
    await page.goto('/forum/c/e2e-circle/manage');
    await expect(page.getByRole('heading', { name: '圈务成员' })).toBeVisible();
    await expect(page.getByRole('button', { name: '归档圈子', exact: true })).toHaveCount(0);
    await choose(page, '协管测试');
    await page.getByRole('button', { name: '任命协管员', exact: true }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect(page.getByRole('listitem').filter({ hasText: '协管测试' })).toContainText('协管员');
    await page.getByLabel('圈务操作').selectOption('TRANSFER');
    await choose(page, '接任测试');
    await page.getByRole('button', { name: '转让圈主', exact: true }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect(page).toHaveURL(/\/forum\/c\/e2e-circle$/);
    await expect(page.getByRole('heading', { name: '测试交流圈', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: '圈子管理', exact: true })).toHaveCount(0);
    await page.goto('/forum/c/e2e-circle/manage');
    await expect(page.getByRole('alert')).toContainText('拒绝访问');
    await logout(page);

    await login(page, 'forum-steward@example.test');
    await page.goto('/forum/c/e2e-circle/manage');
    await expect(page.getByRole('heading', { name: '圈务成员' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '基本设置' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '任命协管员', exact: true })).toHaveCount(0);
    await expect(page.getByRole('listitem').filter({ hasText: '接任测试' })).toContainText('圈主');
    await logout(page);

    await login(page, 'reset-admin@example.test');
    await page.goto('/forum/c/e2e-circle/manage');
    await page.getByRole('button', { name: '归档圈子', exact: true }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect(page.getByRole('button', { name: '恢复圈子', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('mobile navigation, archived visibility and restore', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'forum-owner@example.test');
    await expect(page.getByRole('heading', { name: '测试交流圈', exact: true })).toHaveCount(0);
    const forumLink = page.getByRole('link', { name: '论坛', exact: true }).last();
    await expect(forumLink).toBeVisible();
    await forumLink.click();
    await page.screenshot({ path: '/tmp/volunteer-forum-mobile.png', fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.goto('/forum/c/e2e-circle');
    await expect(page.getByRole('alert')).toContainText('圈子已归档');
    await logout(page);
    await login(page, 'reset-admin@example.test');
    await page.getByText('已归档圈子（1）', { exact: true }).click();
    await page.getByRole('link', { name: '管理归档圈子 测试交流圈', exact: true }).click();
    await expect(page.getByRole('button', { name: '恢复圈子', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '恢复圈子', exact: true }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect(page.getByRole('button', { name: '归档圈子', exact: true })).toBeVisible();
    await page.getByRole('link', { name: '查看圈子', exact: true }).click();
    await expect(page.getByRole('heading', { name: '测试交流圈', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: '圈内讨论', exact: true })).toHaveCount(0);
    const floatingPost = page.getByRole('button', { name: '发帖', exact: true });
    await expect(floatingPost).toHaveAttribute('title', '发帖');
    await expect(floatingPost).toHaveCSS('position', 'fixed');
    const position = await floatingPost.evaluate(button => {
      const bounds = button.getBoundingClientRect();
      return { right: innerWidth - bounds.right, bottom: innerHeight - bounds.bottom };
    });
    expect(position.right).toBeGreaterThanOrEqual(0);
    expect(position.right).toBeLessThanOrEqual(40);
    expect(position.bottom).toBeGreaterThanOrEqual(0);
    expect(position.bottom).toBeLessThanOrEqual(160);
    await floatingPost.click();
    const draftDialog = page.getByRole('dialog', { name: '在测试交流圈发帖', exact: true });
    await expect(draftDialog).toBeVisible();
    await draftDialog.getByLabel('标题', { exact: true }).fill('手机浮动按钮恢复的草稿');
    await expect(draftDialog.getByRole('status')).toContainText('草稿已自动保存到当前浏览器');
    await draftDialog.getByRole('button', { name: '取消', exact: true }).click();
    await floatingPost.click();
    await expect(draftDialog.getByLabel('标题', { exact: true })).toHaveValue('手机浮动按钮恢复的草稿');
    await draftDialog.getByRole('button', { name: '取消', exact: true }).click();
    await page.getByRole('navigation', { name: '圈子内容' }).getByRole('button', { name: '圈文件', exact: true }).click();
    await expect(floatingPost).toHaveCount(0);
    await page.getByRole('navigation', { name: '圈子内容' }).getByRole('button', { name: '讨论', exact: true }).click();
    await expect(floatingPost).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.setViewportSize({ width: 2048, height: 1152 });
    await expect.poll(async () => floatingPost.evaluate(button => {
      const section = document.querySelector('section[aria-label="圈内讨论"]');
      if (!section) return false;
      const inset = section.getBoundingClientRect().right - button.getBoundingClientRect().right;
      return inset >= -0.5 && inset <= 4;
    })).toBe(true);
    await expect(floatingPost).toHaveCSS('position', 'fixed');
    await page.screenshot({ path: '/tmp/volunteer-forum-floating-post-wide.png', fullPage: false });
  });
});

test('discussion: publish, formatting, personal entries, comment edits, moderation and mobile layout', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'forum-owner@example.test');
  await page.goto('/forum/c/e2e-circle');
  await page.getByRole('button', { name: '发帖', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('一起分享本周的志愿故事');
  const editor = page.getByRole('textbox', { name: '正文', exact: true });
  await editor.fill('很高兴认识大家，欢迎分享自己的故事。');
  await editor.press('ControlOrMeta+a');
  await page.getByRole('button', { name: '加粗', exact: true }).click();
  await expect(editor.locator('strong')).toContainText('很高兴认识大家');
  await editor.press('ArrowRight');
  await page.getByRole('button', { name: '表情', exact: true }).click();
  await page.getByRole('button', { name: '插入 😊', exact: true }).click();
  await expect(page.getByRole('button', { name: '预览', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '引用', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '发布帖子', exact: true }).click();
  await expect(page.getByRole('heading', { name: '一起分享本周的志愿故事', exact: true })).toBeVisible();
  const postPath = new URL(page.url()).pathname;
  await page.getByRole('button', { name: '编辑帖子', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('一起分享志愿故事 · 更新');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('heading', { name: '一起分享志愿故事 · 更新' })).toBeVisible();
  await page.goto('/me');
  await page.getByRole('link', { name: '打开我的论坛', exact: true }).click();
  await page.getByRole('treeitem', { name: '一起分享志愿故事 · 更新', exact: true }).click();
  await expect(page.getByRole('treeitem', { name: '一起分享志愿故事 · 更新', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('region', { name: '当前条目' }).getByRole('link', { name: '打开帖子：一起分享志愿故事 · 更新', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(postPath + '$'));
  await logout(page);

  await login(page, 'forum-steward@example.test');
  await page.goto(postPath);
  await expect(page.getByRole('button', { name: '编辑帖子', exact: true })).toHaveCount(0);
  await page.getByLabel('评论', { exact: true }).fill('很开心一起参与，谢谢大家！');
  await page.getByRole('button', { name: '发表评论', exact: true }).click();
  await expect(page.locator('article').filter({ hasText: '很开心一起参与，谢谢大家！' })).toBeVisible();
  await page.getByRole('button', { name: '编辑评论', exact: true }).click();
  await page.getByRole('dialog', { name: '编辑评论' }).getByLabel('评论', { exact: true }).fill('很开心一起参与，下次继续同行 😊');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.locator('article').filter({ hasText: '很开心一起参与，下次继续同行 😊' })).toBeVisible();
  await page.goto('/me');
  await page.getByRole('link', { name: '打开我的论坛', exact: true }).click();
  await page.goto('/me/forum?tab=comments');
  await expect(page.getByRole('button', { name: '我的参与', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page).toHaveURL(/commentId=/);
  await expect(page.locator('article[id^="comment-"]')).toHaveClass(/ring-primary/);
  await page.screenshot({ path: '/tmp/volunteer-forum-post-desktop.png', fullPage: true });
  await page.getByRole('region', { name: '当前条目' }).getByRole('link', { name: '查看原文', exact: true }).click();
  await page.getByRole('button', { name: '删除评论', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByText('还没有评论，来分享你的想法吧。')).toBeVisible();
  await logout(page);

  await login(page, 'reset-admin@example.test');
  await page.goto('/me');
  await expect(page.getByRole('link', { name: '打开我的论坛', exact: true })).toHaveAttribute('href', '/me/forum');
  await page.goto(postPath);
  await expect(page.getByRole('heading', { name: '一起分享志愿故事 · 更新' })).toBeVisible();
  for (const name of ['编辑帖子', '删除帖子', '恢复评论', '置顶帖子', '设为精华']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: '点赞', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '测试交流圈', exact: true }).click();
  await page.getByRole('link', { name: '圈子管理', exact: true }).click();
  await page.getByRole('link', { name: '一起分享志愿故事 · 更新', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(postPath + '\\?view=manage$'));
  await expect(page.getByRole('button', { name: '发表评论', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '点赞', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '恢复评论', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByText('此评论已删除，仅管理视图可见')).toHaveCount(0);
  await page.getByRole('button', { name: '编辑帖子', exact: true }).click();
  await page.getByLabel('正文', { exact: true }).fill('欢迎大家交流，请保持友善。每一次小小的付出，都值得被看见。');
  await page.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByText('由系统管理员编辑', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(postPath);
  await expect(page.getByRole('heading', { name: '一起分享志愿故事 · 更新' })).toBeVisible();
  for (const name of ['编辑帖子', '删除帖子', '编辑评论', '删除评论', '置顶帖子', '设为精华']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
  }
  await expect(page.getByRole('button', { name: '发表评论', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/volunteer-forum-post-mobile.png', fullPage: true });
  await logout(page);

  await login(page, 'forum-steward@example.test');
  await page.goto(postPath);
  await expect(page.getByRole('heading', { name: '一起分享志愿故事 · 更新' })).toBeVisible();
  await expect(page.getByRole('button', { name: '删除帖子', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: '测试交流圈', exact: true }).click();
  await page.getByRole('link', { name: '圈子管理', exact: true }).click();
  await page.getByRole('link', { name: '一起分享志愿故事 · 更新', exact: true }).click();
  await page.getByRole('button', { name: '删除帖子', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复帖子', exact: true })).toBeVisible();
  await page.goto(postPath);
  await expect(page.getByRole('alert')).toContainText('内容已删除');
  await page.goto('/forum/c/e2e-circle/manage');
  await page.getByRole('link', { name: '一起分享志愿故事 · 更新', exact: true }).click();
  await page.getByRole('button', { name: '恢复帖子', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('link', { name: '普通阅读视图' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('local dev switcher: anonymous → user → steward → admin, refreshing identity and mobile layout', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: '开发账号切换', exact: true }).click();
  const panel = page.getByRole('region', { name: '账户切换面板' });
  await panel.getByLabel('搜索切换账号').fill('圈主测试');
  await panel.getByRole('button', { name: '切换到 圈主测试 user', exact: true }).click();
  await expect(page).toHaveURL(/\/forum$/);
  await expect(panel).toContainText('当前：圈主测试');
  await page.goto('/me/forum?tab=posts');
  await expect(page.getByRole('heading', { name: '一起分享志愿故事 · 更新' })).toBeVisible();
  await panel.getByLabel('搜索切换账号').fill('协管测试');
  await panel.getByRole('button', { name: '切换到 协管测试 user', exact: true }).click();
  await expect(panel).toContainText('当前：协管测试');
  await expect(page).toHaveURL(/\/me\/forum\?filter=mine/);
  await expect(page.getByRole('treeitem', { name: '一起分享志愿故事 · 更新', exact: true }).getByRole('img', { name: '我发布的帖子', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '当前条目' }).getByRole('img', { name: '我的评论', exact: true })).toBeVisible();
  await panel.getByLabel('搜索切换账号').fill('测试管理员');
  await panel.getByRole('button', { name: '切换到 测试管理员 admin', exact: true }).click();
  await expect(panel).toContainText('当前：测试管理员');
  await page.goto('/me');
  await expect(page.getByRole('heading', { name: '系统管理员中心', exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/volunteer-dev-switcher-mobile.png', fullPage: false });
  await panel.getByRole('button', { name: '收起账户切换' }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('button', { name: '开发账号切换' })).toBeVisible();
});

test('interactions: private favorites, follows, staff highlights, sorting and archived cleanup', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const title = '一起分享志愿故事 · 更新';
  await login(page, 'forum-owner@example.test');
  await page.goto('/forum/c/e2e-circle');
  await page.getByRole('button', { name: '关注圈子', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消关注圈子', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: title, exact: true }).click();
  const postPath = new URL(page.url()).pathname;
  await page.getByLabel('评论', { exact: true }).fill('互动后这段草稿仍然保留');
  await page.getByRole('button', { name: '点赞', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消点赞', exact: true })).toContainText('1');
  await page.getByRole('button', { name: '收藏帖子', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消收藏', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('评论', { exact: true })).toHaveText('互动后这段草稿仍然保留');
  await expect(page.getByRole('button', { name: '置顶帖子', exact: true })).toHaveCount(0);
  await page.goto('/me/forum?tab=favorites');
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await page.getByRole('region', { name: '当前条目' }).getByRole('link', { name: `打开帖子：${title}`, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(postPath + '$'));
  await page.goto('/me/forum?tab=circles');
  await expect(page.getByRole('heading', { name: '测试交流圈', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '管理圈子', exact: true })).toHaveCount(0);
  await logout(page);

  await login(page, 'forum-steward@example.test');
  await page.goto('/me/forum?tab=favorites');
  await expect(page.getByText('还没有关注或收藏的内容', { exact: true })).toBeVisible();
  await page.goto('/me/forum?tab=circles');
  await expect(page.getByRole('treeitem', { name: '测试交流圈', exact: true }).getByRole('img', { name: '我管理的圈子', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: '管理圈子', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '所选圈子' })).toHaveText('测试交流圈');
  await expect(page.getByRole('region', { name: '所选圈子' }).getByRole('button')).toHaveCount(0);
  await page.goto('/forum/c/e2e-circle');
  await page.getByRole('button', { name: '发帖', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('最新发布对照');
  await page.getByLabel('正文', { exact: true }).fill('这是一篇新发的普通讨论，用于比较排序。');
  await page.getByRole('button', { name: '发布帖子', exact: true }).click();
  await expect(page.getByRole('heading', { name: '最新发布对照', exact: true })).toBeVisible();
  await page.goto('/forum/c/e2e-circle');
  await page.getByRole('button', { name: '最新发布', exact: true }).click();
  const discussions = page.getByRole('region', { name: '圈内讨论' });
  await expect(discussions.locator('article').first()).toContainText('最新发布对照');
  await page.getByRole('link', { name: '圈子管理', exact: true }).click();
  await page.getByRole('link', { name: title, exact: true }).click();
  await page.getByRole('button', { name: '置顶帖子', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消置顶', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '设为精华', exact: true }).click();
  await expect(page.getByRole('button', { name: '取消精华', exact: true })).toBeVisible();
  await page.goto('/forum/c/e2e-circle');
  await expect(discussions.locator('article').first()).toContainText(title);
  await expect(discussions.locator('article').first()).toContainText('置顶');
  await expect(discussions.locator('article').first()).toContainText('精华');
  for (const sort of ['最新回复', '最新发布', '热门']) {
    await page.getByRole('button', { name: sort, exact: true }).click();
    await expect(page.getByRole('button', { name: sort, exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(discussions.locator('article').first()).toContainText(title);
  }
  await page.getByLabel('只看精华').check();
  await expect(discussions.locator('article')).toHaveCount(1);
  await page.getByLabel('只看精华').uncheck();
  await expect(discussions.locator('article')).toHaveCount(2);
  await page.getByText('热门如何排序？', { exact: true }).click();
  await expect(page.getByText(/同一人反复评论只算一个参与者/)).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/volunteer-forum-phase4-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/volunteer-forum-phase4-mobile.png', fullPage: true });
  await page.goto(postPath);
  await expect(page.getByRole('heading', { name: /一起分享志愿故事/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '取消置顶', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '取消精华', exact: true })).toHaveCount(0);
  await expect(page.locator('article[id^="comment-"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/volunteer-forum-refined-post-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/volunteer-forum-refined-post-desktop.png', fullPage: true });
  await logout(page);

  await login(page, 'reset-admin@example.test');
  await page.goto('/forum/c/e2e-circle/manage');
  await page.getByRole('button', { name: '归档圈子', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复圈子', exact: true })).toBeVisible();
  await logout(page);
  await login(page, 'forum-owner@example.test');
  await page.goto('/me/forum?tab=favorites');
  await expect(page.getByRole('region', { name: '当前条目' })).toContainText('圈子已归档');
  await expect(page.getByRole('heading', { name: title, exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '当前条目' }).getByRole('link', { name: /打开帖子/ })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '当前条目' }).getByRole('button', { name: /收藏|关注|编辑|删除/ })).toHaveCount(0);
  // Archived resources have no ordinary reading page. The API still permits
  // idempotent cleanup, and the read-only directory reflects the changed data.
  const archivedCircleId = await page.evaluate(async postId => {
    const { postService } = await import('/src/services/postService.ts');
    const directory = await postService.directory();
    const circle = directory.circles.find(item => item.posts.some(post => post.id === postId));
    if (!circle) throw new Error('Archived favorite path is missing');
    await postService.engage(postId, 'favorite', false);
    await postService.engage(postId, 'favorite', false);
    return circle.id;
  }, postPath.split('/').pop());
  await page.getByRole('button', { name: '刷新目录', exact: true }).click();
  await expect(page.getByRole('tree', { name: '我的论坛目录' }).getByRole('img', { name: '收藏的帖子', exact: true })).toHaveCount(0);
  await page.goto('/me/forum?tab=circles');
  await expect(page.getByRole('region', { name: '所选圈子' })).toHaveText('已归档圈子');
  await expect(page.getByRole('region', { name: '所选圈子' }).getByRole('button')).toHaveCount(0);
  await page.evaluate(async circleId => {
    const { postService } = await import('/src/services/postService.ts');
    await postService.follow(circleId, false);
    await postService.follow(circleId, false);
  }, archivedCircleId);
  await page.getByRole('button', { name: '刷新目录', exact: true }).click();
  await expect(page.getByRole('tree', { name: '我的论坛目录' }).getByRole('img', { name: '关注的圈子', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '关注收藏', exact: true }).click();
  await expect(page.getByText('还没有关注或收藏的内容', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('messages: mobile unavailable notices, mark read, pure-admin reply inbox and comment navigation', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'forum-owner@example.test');
  await page.getByRole('link', { name: /^消息中心/ }).last().click();
  await expect(page.getByRole('heading', { name: '消息中心', exact: true })).toBeVisible();
  await expect(page.getByText('圈子已归档', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('一起分享志愿故事 · 更新', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '查看状态', exact: true }).first().click();
  await expect(page.getByRole('status')).toContainText('圈子已归档');
  await expect(page.getByRole('button', { name: '全部已读', exact: true })).toBeEnabled();
  await page.screenshot({ path: '/tmp/volunteer-messages-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: '全部已读', exact: true }).click();
  await expect(page.getByRole('link', { name: '消息中心，无未读消息', exact: true }).last()).toBeVisible();
  await page.getByRole('button', { name: '未读消息', exact: true }).click();
  await expect(page.getByRole('heading', { name: '没有未读消息', exact: true })).toBeVisible();
  await logout(page);
  await expect(page.getByRole('link', { name: /^消息中心/ })).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 900 });
  await login(page, 'reset-admin@example.test');
  await page.getByText('已归档圈子（1）', { exact: true }).click();
  await page.getByRole('link', { name: '管理归档圈子 测试交流圈', exact: true }).click();
  await page.getByRole('button', { name: '恢复圈子', exact: true }).click();
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await page.getByRole('link', { name: '查看圈子', exact: true }).click();
  await page.getByRole('button', { name: '发帖', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('消息里的交流');
  await page.getByLabel('正文', { exact: true }).fill('欢迎分享，一起让知识和经验更有温度。');
  await page.getByRole('button', { name: '发布帖子', exact: true }).click();
  await expect(page.getByRole('heading', { name: '消息里的交流', exact: true })).toBeVisible();
  const postPath = new URL(page.url()).pathname;
  await logout(page);

  await login(page, 'forum-steward@example.test');
  await page.getByRole('link', { name: /^消息中心/ }).first().click();
  await expect(page.getByText('任命你为圈务成员', { exact: true })).toBeVisible();
  const assigned = page.locator('article').filter({ hasText: '任命你为圈务成员' });
  await assigned.getByRole('button', { name: '查看详情', exact: true }).click();
  await expect(page).toHaveURL(/\/forum\/c\/e2e-circle\/manage$/);
  await page.goto(postPath);
  await page.getByLabel('评论', { exact: true }).fill('从消息找到这条回复 😊');
  await page.getByRole('button', { name: '发表评论', exact: true }).click();
  await expect(page.locator('article[id^="comment-"]')).toContainText('从消息找到这条回复 😊');
  const commentId = new URL(page.url()).searchParams.get('commentId');
  await logout(page);

  await login(page, 'reset-admin@example.test');
  await page.getByRole('link', { name: '消息中心，1 条未读', exact: true }).first().click();
  await expect(page.getByText('消息里的交流', { exact: true })).toBeVisible();
  await page.screenshot({ path: '/tmp/volunteer-messages-desktop.png', fullPage: true });
  const reply = page.locator('article').filter({ hasText: '评论了你的帖子' });
  await reply.getByRole('button', { name: '查看详情', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`commentId=${commentId}`));
  await expect(page.locator(`#comment-${commentId}`)).toContainText('从消息找到这条回复 😊');
  await expect(page.locator(`#comment-${commentId}`)).toHaveClass(/ring-primary/);
  await expect(page.getByRole('link', { name: '消息中心，无未读消息', exact: true }).first()).toBeVisible();
  await page.getByRole('link', { name: /^消息中心/ }).first().click();
  await page.getByRole('button', { name: '未读消息', exact: true }).click();
  await expect(page.getByRole('heading', { name: '没有未读消息', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

async function pasteImage(editor) {
  await editor.evaluate(async (element) => {
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 160;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f5ede1'; context.fillRect(0, 0, 480, 160);
    context.fillStyle = '#b76c1c'; context.fillRect(24, 24, 432, 8);
    context.font = '24px sans-serif'; context.fillText('Knowledge & experience', 24, 92);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const data = new DataTransfer(); data.items.add(new File([blob], 'clipboard.png', { type: 'image/png' }));
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  });
}
test('visual editor: legacy conversion, three heading levels, pasted images, persisted edits and image-only comments', async ({ page }) => {
  const errors = []; page.on('pageerror', (error) => errors.push(error.message));
  await login(page, 'forum-owner@example.test');
  // Compatibility fixture through the real authenticated API, as an older client.
  const old = await page.evaluate(async () => {
    const { postService } = await import('/src/services/postService.ts');
    return postService.create('e2e-circle', { title: '旧格式文章测试', body: '## 原有标题\n\n**原有正文**，继续编辑。' });
  });
  await page.goto(`/forum/p/${old.id}`);
  await page.getByRole('button', { name: '编辑帖子', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '编辑帖子' });
  const editor = dialog.getByRole('textbox', { name: '正文', exact: true });
  await expect(editor.locator('h2')).toHaveText('原有标题');
  await expect(editor.locator('strong')).toHaveText('原有正文');
  await expect(editor).not.toContainText('##');
  await dialog.getByLabel('标题', { exact: true }).fill('图文一起分享');
  await editor.fill('一级标题');
  await dialog.getByLabel('段落样式').selectOption('1');
  for (const [level, text] of [['2', '二级标题'], ['3', '三级标题']]) {
    await editor.press('End'); await editor.press('Enter');
    await dialog.getByLabel('段落样式').selectOption(level); await page.keyboard.insertText(text);
  }
  await editor.press('End'); await editor.press('Enter');
  await dialog.getByLabel('段落样式').selectOption('paragraph');
  await page.keyboard.insertText('直接看到文字的排版效果');
  await editor.press('Home'); await editor.press('Shift+End');
  await dialog.getByRole('button', { name: '加粗', exact: true }).click();
  await dialog.getByRole('button', { name: '下划线', exact: true }).click();
  await expect(editor.locator('strong')).toContainText('直接看到文字的排版效果');
  await expect(editor.locator('u')).toContainText('直接看到文字的排版效果');
  await editor.press('ArrowRight'); await editor.press('Enter');
  await dialog.getByRole('button', { name: '清除格式', exact: true }).click();
  await pasteImage(editor);
  await expect(editor.locator('img')).toBeVisible();
  await expect(dialog.getByRole('button', { name: '保存修改', exact: true })).toBeEnabled();
  await page.screenshot({ path: '/tmp/volunteer-rich-editor-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog.getByRole('button', { name: '保存修改', exact: true })).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/volunteer-rich-editor-mobile.png', fullPage: true });
  await dialog.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.getByRole('heading', { name: '图文一起分享', exact: true })).toBeVisible();
  await page.reload();
  const post = page.locator('article').first();
  await expect(post.getByRole('heading', { name: '一级标题', exact: true })).toBeVisible();
  await expect(post.getByRole('heading', { name: '二级标题', exact: true })).toBeVisible();
  await expect(post.getByRole('heading', { name: '三级标题', exact: true })).toBeVisible();
  await expect(post.locator('img')).toBeVisible();
  expect(await post.locator('img').evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
  await post.getByRole('button', { name: '放大图片', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '查看图片' }).locator('img')).toBeVisible();
  await page.keyboard.press('Escape');
  const comment = page.getByRole('textbox', { name: '评论', exact: true });
  await comment.click(); await pasteImage(comment);
  await expect(comment.locator('img')).toBeVisible();
  await page.getByRole('button', { name: '发表评论', exact: true }).click();
  await expect(page.locator('article[id^="comment-"] img')).toBeVisible();
  await page.getByRole('button', { name: '编辑评论', exact: true }).click();
  const edit = page.getByRole('dialog', { name: '编辑评论' });
  await expect(edit.locator('img')).toBeVisible();
  await edit.locator('img').click();
  await edit.getByRole('button', { name: '移除图片', exact: true }).click();
  await expect(edit.locator('img')).toHaveCount(0);
  await edit.getByRole('textbox', { name: '评论', exact: true }).fill('改成文字后移除图片');
  await edit.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(page.locator('article[id^="comment-"]')).toContainText('改成文字后移除图片');
  await page.reload();
  await expect(page.locator('article[id^="comment-"]')).toContainText('改成文字后移除图片');
  await expect(page.locator('article[id^="comment-"] figure')).toHaveCount(0);
  await expect(page.locator('article[id^="comment-"] img')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/volunteer-rich-post-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('image tools: proportional drag resize, alignment, editable annotations and retained temporary edits', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await login(page, 'forum-owner@example.test');
  const post = await page.evaluate(async () => {
    const { postService } = await import('/src/services/postService.ts');
    return postService.create('e2e-circle', { title: '图片编辑测试', body: '图片说明' });
  });
  await page.goto(`/forum/p/${post.id}`);
  await page.getByRole('button', { name: '编辑帖子', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '编辑帖子', exact: true });
  const editor = dialog.getByRole('textbox', { name: '正文', exact: true });
  await editor.click(); await editor.press('Control+End'); await editor.press('Enter'); await pasteImage(editor);
  const img = editor.locator('img'); await expect(img).toBeVisible();
  await img.click(); await expect(dialog.getByText('图片宽度', { exact: true })).toHaveCount(0);
  const before = await img.boundingBox();
  const handle = editor.getByRole('button', { name: '从右下角等比例缩放图片', exact: true });
  await handle.scrollIntoViewIfNeeded(); const h = await handle.boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 - before.width * 0.4, h.y + h.height / 2, { steps: 8 }); await page.mouse.up();
  const after = await img.boundingBox(); expect(after.width).toBeLessThan(before.width * 0.75); expect(after.width / after.height).toBeCloseTo(before.width / before.height, 1);
  await dialog.getByRole('button', { name: '居中', exact: true }).click();
  await expect(dialog.getByRole('button', { name: '居中', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: '标注图片', exact: true }).click();
  const annotation = page.getByRole('dialog', { name: '标注图片', exact: true });
  const canvas = annotation.getByRole('application', { name: '图片标注画布' }); await expect(canvas).toBeVisible();
  const draw = async (start, end) => {
    const box = await annotation.getByRole('img', { name: '待标注图片', exact: true }).boundingBox(); await page.mouse.move(box.x + box.width * start[0], box.y + box.height * start[1]); await page.mouse.down();
    await page.mouse.move(box.x + box.width * end[0], box.y + box.height * end[1], { steps: 6 }); await page.mouse.up();
  };
  await draw([0.12, 0.2], [0.4, 0.45]);
  await annotation.getByRole('button', { name: '直线', exact: true }).click(); await draw([0.15, 0.7], [0.35, 0.8]);
  await annotation.getByRole('button', { name: '画笔', exact: true }).click(); await draw([0.1, 0.85], [0.4, 0.95]);
  await annotation.getByRole('button', { name: '圆角方框', exact: true }).click();
  const setControl = async (name, value) => annotation.getByLabel(name).evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await setControl('标注颜色', '#176b43'); await setControl('标注粗细', '8');
  await draw([0.55, 0.15], [0.7, 0.55]);
  await annotation.getByRole('button', { name: '圆角方框', exact: true }).click();
  await annotation.getByLabel('方框填充').selectOption('solid'); await draw([0.8, 0.15], [0.95, 0.55]);
  await annotation.getByRole('button', { name: '文字', exact: true }).click();
  await setControl('标注字号', '42');
  const box = await annotation.getByRole('img', { name: '待标注图片', exact: true }).boundingBox();
  await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.7);
  await annotation.getByRole('textbox', { name: '标注文字', exact: true }).fill('一起交流');
  await annotation.getByRole('button', { name: '选择与移动', exact: true }).click();
  await expect(canvas.locator('text')).toHaveText('一起交流');
  await annotation.getByRole('button', { name: '撤销标注', exact: true }).click(); await expect(canvas.locator('text')).toHaveCount(0);
  await annotation.getByRole('button', { name: '重做标注', exact: true }).click(); await expect(canvas.locator('text')).toHaveText('一起交流');
  await canvas.locator('[data-mark="4"] rect').first().click();
  const resize = canvas.locator('[data-resize]'); await expect(resize).toBeVisible();
  const corner = await resize.boundingBox();
  const solid = canvas.locator('[data-mark="4"] rect').first(); const solidBefore = await solid.boundingBox();
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2); await page.mouse.down();
  await page.mouse.move(corner.x - 25, corner.y - 15, { steps: 4 }); await page.mouse.up();
  expect((await solid.boundingBox()).width).toBeLessThan(solidBefore.width);
  const movedBefore = await solid.boundingBox();
  await page.mouse.move(movedBefore.x + movedBefore.width / 2, movedBefore.y + movedBefore.height / 2); await page.mouse.down();
  await page.mouse.move(movedBefore.x + movedBefore.width / 2 - 12, movedBefore.y + movedBefore.height / 2 + 10, { steps: 4 }); await page.mouse.up();
  expect((await solid.boundingBox()).x).toBeLessThan(movedBefore.x);
  await annotation.getByRole('button', { name: '删除所选标注' }).click();
  await expect(canvas.locator('g[data-mark]')).toHaveCount(5);
  await annotation.getByRole('button', { name: '撤销标注', exact: true }).click();
  await page.screenshot({ path: '/tmp/forum-annotations-desktop.png', fullPage: true });
  await annotation.getByRole('button', { name: '应用标注', exact: true }).click();
  await expect(annotation).toHaveCount(0); await expect(editor.locator('svg text')).toHaveText('一起交流');
  await dialog.getByRole('button', { name: '标注图片', exact: true }).click();
  await expect(canvas.locator('text')).toHaveText('一起交流');
  await annotation.getByRole('button', { name: '选择与移动', exact: true }).click();
  await canvas.locator('text').dblclick();
  await annotation.getByRole('textbox', { name: '标注文字', exact: true }).fill('尚未应用的修改');
  await annotation.getByRole('button', { name: '返回编辑', exact: true }).click();
  await expect(annotation).toHaveCount(0); await expect(dialog).toBeVisible();
  await expect(editor.locator('svg text')).toHaveText('一起交流');
  await dialog.getByRole('button', { name: '标注图片', exact: true }).click();
  await expect(canvas.locator('text')).toHaveText('尚未应用的修改');
  await annotation.getByRole('button', { name: '返回编辑', exact: true }).click();
  await dialog.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(dialog).toHaveCount(0); await page.reload();
  const persisted = await page.evaluate(async (id) => {
    const { postService } = await import('/src/services/postService.ts');
    return JSON.parse((await postService.get(id)).body).content.find(node => node.type === 'forumImage').attrs;
  }, post.id);
  expect(persisted.align).toBe('center'); expect(persisted.annotations.map(mark => mark.kind)).toEqual(['arrow', 'line', 'pen', 'rect', 'rect', 'text']);
  expect(persisted.annotations[3]).toMatchObject({ color: '#176b43', size: 8, filled: false });
  expect(persisted.annotations[4].filled).toBe(true); expect(persisted.annotations[5].size).toBe(42);
  const figure = page.locator('article').first().locator('figure');
  await expect(figure.locator('svg text')).toHaveText('一起交流');
  expect(await figure.evaluate(el => el.style.marginLeft)).toBe('auto');
  expect(await figure.evaluate(el => parseFloat(el.style.width))).toBeLessThan(75);
  await figure.getByRole('button', { name: '放大图片' }).click();
  await expect(page.getByRole('dialog', { name: '查看图片' }).locator('svg text')).toHaveText('一起交流');
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '编辑帖子', exact: true }).click(); await editor.locator('img').click();
  await dialog.getByRole('button', { name: '标注图片', exact: true }).click(); await expect(canvas).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(annotation.getByRole('button', { name: '应用标注' })).toBeEnabled();
  await expect(annotation.getByRole('button', { name: '应用标注' })).toBeInViewport({ ratio: 1 });
  await page.screenshot({ path: '/tmp/forum-annotations-mobile.png', fullPage: true });
  await annotation.getByRole('button', { name: '返回编辑', exact: true }).click();
  expect(errors).toEqual([]);
});

test('image caret: one resize handle, before/after Enter, selected Enter and typing preserve pictures', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await login(page, 'forum-owner@example.test');
  const post = await page.evaluate(async () => {
    const { postService } = await import('/src/services/postService.ts');
    return postService.create('e2e-circle', { title: '图片前后光标', body: '原有正文' });
  });
  await page.goto(`/forum/p/${post.id}`); await page.getByRole('button', { name: '编辑帖子', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '编辑帖子', exact: true });
  const editor = dialog.getByRole('textbox', { name: '正文', exact: true });
  await editor.fill(''); await pasteImage(editor); await expect(editor.locator('img')).toBeVisible();
  await editor.locator('img').click();
  await expect(editor.getByRole('button', { name: '从右下角等比例缩放图片' })).toBeVisible();
  await expect(editor.getByRole('button', { name: '从左下角等比例缩放图片' })).toHaveCount(0);
  const originalParagraphs = await editor.locator('p').count();
  await editor.getByRole('button', { name: '将光标放到图片前' }).click();
  await expect(editor.getByRole('button', { name: '将光标放到图片前' })).toHaveAttribute('aria-pressed', 'true');
  expect(await editor.locator('p').count()).toBe(originalParagraphs);
  await page.screenshot({ path: '/tmp/forum-image-caret-desktop.png', fullPage: true });
  await page.keyboard.press('Enter'); await page.keyboard.insertText('图片之前');
  await expect(editor.locator('img')).toBeVisible();
  await editor.getByRole('button', { name: '将光标放到图片后' }).click();
  await expect(editor.getByRole('button', { name: '将光标放到图片后' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Enter'); await page.keyboard.insertText('图片之后');
  await editor.locator('img').click(); await page.keyboard.press('Enter'); await page.keyboard.insertText('选中图片直接换行');
  await editor.locator('img').click(); await page.keyboard.press('ArrowLeft');
  await expect(editor.getByRole('button', { name: '将光标放到图片前' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.insertText('光标前直接输入');
  await editor.locator('img').click(); await page.keyboard.press('ArrowRight');
  await expect(editor.getByRole('button', { name: '将光标放到图片后' })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.insertText('光标后直接输入');
  await expect(editor.locator('img')).toHaveCount(1);
  await dialog.getByRole('button', { name: '保存修改', exact: true }).click(); await expect(dialog).toHaveCount(0); await page.reload();
  const content = await page.evaluate(async id => {
    const { postService } = await import('/src/services/postService.ts'); return JSON.parse((await postService.get(id)).body).content;
  }, post.id);
  const imageAt = content.findIndex(n => n.type === 'forumImage');
  expect(content.slice(0, imageAt).flatMap(n => n.content || []).map(n => n.text)).toEqual(['图片之前', '光标前直接输入']);
  expect(content.slice(imageAt + 1).flatMap(n => n.content || []).map(n => n.text)).toEqual(['光标后直接输入', '选中图片直接换行', '图片之后']);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '编辑帖子', exact: true }).click();
  await editor.getByRole('button', { name: '将光标放到图片后' }).click();
  await page.keyboard.press('Enter'); await page.keyboard.insertText('手机继续写');
  await expect(editor).toContainText('手机继续写'); await expect(editor.locator('img')).toHaveCount(1);
  await page.screenshot({ path: '/tmp/forum-image-caret-mobile.png', fullPage: true });
  await dialog.getByRole('button', { name: '保存修改', exact: true }).click();
  expect(errors).toEqual([]);
});

test('circle assets: covers, downloads and file restoration', async ({ page }) => {
  await login(page, 'forum-steward@example.test');
  await page.goto('/forum/c/e2e-circle/manage');
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 640; c.height = 240; const ctx = c.getContext('2d'); ctx.fillStyle = '#d7b98c'; ctx.fillRect(0, 0, 640, 240); ctx.fillStyle = '#544331'; ctx.font = '30px sans-serif'; ctx.fillText('Together, we grow.', 170, 130); return c.toDataURL().split(',')[1]; });
  await page.getByLabel('选择圈子封面').setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByRole('img', { name: '测试交流圈的封面' })).toBeVisible();
  await page.getByLabel('选择圈文件').setInputFiles({ name: '交流资料.txt', mimeType: 'text/plain', buffer: Buffer.from('知识与经验') });
  await expect(page.getByRole('button', { name: '下载 交流资料.txt' })).toBeVisible();
  await logout(page);
  await login(page, 'forum-owner@example.test');
  await expect(page.getByRole('img', { name: '测试交流圈的封面' })).toBeVisible();
  await page.goto('/forum/c/e2e-circle');
  await expect(page.getByRole('img', { name: '测试交流圈的封面' })).toBeVisible();
  await page.getByRole('button', { name: '圈文件', exact: true }).click();
  await expect(page.getByRole('button', { name: '上传圈文件' })).toHaveCount(0);
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 交流资料.txt' }).click();
  expect((await downloaded).suggestedFilename()).toBe('交流资料.txt');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/tmp/forum-assets-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await logout(page);
  await login(page, 'forum-steward@example.test');
  await page.goto('/forum/c/e2e-circle/manage');
  await page.getByRole('button', { name: '移除 交流资料.txt' }).click();
  await page.getByRole('button', { name: '确认移除', exact: true }).click();
  await expect(page.getByRole('button', { name: '恢复 交流资料.txt' })).toBeVisible();
  await page.getByRole('button', { name: '恢复 交流资料.txt' }).click();
  await expect(page.getByRole('button', { name: '移除 交流资料.txt' })).toBeVisible();
});

test('mentions: selecting recipients in posts and comments delivers inbox links', async ({ page }) => {
  await login(page, 'forum-owner@example.test');
  await page.goto('/forum/c/e2e-circle');
  await page.getByRole('button', { name: '发帖', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('提及交流测试');
  const body = page.getByRole('textbox', { name: '正文', exact: true });
  await body.fill('@协管');
  await expect(page.getByRole('option', { name: /协管测试/ })).toBeVisible();
  await body.press('Enter');
  await expect(body.locator('[data-forum-mention]')).toHaveText('@协管测试');
  await page.getByRole('button', { name: '发布帖子', exact: true }).click();
  await expect(page.getByRole('heading', { name: '提及交流测试', exact: true })).toBeVisible();
  const url = page.url();
  await expect(page.locator('article').first().getByRole('img', { name: '圈主测试的默认头像' })).toBeVisible();
  await logout(page);
  await login(page, 'forum-steward@example.test');
  await page.getByRole('link', { name: /^消息中心/ }).first().click();
  await expect(page.getByText('在帖子中提及了你', { exact: true })).toBeVisible();
  await page.locator('article').filter({ hasText: '在帖子中提及了你' }).getByRole('button', { name: '查看详情' }).click();
  await expect(page).toHaveURL(url);
  const comment = page.getByRole('textbox', { name: '评论', exact: true });
  await comment.fill('@圈主');
  await page.getByRole('option', { name: /圈主测试/ }).click();
  await page.getByRole('button', { name: '发表评论', exact: true }).click();
  await expect(page.locator('article[id^="comment-"]').getByRole('img', { name: '协管测试的默认头像' })).toBeVisible();
  await logout(page);
  await login(page, 'forum-owner@example.test');
  await page.getByRole('link', { name: /^消息中心/ }).first().click();
  await page.locator('article').filter({ hasText: '在评论中提及了你' }).getByRole('button', { name: '查看详情' }).click();
  await expect(page).toHaveURL(/commentId=/);
  await expect(page.locator('article[id^="comment-"]')).toContainText('@圈主测试');
});

test('drafts and comment tools: reload recovery, twenty images, author pins and comment favorites', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, 'forum-owner@example.test');
  await page.goto('/forum/c/e2e-circle');
  await expect(page.getByRole('heading', { name: '圈内讨论', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '发帖', exact: true })).toHaveAttribute('title', '发帖');
  await expect(page.getByRole('button', { name: '发帖', exact: true })).toHaveCSS('position', 'fixed');
  await page.getByRole('button', { name: '发帖', exact: true }).click();
  await page.getByLabel('标题', { exact: true }).fill('草稿与评论工具验收');
  await page.getByLabel('正文', { exact: true }).fill('刷新页面后继续完成这篇图文草稿。');
  await page.getByLabel('正文', { exact: true }).press('ControlOrMeta+a');
  await page.getByRole('button', { name: '加粗', exact: true }).click();
  await page.getByLabel('正文', { exact: true }).press('ArrowRight');
  const png = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 24; canvas.height = 16; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#d7b98c'; ctx.fillRect(0, 0, 24, 16); return canvas.toDataURL().split(',')[1]; });
  const files = Array.from({ length: 20 }, (_, i) => ({ name: `draft-${i}.png`, mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }));
  await page.getByLabel('选择图片', { exact: true }).setInputFiles(files);
  await expect(page.locator('.tiptap img')).toHaveCount(20);
  await expect(page.getByRole('button', { name: '发布帖子', exact: true })).toBeEnabled();
  await page.reload();
  await page.getByRole('button', { name: '发帖', exact: true }).click();
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('草稿与评论工具验收');
  await expect(page.getByLabel('正文', { exact: true }).locator('strong')).toContainText('刷新页面后继续完成');
  await expect(page.locator('.tiptap img')).toHaveCount(20);
  await page.getByRole('button', { name: '发布帖子', exact: true }).click();
  await expect(page.getByRole('heading', { name: '草稿与评论工具验收', exact: true })).toBeVisible();
  const postPath = new URL(page.url()).pathname;
  await page.goto('/forum/c/e2e-circle');
  await page.getByRole('button', { name: '发帖', exact: true }).click();
  await expect(page.getByLabel('标题', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: '取消', exact: true }).click();
  await page.goto(postPath);
  await page.getByLabel('评论', { exact: true }).fill('需要恢复的回复草稿');
  await page.reload();
  await expect(page.getByLabel('评论', { exact: true })).toHaveText('需要恢复的回复草稿');
  await page.getByLabel('选择图片', { exact: true }).setInputFiles(files);
  await expect(page.locator('.tiptap img')).toHaveCount(20);
  await page.getByRole('button', { name: '发表评论', exact: true }).click();
  const first = page.locator('article[id^="comment-"]').filter({ hasText: '需要恢复的回复草稿' });
  await expect(first).toBeVisible();
  await expect(page.getByLabel('评论', { exact: true })).toHaveText('');
  await page.getByLabel('评论', { exact: true }).fill('值得置顶的回复');
  await page.getByRole('button', { name: '发表评论', exact: true }).click();
  await page.locator('article[id^="comment-"]').filter({ hasText: '值得置顶的回复' }).getByRole('button', { name: '置顶评论', exact: true }).click();
  await expect(page.locator('article[id^="comment-"]').first()).toContainText('值得置顶的回复');
  await expect(page.locator('article[id^="comment-"]').first()).toContainText('帖主置顶');
  await logout(page);
  await login(page, 'forum-steward@example.test');
  await page.goto(postPath);
  await expect(page.getByRole('button', { name: '置顶评论', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '取消置顶评论', exact: true })).toHaveCount(0);
  await page.locator('article[id^="comment-"]').first().getByRole('button', { name: '收藏评论', exact: true }).click();
  await page.goto('/me/forum?tab=favorites&kind=comments');
  await expect(page.getByRole('button', { name: '关注收藏', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('treeitem', { name: '草稿与评论工具验收', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tree', { name: '我的论坛目录' }).getByText('值得置顶的回复', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: '当前条目' }).getByText('值得置顶的回复', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/commentId=/);
  await expect(page.locator('article[id^="comment-"]').first()).toContainText('值得置顶的回复');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.goto('/me/forum?tab=favorites&kind=comments');
  await expect(page.getByRole('region', { name: '当前条目' }).getByRole('button', { name: /收藏|评论/ })).toHaveCount(0);
  await page.getByRole('region', { name: '当前条目' }).getByRole('link', { name: '查看原文', exact: true }).click();
  await page.locator('article[id^="comment-"]').filter({ hasText: '值得置顶的回复' }).getByRole('button', { name: '取消收藏评论', exact: true }).click();
  await expect(page.locator('article[id^="comment-"]').filter({ hasText: '值得置顶的回复' }).getByRole('button', { name: '收藏评论', exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: '刷新目录', exact: true }).click();
  await expect(page.getByText('还没有关注或收藏的内容', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('directory workspace: two title levels, linked post summaries, stacked related comments and independent relations', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // These circles are independent of the other workflows and contain deliberate
  // unrelated content, so a broad circle/post expansion cannot pass unnoticed.
  await login(page, 'reset-admin@example.test');
  const fixture = await page.evaluate(async () => {
    const { forumService } = await import('/src/services/forumService.ts');
    const { postService } = await import('/src/services/postService.ts');
    const owner = (await forumService.candidates('圈主测试')).find(account => account.name === '圈主测试');
    const other = (await forumService.candidates('接任测试')).find(account => account.name === '接任测试');
    if (!owner || !other) throw new Error('Directory test accounts are missing');
    const suffix = Date.now();
    const createCircle = (name, key, ownerId = other.accountId) => forumService.create({
      name, slug: `directory-${key}-${suffix}`, description: `${name}的介绍`, ownerIds: [ownerId],
    });
    const managed = await createCircle('目录管理圈', 'managed', owner.accountId);
    const stewarded = await createCircle('目录协管圈', 'stewarded');
    await forumService.setRole(stewarded.id, owner.accountId, 'STEWARD');
    const followed = await createCircle('目录关注圈', 'followed');
    const paths = await createCircle('评论路径圈', 'paths');
    const saved = await createCircle('帖子收藏路径圈', 'saved');
    const unrelated = await createCircle('无关目录圈', 'unrelated');
    await postService.create(managed.slug, { title: '管理圈内无关帖子', body: '管理关系不应自动把这篇帖子挂到目录。' });
    await postService.create(stewarded.slug, { title: '协管圈内无关帖子', body: '协管关系只到圈子这一层。' });
    await postService.create(followed.slug, { title: '关注圈内无关帖子', body: '关注关系只到圈子这一层。' });
    await postService.create(unrelated.slug, { title: '完全无关帖子', body: '不应在个人目录出现。' });
    const mineParent = await postService.create(paths.slug, { title: '我评论过的路径帖子', body: '这篇帖子属于其他人。' });
    await postService.addComment(mineParent.id, '路径帖子中与我无关的评论');
    const savedParent = await postService.create(paths.slug, { title: '收藏评论的路径帖子', body: '仅收藏其中一条评论。' });
    const savedComment = await postService.addComment(savedParent.id, '只收藏这条评论，不收藏它的父级');
    const savedPost = await postService.create(saved.slug, { title: '仅收藏标题的帖子', body: '收藏帖子仅到帖子这一层。' });
    await postService.addComment(savedPost.id, '没有收藏也不是我发布的普通评论');
    await postService.create(saved.slug, { title: '收藏帖子旁的无关帖子', body: '收藏一篇帖子不应扩大收录范围。' });
    return { managed, stewarded, followed, paths, saved, unrelated, mineParent, savedParent, savedComment, savedPost };
  });
  await logout(page);
  await login(page, 'forum-owner@example.test');
  const own = await page.evaluate(async fixture => {
    const { postService } = await import('/src/services/postService.ts');
    const mineComment = await postService.addComment(fixture.mineParent.id, '我的路径评论，只在右侧显示');
    const bothPost = await postService.create(fixture.managed.slug, {
      title: '我的并且收藏的帖子',
      body: [
        '同一条目保留两种关系。' + '这段较长的介绍用于检查默认摘要，让正文下方的评论优先进入视线。'.repeat(18),
        '- **展开后保留列表和加粗**\n- 第二条完整列表内容',
        '正文末尾的完整段落，收起时不显示。',
      ].join('\n\n'),
    });
    const bothComment = await postService.addComment(bothPost.id, [
      '我的并且收藏的评论',
      '- **评论中的完整列表**\n- 评论第二条列表内容',
      '相关评论末尾的完整段落直接显示。',
    ].join('\n\n'));
    const extraComments = [];
    for (let index = 2; index <= 4; index += 1) {
      extraComments.push(await postService.addComment(bothPost.id, `第 ${index} 条我的相关评论直接堆叠显示`));
    }
    await postService.follow(fixture.managed.id, true);
    await postService.follow(fixture.followed.id, true);
    await postService.engage(bothPost.id, 'favorite', true);
    await postService.commentEngage(bothComment.id, 'favorite', true);
    await postService.engage(fixture.savedPost.id, 'favorite', true);
    await postService.commentEngage(fixture.savedComment.id, 'favorite', true);
    return { mineComment, bothPost, bothComment, extraComments };
  }, fixture);

  await page.goto('/me');
  await expect(page.getByRole('link', { name: '打开我的论坛', exact: true })).toHaveCount(1);
  for (const oldLabel of ['我的圈子', '我的帖子', '我的评论', '我的收藏']) {
    await expect(page.getByRole('link', { name: oldLabel, exact: true })).toHaveCount(0);
  }
  await page.getByRole('link', { name: '打开我的论坛', exact: true }).click();
  const tree = page.getByRole('tree', { name: '我的论坛目录' });
  const current = page.getByRole('region', { name: '当前条目', exact: true });
  const row = name => tree.getByRole('treeitem', { name, exact: true });
  const selectCircle = name => row(name).locator(':scope > div').click();
  const filter = name => page.getByRole('navigation', { name: '论坛关系筛选' }).getByRole('button', { name, exact: true });
  await expect(tree).toBeVisible();
  await expect(filter('全部')).toHaveAttribute('aria-pressed', 'true');
  await expect(row('评论路径圈')).toHaveAttribute('aria-level', '1');
  await expect(row('我评论过的路径帖子')).toHaveAttribute('aria-level', '2');
  await expect(row('收藏评论的路径帖子')).toHaveAttribute('aria-level', '2');
  await expect(tree.locator('[role="treeitem"]:not([aria-level="1"]):not([aria-level="2"])')).toHaveCount(0);
  for (const text of ['我的路径评论，只在右侧显示', '只收藏这条评论，不收藏它的父级', '我的并且收藏的评论']) {
    await expect(tree.getByText(text, { exact: true })).toHaveCount(0);
  }
  for (const name of ['评论路径圈', '我评论过的路径帖子', '收藏评论的路径帖子']) {
    await expect(row(name).getByRole('img')).toHaveCount(0);
  }
  for (const name of ['无关目录圈', '完全无关帖子', '管理圈内无关帖子', '协管圈内无关帖子', '关注圈内无关帖子', '收藏帖子旁的无关帖子']) {
    await expect(row(name)).toHaveCount(0);
  }
  await expect(row('目录协管圈').getByRole('img', { name: '我管理的圈子', exact: true })).toBeVisible();
  await expect(row('目录协管圈').getByRole('group')).toHaveCount(0);
  await expect(row('目录关注圈').getByRole('img', { name: '关注的圈子', exact: true })).toBeVisible();
  await expect(row('目录关注圈').getByRole('group')).toHaveCount(0);
  await expect(row('目录管理圈').getByRole('img', { name: '我管理的圈子', exact: true })).toHaveCount(1);
  await expect(row('目录管理圈').getByRole('img', { name: '关注的圈子', exact: true })).toHaveCount(1);
  await expect(row('我的并且收藏的帖子')).toHaveCount(1);
  await expect(row('我的并且收藏的帖子').getByRole('img', { name: '我发布的帖子', exact: true })).toHaveCount(1);
  await expect(row('我的并且收藏的帖子').getByRole('img', { name: '收藏的帖子', exact: true })).toHaveCount(1);

  await selectCircle('帖子收藏路径圈');
  const circleCard = current.getByRole('region', { name: '所选圈子', exact: true });
  await expect(circleCard).toHaveText('帖子收藏路径圈');
  await expect(circleCard.getByRole('link', { name: '进入圈子：帖子收藏路径圈', exact: true })).toBeVisible();
  await expect(circleCard.locator('svg, img')).toHaveCount(1);
  await expect(circleCard.getByRole('button')).toHaveCount(0);
  await expect(circleCard.getByRole('img', { name: /我管理的圈子|关注的圈子/ })).toHaveCount(0);
  await expect(current.getByRole('heading', { name: '仅收藏标题的帖子', exact: true })).toBeVisible();
  await expect(current.getByText('没有收藏也不是我发布的普通评论', { exact: true })).toHaveCount(0);
  await expect(current.getByRole('heading', { name: /相关评论/ })).toHaveCount(0);
  await expect(row('帖子收藏路径圈').getByRole('img', { name: '关注的圈子', exact: true })).toHaveCount(0);
  await expect(row('帖子收藏路径圈')).toHaveAttribute('aria-selected', 'true');
  await current.getByRole('link', { name: '进入圈子：帖子收藏路径圈', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/forum/c/${fixture.saved.slug}$`));
  await expect(page.getByRole('heading', { name: '帖子收藏路径圈', exact: true })).toBeVisible();
  await page.goBack();
  await current.getByRole('link', { name: '打开帖子：仅收藏标题的帖子', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/forum/p/${fixture.savedPost.id}$`));
  await expect(page.getByRole('heading', { name: '仅收藏标题的帖子', exact: true })).toBeVisible();
  await page.goBack();

  await row('仅收藏标题的帖子').click();
  await expect(row('仅收藏标题的帖子')).toHaveAttribute('aria-selected', 'true');
  await expect(current.getByText('没有收藏也不是我发布的普通评论', { exact: true })).toHaveCount(0);
  await current.getByRole('link', { name: '打开帖子：仅收藏标题的帖子', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/forum/p/${fixture.savedPost.id}$`));
  await page.goBack();
  await filter('我的参与').click();
  await expect(filter('我的参与')).toHaveAttribute('aria-pressed', 'true');
  await expect(row('仅收藏标题的帖子')).toHaveCount(0);
  await expect(row('收藏评论的路径帖子')).toHaveCount(0);
  await expect(row('目录关注圈')).toHaveCount(0);
  await expect(tree.locator('[aria-selected="true"]')).toHaveCount(1);
  await row('我评论过的路径帖子').click();
  await expect(row('我评论过的路径帖子')).toHaveAttribute('aria-selected', 'true');
  await expect(current.locator(`#comment-${own.mineComment.id}`)).toHaveClass(/ring-primary/);
  await expect(current.locator(`#comment-${own.mineComment.id}`).getByRole('img', { name: '我的评论', exact: true })).toBeVisible();
  await expect(current.getByText('路径帖子中与我无关的评论', { exact: true })).toHaveCount(0);

  await filter('关注收藏').click();
  await expect(filter('关注收藏')).toHaveAttribute('aria-pressed', 'true');
  await expect(row('我评论过的路径帖子')).toHaveCount(0);
  await expect(row('目录协管圈')).toHaveCount(0);
  await expect(row('收藏评论的路径帖子')).toBeVisible();
  await expect(row('评论路径圈').getByRole('img')).toHaveCount(0);
  await expect(row('我的并且收藏的帖子')).toHaveCount(1);
  await expect(tree.locator('[aria-selected="true"]')).toHaveCount(1);
  await selectCircle('评论路径圈');
  const savedPreview = current.getByRole('article').filter({ hasText: '只收藏这条评论，不收藏它的父级' });
  await expect(savedPreview.getByRole('img', { name: '收藏的评论', exact: true })).toBeVisible();
  const savedOriginal = savedPreview.getByRole('link', { name: '查看原文', exact: true });
  await expect(savedOriginal).toHaveAttribute('href', `/forum/p/${fixture.savedParent.id}?commentId=${fixture.savedComment.id}`);
  await expect(savedOriginal).toHaveText('');
  await expect(savedPreview.getByRole('button')).toHaveCount(0);
  await savedOriginal.click();
  await expect(page).toHaveURL(new RegExp(`/forum/p/${fixture.savedParent.id}\\?commentId=${fixture.savedComment.id}$`));
  await expect(page.locator(`#comment-${fixture.savedComment.id}`)).toHaveClass(/ring-primary/);
  await page.goBack();
  await row('收藏评论的路径帖子').click();
  await expect(row('收藏评论的路径帖子')).toHaveAttribute('aria-selected', 'true');
  await expect(current.locator(`#comment-${fixture.savedComment.id}`)).toHaveClass(/ring-primary/);

  await filter('全部').click();
  await selectCircle('目录管理圈');
  const postStack = current.getByRole('region', { name: '帖子及相关评论：我的并且收藏的帖子', exact: true });
  const postSummary = postStack.getByRole('region', { name: '帖子摘要：我的并且收藏的帖子', exact: true });
  const bothPreview = postStack.locator(`#comment-${own.bothComment.id}`);
  const expectStackedComments = async count => {
    // Comments are siblings below the post card, never nested inside its border.
    await expect(postStack.locator(':scope > article[id^="comment-"]')).toHaveCount(count);
    await expect(postSummary.getByRole('article')).toHaveCount(0);
    await expect(postStack.getByRole('button', { name: /展开其余.*相关评论|收起评论/ })).toHaveCount(0);
    await expect(current.getByRole('heading', { name: '参与讨论', exact: true })).toHaveCount(0);
    await expect(current.getByRole('textbox', { name: '评论', exact: true })).toHaveCount(0);
    await expect(postStack.getByRole('button', { name: /评论|讨论|收藏|点赞|置顶|精华|编辑|删除|恢复|关注|管理/ })).toHaveCount(0);
    await expect(current.getByRole('link', { name: '管理圈子', exact: true })).toHaveCount(0);
    await expect(postStack.getByRole('button')).toHaveCount(0);
    await expect(postStack.locator(':scope > article').getByRole('button')).toHaveCount(0);
    await expect(postStack.locator(':scope > article').getByRole('link', { name: '查看原文', exact: true })).toHaveCount(count);
  };
  const openSummaryAndReturn = async () => {
    await expect(postSummary.getByRole('button', { name: /展开全文|收起全文/ })).toHaveCount(0);
    await expect(postSummary.getByText('正文末尾的完整段落，收起时不显示。', { exact: true })).not.toBeVisible();
    // The summary body itself is a link target, as well as its title.
    await postSummary.locator('p').filter({ hasText: '同一条目保留两种关系。' }).click();
    await expect(page).toHaveURL(new RegExp(`/forum/p/${own.bothPost.id}$`));
    const original = page.locator('article').first();
    await expect(original.locator('li strong')).toHaveText('展开后保留列表和加粗');
    await expect(original.getByText('正文末尾的完整段落，收起时不显示。', { exact: true })).toBeVisible();
    await page.goBack();
    await expectStackedComments(4);
  };
  await expect(circleCard).toHaveText('目录管理圈');
  await expect(circleCard.getByRole('button')).toHaveCount(0);
  await expect(circleCard.getByRole('img', { name: /我管理的圈子|关注的圈子/ })).toHaveCount(0);
  await expect(bothPreview.getByRole('link', { name: '查看原文', exact: true })).toHaveText('');
  await expect(bothPreview.getByRole('img', { name: '我的评论', exact: true })).toBeVisible();
  await expect(bothPreview.getByRole('img', { name: '收藏的评论', exact: true })).toBeVisible();
  await expect(bothPreview.locator('li strong')).toHaveText('评论中的完整列表');
  await expect(bothPreview.getByText('相关评论末尾的完整段落直接显示。', { exact: true })).toBeVisible();
  await expectStackedComments(4);
  for (const comment of own.extraComments) {
    await expect(postStack.locator(`#comment-${comment.id}`)).toBeVisible();
  }
  await openSummaryAndReturn();
  await row('我的并且收藏的帖子').click();
  await expect(row('我的并且收藏的帖子')).toHaveAttribute('aria-selected', 'true');
  await openSummaryAndReturn();
  await filter('关注收藏').click();
  await expectStackedComments(1);
  await expect(bothPreview).toBeVisible();
  for (const comment of own.extraComments) {
    await expect(current.locator(`#comment-${comment.id}`)).toHaveCount(0);
  }
  await filter('全部').click();
  await selectCircle('目录管理圈');
  await expectStackedComments(4);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: '/tmp/volunteer-directory-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '展开', exact: true }).click();
  await expect(tree).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/volunteer-directory-mobile.png', fullPage: true });
  await row('我的并且收藏的帖子').click();
  await expect(tree).not.toBeVisible();
  await expect(current.getByRole('heading', { name: '我的并且收藏的帖子', exact: true })).toBeVisible();
  await expectStackedComments(4);
  await openSummaryAndReturn();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1280, height: 900 });

  await filter('关注收藏').click();
  await selectCircle('帖子收藏路径圈');
  await current.getByRole('link', { name: '打开帖子：仅收藏标题的帖子', exact: true }).click();
  await page.getByRole('button', { name: '取消收藏', exact: true }).click();
  await expect(page.getByRole('button', { name: '收藏帖子', exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: '刷新目录', exact: true }).click();
  await expect(row('仅收藏标题的帖子')).toHaveCount(0);
  await expect(row('帖子收藏路径圈')).toHaveCount(0);
  await row('收藏评论的路径帖子').click();
  await current.locator(`#comment-${fixture.savedComment.id}`).getByRole('link', { name: '查看原文', exact: true }).click();
  await page.locator(`#comment-${fixture.savedComment.id}`).getByRole('button', { name: '取消收藏评论', exact: true }).click();
  await expect(page.locator(`#comment-${fixture.savedComment.id}`).getByRole('button', { name: '收藏评论', exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: '刷新目录', exact: true }).click();
  await expect(row('收藏评论的路径帖子')).toHaveCount(0);
  await expect(row('评论路径圈')).toHaveCount(0);
  await expect(tree.locator('[aria-selected="true"]')).toHaveCount(1);
  await selectCircle('目录管理圈');
  await current.getByRole('link', { name: '打开帖子：我的并且收藏的帖子', exact: true }).click();
  await page.getByRole('button', { name: '取消收藏', exact: true }).click();
  await expect(page.getByRole('button', { name: '收藏帖子', exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: '刷新目录', exact: true }).click();
  await expect(row('我的并且收藏的帖子').getByRole('img', { name: '收藏的帖子', exact: true })).toHaveCount(0);
  // Its saved comment still supplies the path, and the independent authored
  // relation survives both unfavoriting operations on the source post.
  await expect(row('我的并且收藏的帖子').getByRole('img', { name: '我发布的帖子', exact: true })).toBeVisible();
  await current.locator(`#comment-${own.bothComment.id}`).getByRole('link', { name: '查看原文', exact: true }).click();
  await page.locator(`#comment-${own.bothComment.id}`).getByRole('button', { name: '取消收藏评论', exact: true }).click();
  await expect(page.locator(`#comment-${own.bothComment.id}`).getByRole('button', { name: '收藏评论', exact: true })).toBeVisible();
  await page.goBack();
  await page.getByRole('button', { name: '刷新目录', exact: true }).click();
  await expect(row('我的并且收藏的帖子')).toHaveCount(0);
  await filter('我的参与').click();
  await expect(row('我的并且收藏的帖子')).toHaveCount(1);
  await expect(row('我评论过的路径帖子')).toBeVisible();
  await expect(row('我的并且收藏的帖子').getByRole('img', { name: '我发布的帖子', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('draft window: rich drafts survive browsing, window modes, return, failed submit and account isolation', async ({ page }) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(12_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, 'reset-admin@example.test');
  const fixture = await page.evaluate(async () => {
    const { forumService } = await import('/src/services/forumService.ts');
    const { postService } = await import('/src/services/postService.ts');
    const owner = (await forumService.candidates('圈主测试')).find(account => account.name === '圈主测试');
    if (!owner) throw new Error('Draft window test account is missing');
    const circle = await forumService.create({
      name: '草稿浮窗测试圈', slug: `draft-window-${Date.now()}`,
      description: '独立测试浮窗与浏览其他帖子的配合。', ownerIds: [owner.accountId],
    });
    const source = await postService.create(circle.slug, { title: '回复草稿的来源帖子', body: '这篇帖子接收浮窗发布的回复。' });
    const reference = await postService.create(circle.slug, { title: '写作时参考的另一篇帖子', body: '可以边看这篇文章，边继续原来的草稿。' });
    return { circle, source, reference };
  });
  await logout(page);
  await login(page, 'forum-owner@example.test');
  await page.goto(`/forum/c/${fixture.circle.slug}`);
  await page.getByRole('button', { name: '发帖', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: `在${fixture.circle.name}发帖`, exact: true });
  const inlinePost = dialog.getByRole('textbox', { name: '正文', exact: true });
  await dialog.getByLabel('标题', { exact: true }).fill('边参考边完成的浮窗帖子');
  await inlinePost.click();
  await inlinePost.evaluate(element => {
    const data = new DataTransfer();
    data.setData('text/html', '<p><strong>保留加粗的开头</strong></p><ol><li><p>第一条参考笔记</p></li><li><p>第二条参考笔记</p></li></ol><p>图片说明</p>');
    data.setData('text/plain', '保留加粗的开头\n第一条参考笔记\n第二条参考笔记\n图片说明');
    element.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }));
  });
  await expect(inlinePost.locator('ol li')).toHaveText(['第一条参考笔记', '第二条参考笔记']);
  await inlinePost.press('ControlOrMeta+End');
  await inlinePost.press('Enter');
  await pasteImage(inlinePost);
  await expect(inlinePost.locator('img')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: '发布帖子', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: '弹出草稿', exact: true }).click();

  const dock = page.getByRole('region', { name: '草稿浮窗', exact: true });
  const dockPost = dock.getByRole('textbox', { name: '正文', exact: true });
  const dockComment = dock.getByRole('textbox', { name: '评论', exact: true });
  await expect(dock).toBeVisible();
  await expect.poll(async () => dock.evaluate(element => innerWidth - element.getBoundingClientRect().right)).toBeLessThanOrEqual(20);
  await expect(dialog).toHaveCount(0);
  await expect(dock).toContainText(`发帖 · ${fixture.circle.name}`);
  await expect(page.getByRole('textbox', { name: '正文', exact: true })).toHaveCount(1);
  await expect(dockPost.locator('strong')).toContainText('保留加粗的开头');
  await expect(dockPost.locator('ol li')).toHaveText(['第一条参考笔记', '第二条参考笔记']);
  await expect(dockPost.locator('img')).toHaveCount(1);
  // Follow real app links: this navigation keeps the live editor mounted.
  await page.getByRole('link', { name: fixture.reference.title, exact: true }).getByText(fixture.reference.body, { exact: true }).click({ position: { x: 5, y: 5 } });
  await expect(page.getByRole('heading', { name: fixture.reference.title, exact: true })).toBeVisible();
  const otherReply = page.getByRole('region', { name: '参与讨论', exact: true });
  await expect(otherReply.getByRole('button', { name: '弹出草稿', exact: true })).toBeDisabled();
  await otherReply.getByRole('textbox', { name: '评论', exact: true }).fill('另一个帖子的独立草稿');
  await dockPost.press('ControlOrMeta+Home');
  await page.keyboard.insertText('参考文章后补充：');
  await expect(dockPost).toContainText('参考文章后补充：');
  await dock.getByRole('button', { name: '收起草稿', exact: true }).click();
  await expect(dockPost).not.toBeVisible();
  await dock.getByRole('button', { name: '展开草稿浮窗', exact: true }).click();
  await expect(dockPost).toBeVisible();
  const normalWidth = (await dock.boundingBox()).width;
  await dock.getByRole('button', { name: '最大化草稿', exact: true }).click();
  await expect.poll(async () => (await dock.boundingBox()).width).toBeGreaterThan(normalWidth);
  await expect(dockPost.locator('ol li')).toHaveText(['第一条参考笔记', '第二条参考笔记']);
  await expect(dockPost.locator('img')).toHaveCount(1);
  await dock.getByRole('button', { name: '还原草稿窗口', exact: true }).click();
  await page.reload();
  await expect(dock.getByLabel('标题', { exact: true })).toHaveValue('边参考边完成的浮窗帖子');
  await expect(dockPost).toContainText('参考文章后补充：');
  await expect(dockPost.locator('strong')).toContainText('保留加粗的开头');
  await expect(dockPost.locator('ol li')).toHaveText(['第一条参考笔记', '第二条参考笔记']);
  await expect(dockPost.locator('img')).toHaveCount(1);
  expect(await dockPost.locator('img').evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
  await page.screenshot({ path: '/tmp/volunteer-draft-window-desktop.png', fullPage: false });
  await dock.getByRole('button', { name: '收回原位置', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/forum/c/${fixture.circle.slug}(?:\\?|$)`));
  await expect(dialog).toBeVisible();
  await expect(dock).toHaveCount(0);
  await expect(dialog.getByLabel('标题', { exact: true })).toHaveValue('边参考边完成的浮窗帖子');
  await expect(inlinePost).toContainText('参考文章后补充：');
  await expect(inlinePost.locator('ol li')).toHaveText(['第一条参考笔记', '第二条参考笔记']);
  await expect(inlinePost.locator('img')).toHaveCount(1);
  // Publishing from a different page still targets the original circle.
  await dialog.getByRole('button', { name: '弹出草稿', exact: true }).click();
  await page.getByRole('link', { name: fixture.reference.title, exact: true }).click({ position: { x: 8, y: 8 } });
  await dock.getByRole('button', { name: '发布帖子', exact: true }).click();
  await expect(page.getByRole('heading', { name: '边参考边完成的浮窗帖子', exact: true })).toBeVisible();
  await expect(dock).toHaveCount(0);
  const createdPost = await page.evaluate(async () => {
    const { postService } = await import('/src/services/postService.ts');
    return postService.get(location.pathname.split('/').pop());
  });
  expect(createdPost.circle.id).toBe(fixture.circle.id);
  expect(createdPost.body).toContain('orderedList');
  expect(createdPost.body).toContain('forumImage');
  await page.getByRole('link', { name: fixture.circle.name, exact: true }).click();
  await page.getByRole('button', { name: '发帖', exact: true }).click();
  await expect(dialog.getByLabel('标题', { exact: true })).toHaveValue('');
  await dialog.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('link', { name: fixture.source.title, exact: true }).click();

  const sourceComment = page.getByRole('textbox', { name: '评论', exact: true });
  await sourceComment.fill('回复草稿固定发给来源帖子');
  await sourceComment.press('ControlOrMeta+a');
  await page.getByRole('button', { name: '加粗', exact: true }).click();
  await sourceComment.press('ArrowRight');
  await sourceComment.press('Enter');
  await pasteImage(sourceComment);
  await expect(sourceComment.locator('img')).toHaveCount(1);
  await expect(page.getByRole('button', { name: '发表评论', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: '弹出草稿', exact: true }).click();
  await expect(dock).toContainText(`回复 · ${fixture.source.title}`);
  await expect(page.getByRole('textbox', { name: '评论', exact: true })).toHaveCount(1);
  await page.getByRole('link', { name: fixture.circle.name, exact: true }).click();
  await page.getByRole('link', { name: fixture.reference.title, exact: true }).click({ position: { x: 8, y: 8 } });
  await expect(page.getByRole('heading', { name: fixture.reference.title, exact: true })).toBeVisible();
  await expect(otherReply.getByRole('textbox', { name: '评论', exact: true })).toHaveText('另一个帖子的独立草稿');
  await expect(otherReply.getByRole('button', { name: '弹出草稿', exact: true })).toBeDisabled();
  await dockComment.press('ControlOrMeta+Home');
  await page.keyboard.insertText('看完参考文章之后，');
  await dock.getByRole('button', { name: '收回原位置', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/forum/p/${fixture.source.id}(?:\\?|#|$)`));
  await expect(dock).toHaveCount(0);
  await expect(sourceComment).toContainText('看完参考文章之后，回复草稿固定发给来源帖子');
  await expect(sourceComment).toBeFocused();
  await expect(sourceComment.locator('strong')).toContainText('回复草稿固定发给来源帖子');
  await expect(sourceComment.locator('img')).toHaveCount(1);
  await page.getByRole('button', { name: '弹出草稿', exact: true }).click();
  await dock.getByRole('button', { name: '收起草稿', exact: true }).click();
  await page.getByRole('link', { name: fixture.circle.name, exact: true }).click();
  await page.getByRole('link', { name: fixture.reference.title, exact: true }).click({ position: { x: 8, y: 8 } });
  await page.setViewportSize({ width: 390, height: 844 });
  await dock.getByRole('button', { name: '展开草稿浮窗', exact: true }).click();
  await expect(dockComment.locator('img')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const mobileWindow = await dock.boundingBox();
  expect(mobileWindow.x).toBeGreaterThanOrEqual(0);
  expect(mobileWindow.x + mobileWindow.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '/tmp/volunteer-draft-window-mobile.png', fullPage: false });
  await dock.getByRole('button', { name: '最大化草稿', exact: true }).click();
  await expect.poll(async () => (await dock.boundingBox()).height).toBeGreaterThan(mobileWindow.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(dock.getByRole('button', { name: '发表评论', exact: true })).toBeInViewport({ ratio: 1 });
  await dock.getByRole('button', { name: '还原草稿窗口', exact: true }).click();
  const failedComment = `**/forum/posts/${fixture.source.id}/comments`;
  await page.route(failedComment, route => route.request().method() === 'POST'
    ? route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ success: false, message: '测试暂时无法发表，请稍后重试' }) })
    : route.continue());
  await dock.getByRole('button', { name: '发表评论', exact: true }).click();
  await expect(dock.getByRole('alert')).toContainText('测试暂时无法发表');
  await expect(dockComment).toContainText('看完参考文章之后，回复草稿固定发给来源帖子');
  await expect(dockComment.locator('img')).toHaveCount(1);
  await page.unroute(failedComment);
  await dock.getByRole('button', { name: '发表评论', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/forum/p/${fixture.source.id}\\?commentId=`));
  await expect(dock).toHaveCount(0);
  const published = page.locator('article[id^="comment-"]').filter({ hasText: '看完参考文章之后，回复草稿固定发给来源帖子' });
  await expect(published).toBeVisible();
  await expect(published.locator('figure img')).toHaveCount(1);
  await expect(sourceComment).toHaveText('');
  const wrongTarget = await page.evaluate(async id => {
    const { postService } = await import('/src/services/postService.ts');
    return postService.comments(id);
  }, fixture.reference.id);
  expect(wrongTarget.data).toHaveLength(0);

  await page.setViewportSize({ width: 1440, height: 1000 });
  await sourceComment.fill('只有原账号能够恢复的浮窗草稿');
  await page.getByRole('button', { name: '弹出草稿', exact: true }).click();
  await expect(dockComment).toContainText('只有原账号能够恢复的浮窗草稿');
  // Both window sizes follow a short draft's content rather than leaving a tall blank area.
  const shortWindow = await dock.boundingBox();
  expect(shortWindow.height).toBeLessThan(600);
  await dock.getByRole('button', { name: '最大化草稿', exact: true }).click();
  await expect.poll(async () => (await dock.boundingBox()).width).toBeGreaterThan(shortWindow.width);
  expect((await dock.boundingBox()).height).toBeLessThan(600);
  await page.screenshot({ path: '/tmp/volunteer-draft-window-maximized.png', fullPage: false });
  await dock.getByRole('button', { name: '还原草稿窗口', exact: true }).click();
  await logout(page);
  await expect(dock).toHaveCount(0);
  await login(page, 'forum-steward@example.test');
  await expect(dock).toHaveCount(0);
  await page.goto(`/forum/p/${fixture.source.id}`);
  await expect(page.getByRole('textbox', { name: '评论', exact: true })).toHaveText('');
  await expect(page.getByText('只有原账号能够恢复的浮窗草稿', { exact: true })).toHaveCount(0);
  await logout(page);
  await login(page, 'forum-owner@example.test');
  await page.goto(`/forum/p/${fixture.source.id}`);
  await expect(page.getByRole('textbox', { name: '评论', exact: true })).toContainText('只有原账号能够恢复的浮窗草稿');
  expect(errors).toEqual([]);
});

test('edit draft window: existing post drafts autosave, return to edit and retain version conflicts after reload', async ({ page }) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(12_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, 'reset-admin@example.test');
  const circle = await page.evaluate(async () => {
    const { forumService } = await import('/src/services/forumService.ts');
    const owner = (await forumService.candidates('圈主测试')).find(account => account.name === '圈主测试');
    if (!owner) throw new Error('Edit draft window test account is missing');
    return forumService.create({
      name: '编辑草稿浮窗圈', slug: `edit-draft-window-${Date.now()}`,
      description: '验证已发布帖子编辑过程中的本地草稿。', ownerIds: [owner.accountId],
    });
  });
  await logout(page);
  await login(page, 'forum-owner@example.test');
  const fixture = await page.evaluate(async slug => {
    const { postService } = await import('/src/services/postService.ts');
    const source = await postService.create(slug, { title: '等待修改的原帖子', body: '这是原文。\n\n- **原有加粗列表**\n- 原有第二条列表\n\n原文末尾。' });
    const reference = await postService.create(slug, { title: '编辑时参考的帖子', body: '在这里查看参考内容，同时编辑已经发布的帖子。' });
    return { source, reference };
  }, circle.slug);
  await page.goto(`/forum/p/${fixture.source.id}`);
  await page.getByRole('button', { name: '编辑帖子', exact: true }).click();
  const edit = page.getByRole('dialog', { name: '编辑帖子', exact: true });
  const inlineBody = edit.getByRole('textbox', { name: '正文', exact: true });
  await expect(inlineBody.locator('li strong')).toHaveText('原有加粗列表');
  await edit.getByLabel('标题', { exact: true }).fill('修改中自动保存的标题');
  await inlineBody.press('ControlOrMeta+Home');
  await page.keyboard.insertText('新增的编辑内容：');
  await inlineBody.press('ControlOrMeta+End');
  await inlineBody.press('Enter');
  await pasteImage(inlineBody);
  await expect(inlineBody.locator('img')).toHaveCount(1);
  await expect(edit.getByRole('button', { name: '保存修改', exact: true })).toBeEnabled();
  await expect(edit.getByRole('status')).toContainText('草稿已自动保存到当前浏览器');
  await edit.getByRole('button', { name: '取消', exact: true }).click();
  await page.getByRole('button', { name: '编辑帖子', exact: true }).click();
  await expect(edit.getByLabel('标题', { exact: true })).toHaveValue('修改中自动保存的标题');
  await expect(inlineBody).toContainText('新增的编辑内容：');
  await expect(inlineBody.locator('img')).toHaveCount(1);
  await page.reload();
  await page.getByRole('button', { name: '编辑帖子', exact: true }).click();
  await expect(edit.getByLabel('标题', { exact: true })).toHaveValue('修改中自动保存的标题');
  await expect(inlineBody.locator('li strong')).toHaveText('原有加粗列表');
  await expect(inlineBody.locator('img')).toHaveCount(1);
  await edit.getByRole('button', { name: '弹出草稿', exact: true }).click();
  const dock = page.getByRole('region', { name: '草稿浮窗', exact: true });
  const floatingBody = dock.getByRole('textbox', { name: '正文', exact: true });
  await expect(edit).toHaveCount(0);
  await expect(dock).toContainText(`编辑帖子 · ${fixture.source.title}`);
  await expect(dock.getByRole('button', { name: '保存修改', exact: true })).toBeVisible();
  await page.getByRole('link', { name: circle.name, exact: true }).click();
  await page.getByRole('link', { name: fixture.reference.title, exact: true }).click({ position: { x: 8, y: 8 } });
  await dock.getByLabel('标题', { exact: true }).fill('从浮窗完成的原帖修改');
  await floatingBody.press('ControlOrMeta+Home');
  await page.keyboard.insertText('参考后确认：');
  const beforeSave = await page.evaluate(async id => {
    const { postService } = await import('/src/services/postService.ts');
    return postService.get(id);
  }, fixture.source.id);
  expect(beforeSave.title).toBe(fixture.source.title);
  expect(beforeSave.body).toBe(fixture.source.body);
  await page.reload();
  await expect(dock.getByLabel('标题', { exact: true })).toHaveValue('从浮窗完成的原帖修改');
  await expect(floatingBody).toContainText('参考后确认：新增的编辑内容：');
  await expect(floatingBody.locator('li strong')).toHaveText('原有加粗列表');
  await expect(floatingBody.locator('img')).toHaveCount(1);
  await page.screenshot({ path: '/tmp/volunteer-edit-draft-window-desktop.png', fullPage: false });
  await dock.getByRole('button', { name: '收回原位置', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/forum/p/${fixture.source.id}(?:\\?|$)`));
  await expect(dock).toHaveCount(0);
  await expect(edit).toBeVisible();
  await expect(edit.getByLabel('标题', { exact: true })).toHaveValue('从浮窗完成的原帖修改');
  await expect(inlineBody).toContainText('参考后确认：新增的编辑内容：');
  await expect(inlineBody.locator('img')).toHaveCount(1);
  await edit.getByRole('button', { name: '弹出草稿', exact: true }).click();
  await page.getByRole('link', { name: circle.name, exact: true }).click();
  await page.getByRole('link', { name: fixture.reference.title, exact: true }).click({ position: { x: 8, y: 8 } });
  await dock.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(dock).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/forum/p/${fixture.source.id}(?:\\?|$)`));
  await expect(page.getByRole('heading', { name: '从浮窗完成的原帖修改', exact: true })).toBeVisible();
  const original = page.locator('article').first();
  await expect(original).toContainText('参考后确认：新增的编辑内容：');
  await expect(original.locator('li strong')).toHaveText('原有加粗列表');
  await expect(original.locator('figure img')).toHaveCount(1);
  const saved = await page.evaluate(async fixture => {
    const { postService } = await import('/src/services/postService.ts');
    const { forumDraftKey } = await import('/src/components/Forum/forumDraft.ts');
    return {
      reference: await postService.get(fixture.reference.id),
      draft: localStorage.getItem(forumDraftKey(fixture.source.author.accountId, `edit-post:${fixture.source.id}`)),
    };
  }, fixture);
  expect(saved.reference.title).toBe(fixture.reference.title);
  expect(saved.reference.body).toBe(fixture.reference.body);
  expect(saved.draft).toBeNull();

  const comment = await page.evaluate(async id => {
    const { postService } = await import('/src/services/postService.ts');
    return postService.addComment(id, '可编辑的评论原文');
  }, fixture.source.id);
  await page.reload();
  const editedComment = page.locator(`#comment-${comment.id}`);
  await editedComment.getByRole('button', { name: '编辑评论', exact: true }).click();
  const commentEdit = page.getByRole('dialog', { name: '编辑评论', exact: true });
  await commentEdit.getByRole('textbox', { name: '评论', exact: true }).fill('自动保存的评论编辑草稿');
  await expect(commentEdit.getByRole('status')).toContainText('草稿已自动保存到当前浏览器');
  await commentEdit.getByRole('button', { name: '取消', exact: true }).click();
  await editedComment.getByRole('button', { name: '编辑评论', exact: true }).click();
  await expect(commentEdit.getByRole('textbox', { name: '评论', exact: true })).toHaveText('自动保存的评论编辑草稿');
  await commentEdit.getByRole('button', { name: '弹出草稿', exact: true }).click();
  await expect(dock).toContainText('编辑评论 · 从浮窗完成的原帖修改');
  await expect(commentEdit).toHaveCount(0);
  await dock.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(dock).toHaveCount(0);
  await expect(editedComment).toContainText('自动保存的评论编辑草稿');
  await expect(editedComment).toHaveClass(/ring-primary/);

  // Restoring a local editing draft must keep the version it was based on.
  // A separate client changes the live post while this unsaved draft is open.
  await page.getByRole('button', { name: '编辑帖子', exact: true }).click();
  await edit.getByLabel('标题', { exact: true }).fill('冲突后仍需保留的本地修改');
  await edit.getByRole('button', { name: '弹出草稿', exact: true }).click();
  await page.evaluate(async id => {
    const { postService } = await import('/src/services/postService.ts');
    const current = await postService.get(id);
    await postService.edit(id, { title: '另一会话已经更新的标题', body: current.body, bodyFormat: current.bodyFormat, updatedAt: current.updatedAt });
  }, fixture.source.id);
  await dock.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(dock.getByRole('alert')).toContainText('内容已被修改');
  await expect(dock.getByLabel('标题', { exact: true })).toHaveValue('冲突后仍需保留的本地修改');
  await page.reload();
  await expect(dock.getByLabel('标题', { exact: true })).toHaveValue('冲突后仍需保留的本地修改');
  await dock.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(dock.getByRole('alert')).toContainText('内容已被修改');
  await dock.getByRole('button', { name: '收回原位置', exact: true }).click();
  await expect(edit.getByLabel('标题', { exact: true })).toHaveValue('冲突后仍需保留的本地修改');
  await edit.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(edit.getByRole('alert')).toContainText('内容已被修改');
  const live = await page.evaluate(async id => {
    const { postService } = await import('/src/services/postService.ts');
    return postService.get(id);
  }, fixture.source.id);
  expect(live.title).toBe('另一会话已经更新的标题');
  await expect(edit.getByLabel('标题', { exact: true })).toHaveValue('冲突后仍需保留的本地修改');
  expect(errors).toEqual([]);
});

test('annotation workspace: long-image navigation, direct multiline text and retained unapplied drafts', async ({ page }) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(12_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await login(page, 'reset-admin@example.test');
  const circle = await page.evaluate(async () => {
    const { forumService } = await import('/src/services/forumService.ts');
    const owner = (await forumService.candidates('圈主测试')).find(account => account.name === '圈主测试');
    if (!owner) throw new Error('Annotation test account is missing');
    return forumService.create({ name: '图片标注验收圈', slug: `annotation-workspace-${Date.now()}`, description: '独立验证长图和未应用的标注进度。', ownerIds: [owner.accountId] });
  });
  await logout(page);
  await login(page, 'forum-owner@example.test');
  const source = await page.evaluate(async circle => {
    const { forumImageService } = await import('/src/services/forumImageService.ts');
    const { postService } = await import('/src/services/postService.ts');
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 1920;
    const context = canvas.getContext('2d');
    context.fillStyle = '#f4eee4'; context.fillRect(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < 8; index += 1) {
      context.fillStyle = index % 2 ? '#e9d9bd' : '#f4eee4'; context.fillRect(0, index * 240, 480, 240);
      context.fillStyle = '#85643d'; context.font = '28px sans-serif'; context.fillText(`Section ${index + 1}`, 28, index * 240 + 60);
      context.fillStyle = '#ad701e'; context.fillRect(28, index * 240 + 94, 424, 4);
    }
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const image = await forumImageService.upload(circle.id, new File([blob], 'long-annotation.png', { type: 'image/png' }));
    const body = { type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: '长图标注前的说明。' }] },
      { type: 'forumImage', attrs: { imageId: image.id, alt: '长图标注样本', width: 60, align: 'left', annotations: [] } },
      { type: 'paragraph', content: [{ type: 'text', text: '只有应用标注并保存后，原帖才会改变。' }] },
    ] };
    return postService.create(circle.slug, { title: '长图标注工作区验收', body: JSON.stringify(body), bodyFormat: 'RICH_TEXT' });
  }, circle);
  await page.goto(`/forum/p/${source.id}`);
  const edit = page.getByRole('dialog', { name: '编辑帖子', exact: true });
  const editor = edit.getByRole('textbox', { name: '正文', exact: true });
  const annotation = page.getByRole('dialog', { name: '标注图片', exact: true });
  const canvas = annotation.getByRole('application', { name: '图片标注画布', exact: true });
  const picture = annotation.getByRole('img', { name: '待标注图片', exact: true });
  const openFromPost = async () => {
    await page.getByRole('button', { name: '编辑帖子', exact: true }).click();
    await expect(editor.locator('img')).toHaveCount(1);
    await editor.locator('img').click({ position: { x: 12, y: 12 } });
    await edit.getByRole('button', { name: '标注图片', exact: true }).click();
    await expect(canvas).toBeVisible();
    await expect.poll(async () => picture.evaluate(img => img.complete && img.naturalWidth === 480)).toBe(true);
  };
  // Intersect the image with each clipping ancestor: the logical image is much
  // taller than the visible canvas after zooming, so using its centre is unsafe.
  const geometry = () => picture.evaluate(img => {
    const image = img.getBoundingClientRect();
    let left = Math.max(0, image.left), right = Math.min(innerWidth, image.right);
    let top = Math.max(0, image.top), bottom = Math.min(innerHeight, image.bottom);
    for (let parent = img.parentElement; parent; parent = parent.parentElement) {
      const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
      if (/hidden|auto|scroll|clip/.test(style.overflowX)) { left = Math.max(left, box.left); right = Math.min(right, box.right); }
      if (/hidden|auto|scroll|clip/.test(style.overflowY)) { top = Math.max(top, box.top); bottom = Math.min(bottom, box.bottom); }
    }
    return { image: { x: image.x, y: image.y, width: image.width, height: image.height }, visible: { x: left, y: top, width: right - left, height: bottom - top } };
  });
  const setControl = async (name, value) => annotation.getByLabel(name, { exact: true }).evaluate((element, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true })); element.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  const drag = async (from, to) => {
    await page.mouse.move(from.x, from.y); await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 }); await page.mouse.up();
  };
  await openFromPost();
  await annotation.getByRole('button', { name: '适应窗口', exact: true }).click();
  const fit = (await geometry()).image;
  await annotation.getByRole('button', { name: '放大画布', exact: true }).click();
  await expect.poll(async () => (await geometry()).image.width).toBeGreaterThan(fit.width);
  await annotation.getByRole('button', { name: '缩小画布', exact: true }).click();
  await expect.poll(async () => (await geometry()).image.width).toBeCloseTo(fit.width, 0);
  await annotation.getByRole('button', { name: '原始大小', exact: true }).click();
  await expect.poll(async () => (await geometry()).image.width).toBeCloseTo(480, 0);
  const beforeWheel = await geometry();
  const anchor = { x: beforeWheel.visible.x + beforeWheel.visible.width / 2, y: beforeWheel.visible.y + beforeWheel.visible.height / 2 };
  const relativeAnchor = { x: (anchor.x - beforeWheel.image.x) / beforeWheel.image.width, y: (anchor.y - beforeWheel.image.y) / beforeWheel.image.height };
  await page.mouse.move(anchor.x, anchor.y); await page.mouse.wheel(0, -160);
  await expect.poll(async () => (await geometry()).image.width).toBeGreaterThan(beforeWheel.image.width);
  const afterWheel = (await geometry()).image;
  expect((anchor.x - afterWheel.x) / afterWheel.width).toBeCloseTo(relativeAnchor.x, 2);
  expect((anchor.y - afterWheel.y) / afterWheel.height).toBeCloseTo(relativeAnchor.y, 2);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, 100); await page.keyboard.up('Control');
  await expect.poll(async () => (await geometry()).image.width).toBeLessThan(afterWheel.width);
  await annotation.getByRole('button', { name: '拖动画布', exact: true }).click();
  const beforePan = await geometry();
  const panStart = { x: beforePan.visible.x + beforePan.visible.width / 2, y: beforePan.visible.y + beforePan.visible.height * 0.6 };
  await drag(panStart, { x: panStart.x, y: panStart.y - 60 });
  await expect.poll(async () => (await geometry()).image.y).toBeLessThan(beforePan.image.y - 40);

  await annotation.getByRole('button', { name: '直线', exact: true }).click();
  const beforeLine = await geometry();
  const lineStart = { x: beforeLine.visible.x + beforeLine.visible.width * 0.12, y: beforeLine.visible.y + beforeLine.visible.height * 0.64 };
  const lineEnd = { x: beforeLine.visible.x + beforeLine.visible.width * 0.65, y: beforeLine.visible.y + beforeLine.visible.height * 0.75 };
  const expectedLine = [lineStart, lineEnd].map(point => ({ x: (point.x - beforeLine.image.x) / beforeLine.image.width, y: (point.y - beforeLine.image.y) / beforeLine.image.height }));
  await drag(lineStart, lineEnd);
  await expect(canvas.locator('line')).toHaveCount(1);
  const paintedLine = await canvas.locator('line').evaluate(line => {
    const height = line.ownerSVGElement.viewBox.baseVal.height;
    return [
      { x: Number(line.getAttribute('x1')) / 1000, y: Number(line.getAttribute('y1')) / height },
      { x: Number(line.getAttribute('x2')) / 1000, y: Number(line.getAttribute('y2')) / height },
    ];
  });
  for (const index of [0, 1]) {
    expect(paintedLine[index].x).toBeCloseTo(expectedLine[index].x, 2);
    expect(paintedLine[index].y).toBeCloseTo(expectedLine[index].y, 2);
  }
  const addText = async (value, style, fx, fy) => {
    await annotation.getByRole('button', { name: '文字', exact: true }).click();
    await setControl('标注字号', '48');
    await annotation.getByLabel('文字样式', { exact: true }).selectOption(style);
    const box = (await geometry()).visible;
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    const input = annotation.getByRole('textbox', { name: '标注文字', exact: true });
    await expect(input).toBeFocused();
    await input.fill(value);
    await annotation.getByRole('button', { name: '选择与移动', exact: true }).click();
  };
  await annotation.getByRole('button', { name: '文字', exact: true }).click();
  await expect(annotation.getByLabel('文字样式', { exact: true })).toHaveValue('plain');
  await addText('图上第一行\n图上第二行', 'background', 0.18, 0.2);
  await expect(canvas.locator('text').first()).toContainText('图上第一行');
  await expect(canvas.locator('text').first().locator('tspan')).toHaveCount(2);
  await canvas.locator('text').first().locator('tspan').first().dblclick();
  await annotation.getByRole('textbox', { name: '标注文字', exact: true }).fill('双击修改第一行\n保留第二行');
  await annotation.getByRole('button', { name: '选择与移动', exact: true }).click();
  await canvas.locator('text').first().locator('tspan').first().click();
  const textBackground = canvas.locator('text').first().locator('..').locator('rect');
  const widthBefore = Number(await textBackground.getAttribute('width'));
  const textResize = canvas.locator('[data-resize]').first();
  const handle = await textResize.boundingBox();
  await drag({ x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 }, { x: handle.x + handle.width / 2 + 40, y: handle.y + handle.height / 2 });
  await expect.poll(async () => Number(await textBackground.getAttribute('width'))).toBeGreaterThan(widthBefore);
  const textWidth = Number(await textBackground.getAttribute('width')) / 1000;
  const moveBefore = await textBackground.boundingBox();
  const firstLine = await canvas.locator('text').first().locator('tspan').first().boundingBox();
  await drag({ x: firstLine.x + firstLine.width / 2, y: firstLine.y + firstLine.height / 2 }, { x: firstLine.x + firstLine.width / 2 + 20, y: firstLine.y + firstLine.height / 2 + 18 });
  await expect.poll(async () => (await textBackground.boundingBox()).x).toBeGreaterThan(moveBefore.x + 10);
  await addText('描边文字', 'outline', 0.58, 0.82);
  await expect(canvas.locator('text')).toHaveCount(2);
  await addText('普通文字', 'plain', 0.58, 0.08);
  await expect(canvas.locator('text')).toHaveCount(3);
  await expect(canvas.locator('text').nth(1)).toHaveAttribute('stroke', '#ffffff');
  await expect(canvas.locator('text').nth(2)).not.toHaveAttribute('stroke', '#ffffff');
  await page.screenshot({ path: '/tmp/forum-annotation-workspace-desktop.png', fullPage: false });

  await annotation.getByRole('button', { name: '返回编辑', exact: true }).click();
  await expect(annotation).toHaveCount(0);
  await expect(editor.locator('svg text')).toHaveCount(0);
  await edit.getByRole('button', { name: '标注图片', exact: true }).click();
  await expect(canvas.locator('text')).toHaveCount(3);
  await annotation.getByRole('button', { name: '关闭', exact: true }).click();
  await expect(editor.locator('svg text')).toHaveCount(0);
  await page.reload();
  await openFromPost();
  await expect(canvas.locator('text')).toHaveCount(3);
  await expect(canvas.locator('text').first()).toContainText('双击修改第一行');
  const beforeApply = await page.evaluate(async id => {
    const { postService } = await import('/src/services/postService.ts');
    return JSON.parse((await postService.get(id)).body).content.find(node => node.type === 'forumImage').attrs.annotations;
  }, source.id);
  expect(beforeApply).toEqual([]);
  await annotation.getByRole('button', { name: '应用标注', exact: true }).click();
  await expect(editor.locator('svg text')).toHaveCount(3);
  await edit.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(edit).toHaveCount(0);
  await page.reload();
  const persisted = await page.evaluate(async id => {
    const { postService } = await import('/src/services/postService.ts');
    return JSON.parse((await postService.get(id)).body).content.find(node => node.type === 'forumImage').attrs.annotations;
  }, source.id);
  expect(persisted).toHaveLength(4);
  expect(persisted[0].kind).toBe('line');
  for (const index of [0, 1]) {
    expect(persisted[0].points[index].x).toBeCloseTo(expectedLine[index].x, 2);
    expect(persisted[0].points[index].y).toBeCloseTo(expectedLine[index].y, 2);
  }
  expect(persisted[1]).toMatchObject({ kind: 'text', text: '双击修改第一行\n保留第二行', textStyle: 'background', size: 48 });
  expect(persisted[1].width).toBeCloseTo(textWidth, 3);
  expect(persisted[2]).toMatchObject({ kind: 'text', text: '描边文字', textStyle: 'outline' });
  expect(persisted[3]).toMatchObject({ kind: 'text', text: '普通文字', textStyle: 'plain' });

  await page.setViewportSize({ width: 390, height: 844 });
  await openFromPost();
  await annotation.getByRole('button', { name: '适应窗口', exact: true }).click();
  await annotation.getByRole('button', { name: '拖动画布', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const mobile = await geometry();
  const centre = { x: mobile.visible.x + mobile.visible.width / 2, y: mobile.visible.y + mobile.visible.height / 2 };
  const touch = await page.context().newCDPSession(page);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const fingers = radius => [
    { x: centre.x, y: centre.y - radius, id: 1 },
    { x: centre.x, y: centre.y + radius, id: 2 },
  ];
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(16) });
  for (const radius of [22, 29, 37, 46]) await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(radius) });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => (await geometry()).image.width).toBeGreaterThan(mobile.image.width * 1.5);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await touch.send('Emulation.setTouchEmulationEnabled', { enabled: false });
  await touch.detach();
  await annotation.getByRole('button', { name: '适应窗口', exact: true }).click();
  await annotation.getByRole('button', { name: '选择与移动', exact: true }).click();
  await canvas.locator('text').first().locator('tspan').first().click();
  await annotation.getByRole('button', { name: '编辑文字', exact: true }).click();
  await annotation.getByRole('textbox', { name: '标注文字', exact: true }).fill('手机继续编辑\n临时第二行');
  await page.screenshot({ path: '/tmp/forum-annotation-workspace-mobile.png', fullPage: false });
  await annotation.getByRole('button', { name: '返回编辑', exact: true }).click();
  await expect(editor.locator('svg text').first()).toContainText('双击修改第一行');
  await expect(editor.locator('svg text').first()).not.toContainText('手机继续编辑');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
