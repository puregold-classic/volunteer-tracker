import { describe, expect, it } from 'vitest';
import {
  filterDirectory,
  findDirectoryItem,
  firstDirectorySelection,
  type DirectoryFilter,
} from '@/components/Forum/forumDirectory';
import type {
  ForumDirectoryCircle,
  ForumDirectoryComment,
  ForumDirectoryPost,
} from '@/services/types';

const filters: DirectoryFilter[] = ['all', 'mine', 'saved'];
const identity = {
  mine: false,
  saved: false,
  status: 'ACTIVE' as const,
  unavailableReason: null,
  createdAt: '2026-09-30T12:00:00.000Z',
};

function comment(overrides: Partial<ForumDirectoryComment> = {}): ForumDirectoryComment {
  return {
    ...identity,
    id: 'comment-1',
    label: '这是一条没有标题的评论',
    circleId: 'circle-1',
    postId: 'post-1',
    excerpt: '这是一条没有标题的评论',
    body: '这是一条没有标题的评论',
    bodyFormat: 'MARKDOWN',
    author: null,
    isPinned: false,
    ...overrides,
  };
}

function post(overrides: Partial<ForumDirectoryPost> = {}): ForumDirectoryPost {
  return {
    ...identity,
    id: 'post-1',
    label: '新人须知',
    circleId: 'circle-1',
    title: '新人须知',
    excerpt: '帖子正文',
    author: null,
    commentCount: 0,
    comments: [],
    ...overrides,
  };
}

function circle(overrides: Partial<ForumDirectoryCircle> = {}): ForumDirectoryCircle {
  return {
    ...identity,
    id: 'circle-1',
    label: '新人圈',
    name: '新人圈',
    slug: 'newcomers',
    description: '圈子说明',
    coverId: null,
    circleRole: null,
    canManage: false,
    managementSlug: null,
    posts: [],
    ...overrides,
  };
}

function freezeDirectory(circles: ForumDirectoryCircle[]) {
  for (const item of circles) {
    for (const child of item.posts) {
      child.comments.forEach(Object.freeze);
      Object.freeze(child.comments);
      Object.freeze(child);
    }
    Object.freeze(item.posts);
    Object.freeze(item);
  }
  return Object.freeze(circles);
}

describe('forum directory filtering', () => {
  it.each(['mine', 'saved'] as const)('retains unmarked ancestors of a %s comment without assigning their child’s identity', (filter) => {
    const source = [circle({ posts: [post({ comments: [
      comment({ [filter]: true }),
      comment({ id: 'unrelated-comment' }),
    ] })] })];

    const result = filterDirectory(source, filter);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'circle-1', label: '新人圈', mine: false, saved: false });
    expect(result[0].posts).toHaveLength(1);
    expect(result[0].posts[0]).toMatchObject({ id: 'post-1', title: '新人须知', mine: false, saved: false });
    expect(result[0].posts[0].comments.map(item => item.id)).toEqual(['comment-1']);
  });

  it.each(['mine', 'saved'] as const)('keeps a directly associated %s circle without including unrelated posts or comments', (filter) => {
    const otherFilter = filter === 'mine' ? 'saved' : 'mine';
    const source = [circle({
      [filter]: true,
      circleRole: filter === 'mine' ? 'OWNER' : null,
      canManage: filter === 'mine',
      posts: [
        post({ id: 'unmarked-post', comments: [comment()] }),
        post({ id: 'other-filter-post', [otherFilter]: true, comments: [comment({ [otherFilter]: true })] }),
      ],
    })];

    const result = filterDirectory(source, filter);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('circle-1');
    expect(result[0].posts).toEqual([]);
  });

  it('does not make comments saved just because their post is saved', () => {
    const source = [circle({ posts: [post({ saved: true, comments: [
      comment({ id: 'ordinary-comment' }),
      comment({ id: 'my-comment', mine: true }),
      comment({ id: 'saved-comment', saved: true }),
    ] })] })];

    const result = filterDirectory(source, 'saved');

    expect(result[0]).toMatchObject({ mine: false, saved: false });
    expect(result[0].posts[0].comments.map(item => item.id)).toEqual(['saved-comment']);
    expect(filterDirectory([circle({ posts: [post({ saved: true, comments: [comment()] })] })], 'saved')[0].posts[0].comments).toEqual([]);
  });

  it.each(filters)('shows overlapping mine and saved entries once under %s and leaves source data unchanged', (filter) => {
    const source = [circle({ mine: true, saved: true, posts: [post({ mine: true, saved: true, comments: [
      comment({ mine: true, saved: true }),
      comment({ id: 'unrelated-comment' }),
    ] })] })];
    const before = structuredClone(source);
    freezeDirectory(source);

    const result = filterDirectory(source, filter);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ mine: true, saved: true });
    expect(result[0].posts).toHaveLength(1);
    expect(result[0].posts[0]).toMatchObject({ mine: true, saved: true });
    expect(result[0].posts[0].comments).toHaveLength(1);
    expect(result[0].posts[0].comments[0]).toMatchObject({ id: 'comment-1', mine: true, saved: true });
    expect(source).toEqual(before);
    expect(source[0].posts[0].comments).toHaveLength(2);
  });

  it('includes mine and saved paths in all without retaining completely unrelated branches', () => {
    const result = filterDirectory([
      circle({ posts: [
        post({ id: 'my-post', mine: true }),
        post({ id: 'saved-post', saved: true }),
        post({ id: 'comment-path', comments: [comment({ saved: true })] }),
        post({ id: 'unrelated-post' }),
      ] }),
      circle({ id: 'unrelated-circle' }),
    ], 'all');

    expect(result.map(item => item.id)).toEqual(['circle-1']);
    expect(result[0].posts.map(item => item.id)).toEqual(['my-post', 'saved-post', 'comment-path']);
  });
});

describe('forum directory selection', () => {
  it('resolves circle and post selections with the correct containing circle', () => {
    const source = [circle({ mine: true, posts: [post({ saved: true })] })];

    expect(findDirectoryItem(source, { type: 'circle', id: 'circle-1' })).toMatchObject({
      type: 'circle', node: { id: 'circle-1' }, circle: { id: 'circle-1' },
    });
    expect(findDirectoryItem(source, { type: 'post', id: 'post-1' })).toMatchObject({
      type: 'post', node: { id: 'post-1' }, post: { id: 'post-1' }, circle: { id: 'circle-1' },
    });
    expect(findDirectoryItem(source, null)).toBeNull();
  });

  it('cannot resolve a selection removed by changing the filter', () => {
    const source = [
      circle({ mine: true, posts: [post({ mine: true })] }),
      circle({ id: 'saved-circle', saved: true }),
    ];
    const saved = filterDirectory(source, 'saved');

    expect(findDirectoryItem(saved, { type: 'circle', id: 'circle-1' })).toBeNull();
    expect(findDirectoryItem(saved, { type: 'post', id: 'post-1' })).toBeNull();
    expect(firstDirectorySelection(saved, 'saved')).toEqual({ type: 'circle', id: 'saved-circle' });
  });

  it.each(['mine', 'saved'] as const)('selects the parent post for a %s comment-only path, including the comment preference', (filter) => {
    const source = [circle({ posts: [post({ comments: [comment({ [filter]: true })] })] })];
    const filtered = filterDirectory(source, filter);

    expect(firstDirectorySelection(filtered, filter)).toEqual({ type: 'post', id: 'post-1' });
    expect(firstDirectorySelection(filtered, filter, 'comment')).toEqual({ type: 'post', id: 'post-1' });
    expect(firstDirectorySelection(filtered, filter, 'circle')).toEqual({ type: 'post', id: 'post-1' });
    expect(firstDirectorySelection(filtered, filter, 'post')).toEqual({ type: 'post', id: 'post-1' });
    expect(findDirectoryItem(filtered, { type: 'post', id: 'comment-1' })).toBeNull();
    expect(findDirectoryItem(filtered, firstDirectorySelection(filtered, filter))?.node.label).toBe('新人须知');
  });

  it('honors the preferred entry kind and falls back when no matching entry exists', () => {
    const source = [circle({ mine: true, posts: [
      post({ id: 'my-post', mine: true }),
      post({ id: 'my-comment-post', comments: [comment({ mine: true })] }),
    ] })];

    expect(firstDirectorySelection(source, 'mine')).toEqual({ type: 'circle', id: 'circle-1' });
    expect(firstDirectorySelection(source, 'mine', 'post')).toEqual({ type: 'post', id: 'my-post' });
    expect(firstDirectorySelection(source, 'mine', 'comment')).toEqual({ type: 'post', id: 'my-comment-post' });
    expect(firstDirectorySelection([circle({ mine: true })], 'mine', 'comment')).toEqual({ type: 'circle', id: 'circle-1' });
  });

  it.each(filters)('returns no selection or directory entries for empty %s data', (filter) => {
    expect(filterDirectory([], filter)).toEqual([]);
    expect(findDirectoryItem([], { type: 'circle', id: 'missing' })).toBeNull();
    expect(findDirectoryItem([], { type: 'post', id: 'missing' })).toBeNull();
    expect(firstDirectorySelection([], filter)).toBeNull();
    expect(firstDirectorySelection([], filter, 'comment')).toBeNull();
  });
});
