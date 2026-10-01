import prisma from '../utils/prismaClient.js';
import IDGenerator from '../utils/IDGenerator.js';

// Stable ID means renaming the starter circle never recreates it on restart.
// No volunteer/admin surrogate is needed; admin can assign owners in the UI.
export const createNewcomerCircleIfMissing = async () => {
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.circle.findFirst({ where: { OR: [{ id: 'forum-newcomers' }, { slug: 'newcomers' }] } });
      if (existing) return existing;
      const circle = await tx.circle.create({ data: {
        id: 'forum-newcomers', slug: 'newcomers', name: '新人圈',
        description: '欢迎来到这里。认识同伴，分享近况，一起开启志愿服务。',
      } });
      await tx.auditLog.create({ data: {
        auditId: IDGenerator.generateAuditId(), targetType: 'Circle', targetId: circle.id,
        action: 'circle_create', actionDetails: { source: 'bootstrap' },
        operator: { id: null, name: '系统初始化' }, submitter: { id: null, name: '系统初始化' },
      } });
      return circle;
    });
  } catch (error) {
    if (error.code === 'P2002') return prisma.circle.findFirst({ where: { OR: [{ id: 'forum-newcomers' }, { slug: 'newcomers' }] } });
    throw error;
  }
};
