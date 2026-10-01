import prisma from './prismaClient.js';

/** Resolve only persisted account/circle identities. Ledger role and department
 * never confer circle powers. Pass the current transaction as db on writes so
 * authorization and the subsequent change use the same transaction.
 */
export const getForumAccess = async (operator, circleId = null, db = prisma) => {
  const account = operator?.accountId
    ? await db.account.findUnique({
        where: { id: operator.accountId },
        select: { id: true, role: true, isActive: true },
      })
    : null;
  const authenticated = Boolean(account?.isActive);
  const circle = authenticated && circleId
    ? await db.circle.findUnique({
        where: { id: circleId },
        select: {
          id: true,
          status: true,
          roles: { where: { accountId: account.id }, select: { role: true } },
        },
      })
    : null;
  return buildForumAccess(account, circle);
};

// Shared by batch circle lists, avoiding an authorization query per card.
export const buildForumAccess = (account, circle = null) => {
  const authenticated = Boolean(account?.isActive);
  const isSystemAdmin = authenticated && account.role === 'admin';
  if (!authenticated) circle = null;
  const circleRole = circle?.roles[0]?.role ?? null;
  const isOwner = circleRole === 'OWNER';
  const isCircleStaff = isOwner || circleRole === 'STEWARD';
  const active = circle?.status === 'ACTIVE';
  const managesCircle = Boolean(circle) && (isSystemAdmin || isCircleStaff);

  return {
    accountId: authenticated ? account.id : null,
    isAuthenticated: authenticated,
    isSystemAdmin,
    circleId: circle?.id ?? null,
    circleStatus: circle?.status ?? null,
    circleRole,
    canCreateCircle: isSystemAdmin,
    canRead: active,
    canParticipate: active,
    canViewManagement: managesCircle,
    canModerate: active && managesCircle,
    canManageAssets: active && managesCircle,
    canEditCircle: active && (isSystemAdmin || isOwner),
    canManageStewards: Boolean(circle) && (isSystemAdmin || (active && isOwner)),
    canTransferOwnership: Boolean(circle) && (isSystemAdmin || (active && isOwner)),
    canManageOwners: Boolean(circle) && isSystemAdmin,
    canChangeSlug: active && isSystemAdmin,
    canArchiveCircle: active && isSystemAdmin,
    canRestoreCircle: circle?.status === 'ARCHIVED' && isSystemAdmin,
  };
};

/** content must be a persisted Post or PostComment with its parent Post
 * selected (circleId, status). Never pass a request body as this argument.
 * Public read and privileged management read are deliberately separate.
 */
export const getContentPermissions = (access, content) => {
  const sameCircle = Boolean(access.accountId && access.circleId && content?.id)
    && (content.post?.circleId ?? content.circleId) === access.circleId;
  const parentActive = content?.post ? content.post.status === 'ACTIVE' : true;
  const active = sameCircle && parentActive && content.status === 'ACTIVE';
  const canManageRead = sameCircle && access.canViewManagement;
  const isAuthor = sameCircle && content.authorId === access.accountId;
  return {
    canRead: active && access.canRead,
    canManageRead,
    canInteract: active && access.canParticipate,
    canEdit: active && access.canParticipate && (isAuthor || access.isSystemAdmin),
    canDelete: active && access.canParticipate && (isAuthor || access.canModerate),
    canRestore: sameCircle && parentActive && content.status === 'DELETED' && access.canModerate,
    canPin: active && access.canParticipate && (content.post ? content.post.authorId === access.accountId : access.canModerate),
    canFeature: active && !content.post && access.canModerate,
  };
};
