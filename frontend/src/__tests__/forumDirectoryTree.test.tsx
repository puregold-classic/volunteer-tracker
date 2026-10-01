import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ForumDirectoryTree } from '@/components/Forum/ForumDirectoryTree';
import type { DirectorySelection } from '@/components/Forum/forumDirectory';
import type { ForumDirectoryCircle } from '@/services/types';

const identity = { status: 'ACTIVE' as const, unavailableReason: null, createdAt: '2026-09-30T10:00:00.000Z' };
const circles: ForumDirectoryCircle[] = [
  {
    ...identity, id: 'newcomers', label: '新人圈', mine: false, saved: false,
    name: '新人圈', slug: 'newcomers', description: '圈子介绍不属于目录标题', coverId: null,
    circleRole: null, canManage: false, managementSlug: null,
    posts: [
      {
        ...identity, id: 'guide', label: '新人须知', title: '新人须知', circleId: 'newcomers',
        mine: false, saved: false, excerpt: '帖子正文只在右侧阅读', author: null, commentCount: 1,
        comments: [{
          ...identity, id: 'comment-one', label: '这条评论不应出现在左侧目录', mine: true, saved: true,
          postId: 'guide', circleId: 'newcomers', excerpt: '评论正文同样不应出现在目录',
          body: '评论正文同样不应出现在目录', bodyFormat: 'MARKDOWN', author: null, isPinned: true,
        }],
      },
      {
        ...identity, id: 'usage', label: '网站用法', title: '网站用法', circleId: 'newcomers',
        mine: true, saved: true, excerpt: null, author: null, commentCount: 0, comments: [],
      },
    ],
  },
  {
    ...identity, id: 'volunteer', label: '志愿交流圈', mine: true, saved: true,
    name: '志愿交流圈', slug: 'volunteer', description: null, coverId: null,
    circleRole: 'OWNER', canManage: true, managementSlug: null, posts: [],
  },
];

const item = (name: string) => screen.getByRole('treeitem', { name });
const press = (key: string) => fireEvent.keyDown(document.activeElement!, { key });
afterEach(cleanup);

describe('personal forum directory tree', () => {
  it('renders only circle and post titles, leaving comments and content out of the tree', () => {
    render(<ForumDirectoryTree circles={circles} selected={null} onSelect={vi.fn()} />);
    expect(screen.getByRole('tree', { name: '我的论坛目录' })).toBeVisible();
    expect(screen.getAllByRole('treeitem').map(node => node.getAttribute('aria-label')))
      .toEqual(['新人圈', '新人须知', '网站用法', '志愿交流圈']);
    expect(item('新人圈')).toHaveAttribute('aria-level', '1');
    expect(item('新人须知')).toHaveAttribute('aria-level', '2');
    expect(item('志愿交流圈')).not.toHaveAttribute('aria-expanded');
    expect(screen.queryByText('这条评论不应出现在左侧目录')).not.toBeInTheDocument();
    expect(screen.queryByText('评论正文同样不应出现在目录')).not.toBeInTheDocument();
    expect(screen.queryByText('帖子正文只在右侧阅读')).not.toBeInTheDocument();
    expect(screen.queryByText('圈子介绍不属于目录标题')).not.toBeInTheDocument();
  });

  it('shows both direct marks while keeping comment and post ancestors unmarked', () => {
    render(<ForumDirectoryTree circles={circles} selected={null} onSelect={vi.fn()} />);
    // Inspect only the circle row: its treeitem also contains descendant posts.
    expect(within(item('新人圈').firstElementChild as HTMLElement).queryAllByRole('img')).toHaveLength(0);
    expect(within(item('新人须知')).queryAllByRole('img')).toHaveLength(0);
    expect(within(item('网站用法')).getByRole('img', { name: '我发布的帖子' })).toBeVisible();
    expect(within(item('网站用法')).getByRole('img', { name: '收藏的帖子' })).toBeVisible();
    const managedRow = within(item('志愿交流圈').firstElementChild as HTMLElement);
    expect(managedRow.getByRole('img', { name: '我管理的圈子' })).toBeVisible();
    expect(managedRow.getByRole('img', { name: '关注的圈子' })).toBeVisible();
  });

  it('selects the clicked circle or post once and highlights the controlled selection', () => {
    const onSelect = vi.fn();
    const view = render(<ForumDirectoryTree circles={circles} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('新人圈'));
    expect(onSelect).toHaveBeenNthCalledWith(1, { type: 'circle', id: 'newcomers' });
    fireEvent.click(screen.getByText('网站用法'));
    expect(onSelect).toHaveBeenNthCalledWith(2, { type: 'post', id: 'usage' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    view.rerender(<ForumDirectoryTree circles={circles} selected={{ type: 'post', id: 'usage' }} onSelect={onSelect} />);
    expect(item('网站用法')).toHaveAttribute('aria-selected', 'true');
    expect(item('网站用法')).toHaveAttribute('tabindex', '0');
    expect(item('新人圈')).toHaveAttribute('aria-selected', 'false');
    expect(item('新人须知')).toHaveAttribute('aria-selected', 'false');
  });

  it('collapses and expands a circle without selecting it or leaving hidden posts in the tree', () => {
    const onSelect = vi.fn();
    render(<ForumDirectoryTree circles={circles} selected={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '收起新人圈' }));
    expect(item('新人圈')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('treeitem', { name: '新人须知' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('treeitem')).toHaveLength(2);
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '展开新人圈' }));
    expect(item('新人圈')).toHaveAttribute('aria-expanded', 'true');
    expect(item('新人须知')).toBeVisible();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('supports arrow navigation, Home, End, Enter and Space using the visible hierarchy', () => {
    const onSelect = vi.fn();
    render(<ForumDirectoryTree circles={circles} selected={null} onSelect={onSelect} />);
    item('新人圈').focus();
    press('ArrowRight');
    expect(item('新人须知')).toHaveFocus();
    press('ArrowDown');
    expect(item('网站用法')).toHaveFocus();
    press('ArrowUp');
    expect(item('新人须知')).toHaveFocus();
    press('ArrowLeft');
    expect(item('新人圈')).toHaveFocus();
    press('ArrowLeft');
    expect(item('新人圈')).toHaveAttribute('aria-expanded', 'false');
    press('ArrowDown');
    expect(item('志愿交流圈')).toHaveFocus();
    press('Home');
    expect(item('新人圈')).toHaveFocus();
    press('ArrowRight');
    expect(item('新人圈')).toHaveAttribute('aria-expanded', 'true');
    expect(item('新人圈')).toHaveFocus();
    press('ArrowRight');
    expect(item('新人须知')).toHaveFocus();
    expect(onSelect).not.toHaveBeenCalled();
    press('Enter');
    expect(onSelect).toHaveBeenNthCalledWith(1, { type: 'post', id: 'guide' });
    press('End');
    expect(item('志愿交流圈')).toHaveFocus();
    press(' ');
    expect(onSelect).toHaveBeenNthCalledWith(2, { type: 'circle', id: 'volunteer' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('reopens a collapsed parent when another post in it becomes selected', () => {
    const onSelect = vi.fn();
    const selected: DirectorySelection = { type: 'post', id: 'guide' };
    const view = render(<ForumDirectoryTree circles={circles} selected={selected} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '收起新人圈' }));
    expect(item('新人圈')).toHaveAttribute('aria-expanded', 'false');
    view.rerender(<ForumDirectoryTree circles={circles} selected={{ type: 'post', id: 'usage' }} onSelect={onSelect} />);
    expect(item('新人圈')).toHaveAttribute('aria-expanded', 'true');
    expect(item('网站用法')).toHaveAttribute('aria-selected', 'true');
    expect(item('网站用法')).toBeVisible();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps a collapsed parent keyboard reachable when its selected post is hidden', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<ForumDirectoryTree circles={circles} selected={{ type: 'post', id: 'guide' }} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: '收起新人圈' }));
    expect(item('新人圈')).toHaveAttribute('tabindex', '0');
    await user.tab();
    expect(item('新人圈')).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}{Enter}');
    expect(item('新人须知')).toHaveFocus();
    expect(onSelect).toHaveBeenCalledExactlyOnceWith({ type: 'post', id: 'guide' });
  });
});
