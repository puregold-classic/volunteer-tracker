import prisma from '../utils/prismaClient.js';
import ValidationUtils from '../utils/validationUtils.js';
import { IDGenerator } from '../utils/idUtils.js';
import QueryUtils from '../utils/queryUtils.js';
import { serializeApplication } from '../utils/serializer.js';

const normalizeChangeValue = (field, value) => {
  if (value === null || value === undefined) return value;
  if (field === 'serviceDate') return new Date(value).toISOString().split('T')[0];
  if (typeof value === 'string') return value.trim();
  return value;
};

const normalizeChanges = (changes = []) =>
  [...changes]
    .map(c => ({ field: c.field, from: normalizeChangeValue(c.field, c.from), to: normalizeChangeValue(c.field, c.to) }))
    .sort((a, b) => a.field.localeCompare(b.field));

const buildCreateProjectSignature = (changes = []) => {
  const normalized = normalizeChanges(changes);
  const fields = ['serviceDate', 'serviceType', 'duration', 'description'];
  const map = new Map(normalized.map(item => [item.field, item.to]));
  if (!fields.every(f => map.has(f))) return null;
  return JSON.stringify({
    serviceDate: map.get('serviceDate'),
    serviceType: map.get('serviceType'),
    duration: map.get('duration'),
    description: map.get('description'),
  });
};

export const findPendingConflict = async (applicationData, validatedChanges) => {
  if (applicationData.targetId) {
    return prisma.serviceApplication.findFirst({
      where: { status: 'pending', targetId: applicationData.targetId },
      select: { applicationId: true, applicationType: true, status: true, targetId: true, createdAt: true },
    });
  }

  const incomingSignature = buildCreateProjectSignature(validatedChanges);
  if (!incomingSignature) return null;

  const candidates = await prisma.serviceApplication.findMany({
    where: { status: 'pending', volunteerId: applicationData.volunteerId, applicationType: 'create', targetId: null },
    select: { applicationId: true, applicationType: true, status: true, targetId: true, createdAt: true, changes: true },
  });

  return candidates.find(c => buildCreateProjectSignature(Array.isArray(c.changes) ? c.changes : []) === incomingSignature) || null;
};

export const submitApplication = async (applicationData) => {
  const { submittedBy } = applicationData;

  const validationResult = await ValidationUtils.validateApplicationData(applicationData);
  if (!validationResult.isValid) {
    return { validationError: validationResult.error };
  }

  const conflict = await findPendingConflict(applicationData, validationResult.validatedChanges);
  if (conflict) {
    return { conflictError: `该项目已在审核队列中（${conflict.applicationId} / ${conflict.applicationType}），请等待处理后再提交`, conflict };
  }

  const applicationId = await IDGenerator.generateApplicationId(submittedBy.id);

  const saved = await prisma.serviceApplication.create({
    data: {
      applicationId,
      applicationType: applicationData.applicationType,
      targetType: 'NonProjectService',
      volunteerId: applicationData.volunteerId,
      volunteerName: applicationData.volunteerName,
      changes: validationResult.validatedChanges,
      targetId: applicationData.targetId || null,
      submittedBy: { id: submittedBy.id, name: submittedBy.name, role: submittedBy.role, timestamp: new Date().toISOString() },
      status: 'pending',
      reviewNotes: '',
      expiresAt: null,
    },
  });

  return { application: saved };
};

export const validateApplication = async (applicationData) => {
  return ValidationUtils.validateApplicationData(applicationData);
};

export const getMyApplications = async ({ volunteerId, submittedById, page = 1, limit = 20, status, includeInactive }) => {
  const queryVolunteerId = (typeof volunteerId === 'string' && volunteerId.trim())
    ? volunteerId.trim()
    : (typeof submittedById === 'string' ? submittedById.trim() : '');

  if (!queryVolunteerId) return { missingId: true };

  const pagination = QueryUtils.buildPaginationOptions(page, limit);
  const shouldIncludeInactive = String(includeInactive).toLowerCase() === 'true';

  const where = { volunteerId: queryVolunteerId };
  if (!shouldIncludeInactive) where.isActive = true;
  if (status && ['pending', 'approved', 'rejected', 'withdrawn'].includes(status)) where.status = status;

  const [applications, total] = await Promise.all([
    prisma.serviceApplication.findMany({ where, orderBy: { createdAt: 'desc' }, skip: pagination.skip, take: pagination.limit }),
    prisma.serviceApplication.count({ where }),
  ]);

  return {
    applications: applications.map(serializeApplication),
    pagination: { page: pagination.page, limit: pagination.limit, total, pages: Math.ceil(total / pagination.limit) },
  };
};

export const deactivateAllMyApplications = async ({ volunteerId, submittedById }) => {
  const queryVolunteerId = (typeof volunteerId === 'string' && volunteerId.trim())
    ? volunteerId.trim()
    : (typeof submittedById === 'string' ? submittedById.trim() : '');

  if (!queryVolunteerId) return { missingId: true };

  const result = await prisma.serviceApplication.updateMany({
    where: { volunteerId: queryVolunteerId, isActive: true },
    data: { isActive: false },
  });

  return { deactivatedCount: result.count ?? 0 };
};

export const withdrawApplication = async ({ applicationId, withdrawnBy }) => {
  if (!withdrawnBy?.id) return { missingWithdrawnBy: true };

  const application = await prisma.serviceApplication.findFirst({ where: { applicationId, status: 'pending' } });
  if (!application) return { notFound: true };

  const submittedBy = application.submittedBy;
  if (submittedBy?.id !== withdrawnBy.id && application.volunteerId !== withdrawnBy.id) {
    return { forbidden: true };
  }

  const updated = await prisma.serviceApplication.update({
    where: { applicationId },
    data: { status: 'withdrawn', updatedAt: new Date() },
  });

  return { application: updated };
};
