import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, it, expect } from 'vitest';
import { ForumAvatar } from '../components/Forum/ForumAvatar';
const author = { accountId: 'account-test', name: '张三', avatar: 'https://example.test/photo.png', volunteerId: 'volunteer-test', isSystemAdmin: false };
afterEach(cleanup);
it('shows profile photos and falls back after a failed load', () => {
  render(<ForumAvatar author={author} />);
  fireEvent.error(screen.getByRole('img', { name: '张三的头像' }));
  expect(screen.getByRole('img', { name: '张三的默认头像' })).toBeTruthy();
});
it('never displays a deleted author photo or external generated default', () => {
  const { rerender } = render(<ForumAvatar author={{ ...author, isDeleted: true }} />);
  expect(screen.getByRole('img', { name: '已注销的默认头像' }).tagName).toBe('SPAN');
  rerender(<ForumAvatar author={{ ...author, avatar: 'https://ui-avatars.com/api/?name=secret' }} />);
  expect(screen.getByRole('img', { name: '张三的默认头像' }).tagName).toBe('SPAN');
});
