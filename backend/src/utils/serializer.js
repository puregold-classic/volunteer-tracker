// src/utils/serializer.js — v2.1
//
// Translates Prisma model results to API-facing format.
// Prisma stores enum values using DB @map() values (中文) but returns the
// member names (ACTIVE, MAINLAND, etc.) in JS. These maps translate
// member → display string and provide reverse maps for building WHERE clauses.
//
// Removed in v2.1:
// - SERVICE_TYPE_DISPLAY / SERVICE_TYPE_TO_PG (replaced by Department + ServiceItem)
// - serializeApplication (ServiceApplication model deleted)
// - serializeNonProjectService → serializeProjectSupport
// - Volunteer.services array
// - Volunteer.role (truth source moved to Account.role)
// - Volunteer.nonProjectHours / nonProjectCount (now derived via aggregation)

// ─── Display maps ─────────────────────────────────────────────────────────────

export const VOLUNTEER_STATUS_DISPLAY = {
  ACTIVE: '在职',
  INACTIVE: '不在职',
};

export const REGION_DISPLAY = {
  MAINLAND: '中国大陆',
  TAIWAN: '中国台湾',
  SOUTHEAST: '东南亚',
  USA: '美国',
  EUROPE: '欧洲',
  OTHER: '其他',
};

export const ACTIVITY_LEVEL_DISPLAY = {
  HIGH: '高',
  MEDIUM: '中',
  LOW: '低',
};

export const PROJECT_SUPPORT_STATUS_DISPLAY = {
  ACTIVE: '已生效',
  PENDING_CONFIRMATION: '待本人确认',
  REJECTED_BY_OWNER: '本人已拒绝',
  DELETED: '已删除',
};

// ─── Reverse maps ─────────────────────────────────────────────────────────────

export const VOLUNTEER_STATUS_TO_PG = Object.fromEntries(
  Object.entries(VOLUNTEER_STATUS_DISPLAY).map(([k, v]) => [v, k])
);

export const REGION_TO_PG = Object.fromEntries(
  Object.entries(REGION_DISPLAY).map(([k, v]) => [v, k])
);

export const ACTIVITY_LEVEL_TO_PG = Object.fromEntries(
  Object.entries(ACTIVITY_LEVEL_DISPLAY).map(([k, v]) => [v, k])
);

// ─── Serializers ──────────────────────────────────────────────────────────────

/**
 * Serialize a Prisma Account row.
 * Note: volunteerId here is the FK (cuid) to Volunteer.id, not the human code.
 * The human-readable code comes from the joined volunteer.volunteerCode.
 */
export function serializeAccount(a) {
  if (!a) return null;
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    volunteerId: a.volunteerId,                                // FK (cuid) or null
    volunteerCode: a.volunteer?.volunteerCode ?? null,         // human code if joined
    isActive: a.isActive,
    lastLoginAt: a.lastLoginAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

/**
 * Serialize a Prisma Volunteer row.
 * - id is the cuid (PK)
 * - volunteerCode is the human-readable identifier (e.g. "PG-0001")
 * - department info included if joined
 */
export function serializeVolunteer(v) {
  if (!v) return null;
  return {
    id: v.id,
    volunteerCode: v.volunteerCode,
    chineseName: v.chineseName,
    englishName: v.englishName,
    avatar: v.avatar,
    status: VOLUNTEER_STATUS_DISPLAY[v.status] ?? v.status,
    region: REGION_DISPLAY[v.region] ?? v.region,
    province: v.province,
    subRegion: v.subRegion,
    departmentId: v.departmentId,
    department: v.department
      ? { id: v.department.id, name: v.department.name }
      : null,
    activityLevel: ACTIVITY_LEVEL_DISPLAY[v.activityLevel] ?? v.activityLevel,
    email: v.email,
    phone: v.phone,
    joinDate: v.joinDate,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

/**
 * Strip PII (email, phone) from an already-serialized volunteer object.
 * Use when a request is anonymous or the viewer is not the volunteer themselves
 * / not an admin. Idempotent — safe to apply multiple times.
 */
export function stripVolunteerPII(v) {
  if (!v) return null;
  const { email: _e, phone: _p, ...rest } = v;
  return rest;
}

const PRIVILEGED_ROLES = new Set(['admin', 'a_admin', 'b_admin']);

/**
 * Decide whether `viewer` (req.user, may be undefined) is allowed to see
 * the full volunteer record (including email/phone) for `volunteer`.
 * - Admin/reviewer roles: always yes
 * - Regular users viewing their own volunteer profile: yes
 * - Anonymous or someone else: no
 */
export function canViewVolunteerPII(viewer, volunteer) {
  if (!viewer || !volunteer) return false;
  if (PRIVILEGED_ROLES.has(viewer.role)) return true;
  return viewer.volunteerId && viewer.volunteerId === volunteer.id;
}

/**
 * Convenience wrapper: returns `volunteer` as-is if the viewer is allowed to
 * see PII, otherwise returns a stripped copy. Works on both raw and already-
 * serialized volunteer shapes (both have `email` and `phone` at top level).
 */
export function volunteerForViewer(viewer, volunteer) {
  if (!volunteer) return null;
  return canViewVolunteerPII(viewer, volunteer) ? volunteer : stripVolunteerPII(volunteer);
}

export function serializeDepartment(d) {
  if (!d) return null;
  return {
    id: d.id,
    name: d.name,
    displayOrder: d.displayOrder,
    createdAt: d.createdAt,
  };
}

export function serializeServiceItem(s) {
  if (!s) return null;
  return {
    id: s.id,
    departmentId: s.departmentId,
    departmentName: s.department?.name ?? null,
    name: s.name,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
    createdAt: s.createdAt,
  };
}

/**
 * Serialize a Prisma ProjectSupport row.
 * Includes joined volunteer / submittedBy / serviceItem if available.
 */
export function serializeProjectSupport(p) {
  if (!p) return null;
  return {
    id: p.id,
    supportId: p.supportId,
    volunteerId: p.volunteerId,
    volunteer: p.volunteer
      ? {
          id: p.volunteer.id,
          volunteerCode: p.volunteer.volunteerCode,
          chineseName: p.volunteer.chineseName,
        }
      : null,
    submittedById: p.submittedById,
    submittedBy: p.submittedBy
      ? {
          id: p.submittedBy.id,
          volunteerCode: p.submittedBy.volunteerCode,
          chineseName: p.submittedBy.chineseName,
        }
      : null,
    serviceItemId: p.serviceItemId,
    serviceItem: p.serviceItem
      ? {
          id: p.serviceItem.id,
          name: p.serviceItem.name,
          departmentId: p.serviceItem.departmentId,
          departmentName: p.serviceItem.department?.name ?? null,
        }
      : null,
    serviceDate: p.serviceDate,
    duration: p.duration,
    description: p.description,
    status: p.status,
    statusDisplay: PROJECT_SUPPORT_STATUS_DISPLAY[p.status] ?? p.status,
    confirmedAt: p.confirmedAt,
    isProxy: p.submittedById !== p.volunteerId,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export function serializeAuditLog(log) {
  if (!log) return null;
  return { ...log };
}
