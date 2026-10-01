import type { ForumDirectoryCircle, ForumDirectoryPost, ForumDirectoryIdentity } from '@/services/types';

export type DirectoryFilter = 'all' | 'mine' | 'saved';
export type DirectorySelection = { type: 'circle' | 'post'; id: string };
export type DirectoryItem =
  | { type: 'circle'; node: ForumDirectoryCircle; circle: ForumDirectoryCircle }
  | { type: 'post'; node: ForumDirectoryPost; circle: ForumDirectoryCircle; post: ForumDirectoryPost };
export const matchesDirectoryFilter = (node: ForumDirectoryIdentity, filter: DirectoryFilter) => filter === 'all' ? node.mine || node.saved : node[filter];

// Keep ancestors only as a path. Neither filtering nor descendants confer marks.
export function filterDirectory(circles: ForumDirectoryCircle[], filter: DirectoryFilter): ForumDirectoryCircle[] {
  return circles.map(circle => ({ ...circle, posts: circle.posts.map(post => ({
    ...post, comments: post.comments.filter(comment => matchesDirectoryFilter(comment, filter)),
  })).filter(post => matchesDirectoryFilter(post, filter) || post.comments.length > 0) }))
    .filter(circle => matchesDirectoryFilter(circle, filter) || circle.posts.length > 0);
}
export function findDirectoryItem(circles: ForumDirectoryCircle[], selection: DirectorySelection | null): DirectoryItem | null {
  if (!selection) return null;
  for (const circle of circles) {
    if (selection.type === 'circle' && circle.id === selection.id) return { type: 'circle', node: circle, circle };
    const post = circle.posts.find(post => post.id === selection.id);
    if (selection.type === 'post' && post) return { type: 'post', node: post, circle, post };
  }
  return null;
}
export function firstDirectorySelection(circles: ForumDirectoryCircle[], filter: DirectoryFilter, preferred?: 'circle' | 'post' | 'comment'): DirectorySelection | null {
  for (const circle of circles) {
    if ((!preferred || preferred === 'circle') && matchesDirectoryFilter(circle, filter)) return { type: 'circle', id: circle.id };
    for (const post of circle.posts) {
      if ((!preferred || preferred === 'post') && matchesDirectoryFilter(post, filter)) return { type: 'post', id: post.id };
      if ((!preferred || preferred === 'comment') && post.comments.some(comment => matchesDirectoryFilter(comment, filter))) return { type: 'post', id: post.id };
    }
  }
  return preferred ? firstDirectorySelection(circles, filter) : null;
}
