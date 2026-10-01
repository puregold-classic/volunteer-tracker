// Use this projection for forum authors/actors instead of returning Account or
// Volunteer wholesale (which contain credentials and private contact details).
export const FORUM_AUTHOR_SELECT = {
  id: true,
  name: true,
  role: true,
  volunteer: { select: { id: true, chineseName: true, avatar: true } },
};

export const serializeForumAuthor = (account) => {
  if (!account) {
    return { accountId: null, name: '已注销', avatar: null, volunteerId: null, isDeleted: true, isSystemAdmin: false };
  }
  const isSystemAdmin = account.role === 'admin';
  return {
    accountId: account.id,
    name: isSystemAdmin ? account.name : (account.volunteer?.chineseName || account.name),
    avatar: isSystemAdmin ? null : (account.volunteer?.avatar || null),
    volunteerId: isSystemAdmin ? null : (account.volunteer?.id || null),
    isDeleted: false,
    isSystemAdmin,
  };
};
