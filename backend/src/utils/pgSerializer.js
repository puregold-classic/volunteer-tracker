// src/utils/pgSerializer.js
// Phase 5: Converts Prisma model results back to the "Chinese-string" format
// that the frontend and existing API consumers expect.
//
// Prisma stores enum values using the DB @map() values (中文) but returns the
// enum *member* names (ACTIVE, MAINLAND, etc.) at the JavaScript layer.
// These maps translate member names → display strings for API responses,
// and provide reverse maps for building Prisma WHERE clauses from Chinese inputs.

// ─── Display maps (Prisma enum member → Chinese display string) ───────────────

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

export const SERVICE_TYPE_DISPLAY = {
  TRANSLATION: '翻译',
  PROOFREADING: '校对',
  MANAGEMENT: '管理',
  TECHNICAL: '技术',
};

// ─── Reverse maps (Chinese input → Prisma enum member) ────────────────────────

export const VOLUNTEER_STATUS_TO_PG = Object.fromEntries(
  Object.entries(VOLUNTEER_STATUS_DISPLAY).map(([k, v]) => [v, k])
);

export const REGION_TO_PG = Object.fromEntries(
  Object.entries(REGION_DISPLAY).map(([k, v]) => [v, k])
);

export const ACTIVITY_LEVEL_TO_PG = Object.fromEntries(
  Object.entries(ACTIVITY_LEVEL_DISPLAY).map(([k, v]) => [v, k])
);

export const SERVICE_TYPE_TO_PG = Object.fromEntries(
  Object.entries(SERVICE_TYPE_DISPLAY).map(([k, v]) => [v, k])
);

// ─── Serializers ──────────────────────────────────────────────────────────────

/**
 * Serialize a Prisma Account row to API format.
 * Exposes `id` (PG cuid) as the account identifier.
 */
export function serializeAccount(a) {
  if (!a) return null;
  return {
    id: a.id,
    email: a.email,
    name: a.name,
    role: a.role,
    volunteerId: a.volunteerId,
    isActive: a.isActive,
    lastLoginAt: a.lastLoginAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

/**
 * Serialize a Prisma Volunteer row to API format.
 * - `id` is the domain volunteerId (e.g. "PG-0001") for backward compat
 * - Enum fields are translated back to Chinese strings
 */
export function serializeVolunteer(v) {
  if (!v) return null;
  return {
    // Expose volunteerId as 'id' to match the old Mongoose document shape
    id: v.volunteerId,
    volunteerId: v.volunteerId,
    chineseName: v.chineseName,
    englishName: v.englishName,
    avatar: v.avatar,
    status: VOLUNTEER_STATUS_DISPLAY[v.status] ?? v.status,
    region: REGION_DISPLAY[v.region] ?? v.region,
    province: v.province,
    subRegion: v.subRegion,
    services: (v.services || []).map(s => SERVICE_TYPE_DISPLAY[s] ?? s),
    nonProjectHours: v.nonProjectHours,
    nonProjectCount: v.nonProjectCount,
    activityLevel: ACTIVITY_LEVEL_DISPLAY[v.activityLevel] ?? v.activityLevel,
    email: v.email,
    phone: v.phone,
    role: v.role,
    joinDate: v.joinDate,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
  };
}

/**
 * Serialize a Prisma ServiceApplication row to API format.
 * No enum translation needed — status values are already lowercase English.
 */
export function serializeApplication(app) {
  if (!app) return null;
  // changes and submittedBy are JSONB — already parsed by Prisma
  return { ...app };
}

/**
 * Serialize a Prisma NonProjectService row to API format.
 * serviceType enum is translated back to Chinese.
 */
export function serializeNonProjectService(svc) {
  if (!svc) return null;
  return {
    ...svc,
    serviceType: SERVICE_TYPE_DISPLAY[svc.serviceType] ?? svc.serviceType,
    auditHistory: svc.auditHistory ?? [],
  };
}

/**
 * Serialize a Prisma AuditLog row to API format.
 * actionDetails, operator, submitter, changes are JSONB — already parsed.
 */
export function serializeAuditLog(log) {
  if (!log) return null;
  return { ...log };
}
