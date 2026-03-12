/**
 * pgMapper.js — MongoDB document → PostgreSQL row mappers, Phase 3.
 *
 * Each function accepts a Mongoose document (or lean plain object) and returns
 * a data object ready for Prisma `create({ data: ... })`.
 *
 * Design principles:
 *  - Input is the live Mongoose document produced by the existing service layer.
 *    No re-fetching needed.
 *  - Indexed mirror fields (indexedStatus, indexedVolunteerId, etc.) are dropped —
 *    PG uses native indexes.
 *  - Embedded objects/arrays (changes, submittedBy, auditHistory, etc.) become JSONB.
 *  - A new UUID surrogate PK is generated for PG; Mongo's _id is never stored.
 *  - Functions return `null` on unrecoverable mapping failure so the shadow layer
 *    can skip the write gracefully.
 *
 * Mapping decisions are locked by D004 in DECISIONS.md.
 */

import { randomUUID } from 'crypto';

// ── Enum guard sets (must match prisma/schema.prisma) ────────────────────────

const VALID_ROLE         = new Set(['user', 'b_admin', 'a_admin', 'admin']);
const VALID_VOL_STATUS   = new Set(['在职', '不在职']);
const VALID_REGION       = new Set(['中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '其他']);
const VALID_ACTIVITY     = new Set(['高', '中', '低']);
const VALID_SVC_TYPE     = new Set(['翻译', '校对', '管理', '技术']);

// ── Enum translation: Mongo Chinese string → Prisma enum member name ──────────
// Prisma schema uses @map() so DB stores Chinese, but Prisma Client expects the
// English member name (ACTIVE, TRANSLATION, etc.).

const VOL_STATUS_MAP  = { '在职': 'ACTIVE', '不在职': 'INACTIVE' };
const REGION_MAP      = { '中国大陆': 'MAINLAND', '中国台湾': 'TAIWAN', '东南亚': 'SOUTHEAST', '美国': 'USA', '欧洲': 'EUROPE', '其他': 'OTHER' };
const ACTIVITY_MAP    = { '高': 'HIGH', '中': 'MEDIUM', '低': 'LOW' };
const SVC_TYPE_MAP    = { '翻译': 'TRANSLATION', '校对': 'PROOFREADING', '管理': 'MANAGEMENT', '技术': 'TECHNICAL' };
const VALID_APP_TYPE     = new Set(['create', 'update', 'delete']);
const VALID_APP_STATUS   = new Set(['pending', 'approved', 'rejected', 'withdrawn']);
const VALID_AUDIT_TARGET = new Set(['ServiceApplication', 'NonProjectService']);
const VALID_AUDIT_ACTION = new Set([
  'application_review', 'application_withdraw', 'application_reopen',
  'review_withdraw', 'system_cleanup', 'seed_import',
]);

function raw(doc) {
  return doc?.toObject ? doc.toObject({ virtuals: false }) : doc;
}

// ── Account ──────────────────────────────────────────────────────────────────

/**
 * Map a Mongoose Account doc to PG Account row.
 * @returns {Object|null}
 */
export function mapAccount(doc) {
  const d = raw(doc);
  if (!d?.email || !d?.name) return null;
  if (!VALID_ROLE.has(d.role)) return null;

  return {
    id:           randomUUID(),
    email:        d.email.toLowerCase().trim(),
    passwordHash: d.passwordHash || '',
    name:         d.name.trim(),
    role:         d.role,
    volunteerId:  d.volunteerId || null,
    isActive:     d.isActive !== false,
    lastLoginAt:  d.lastLoginAt || null,
    createdAt:    d.createdAt || new Date(),
    updatedAt:    d.updatedAt || new Date(),
  };
}

// ── Volunteer ─────────────────────────────────────────────────────────────────

/**
 * Map a Mongoose Volunteer doc to PG Volunteer row.
 * IMPORTANT: Mongo stores the domain ID in `id` (not `_id`). → PG `volunteerId`.
 * @returns {Object|null}
 */
export function mapVolunteer(doc) {
  const d = raw(doc);
  // Mongo Volunteer uses `id` for the domain ID (e.g. PG-0001)
  const volunteerId = d?.id;
  if (!volunteerId || !d?.chineseName || !d?.englishName) return null;
  if (!VALID_VOL_STATUS.has(d.status)) return null;
  if (!VALID_REGION.has(d.region)) return null;
  if (!VALID_ACTIVITY.has(d.activityLevel)) return null;
  if (!VALID_ROLE.has(d.role)) return null;

  const services = (d.services || []).filter(s => VALID_SVC_TYPE.has(s)).map(s => SVC_TYPE_MAP[s]);

  return {
    id:               randomUUID(),
    volunteerId,
    chineseName:      d.chineseName.trim(),
    englishName:      d.englishName.trim(),
    avatar:           d.avatar || 'https://ui-avatars.com/api/?name=Unknown&background=random',
    status:           VOL_STATUS_MAP[d.status],
    region:           REGION_MAP[d.region],
    province:         d.province || null,
    subRegion:        d.subRegion || null,
    services,
    nonProjectHours:  d.nonProjectHours ?? 0,
    nonProjectCount:  d.nonProjectCount ?? 0,
    activityLevel:    ACTIVITY_MAP[d.activityLevel],
    email:            d.email || null,
    phone:            d.phone || null,
    role:             d.role,
    joinDate:         d.joinDate || d.createdAt || new Date(),
    createdAt:        d.createdAt || new Date(),
    updatedAt:        d.updatedAt || new Date(),
    // indexedStatus, indexedRegion, indexedActivityLevel: DROPPED
  };
}

// ── ServiceApplication ────────────────────────────────────────────────────────

/**
 * Map a Mongoose ServiceApplication doc to PG ServiceApplication row.
 * `changes` and `submittedBy` become JSONB.
 * @returns {Object|null}
 */
export function mapServiceApplication(doc) {
  const d = raw(doc);
  if (!d?.applicationId || !d?.volunteerId) return null;
  if (!VALID_APP_TYPE.has(d.applicationType)) return null;
  if (!VALID_APP_STATUS.has(d.status)) return null;

  const sub = d.submittedBy || {};
  const submittedBy = {
    id:        sub.id   || '',
    name:      sub.name || '',
    role:      VALID_ROLE.has(sub.role) ? sub.role : 'user',
    timestamp: sub.timestamp || d.createdAt || new Date(),
  };

  return {
    id:              randomUUID(),
    applicationId:   d.applicationId,
    applicationType: d.applicationType,
    targetType:      d.targetType || 'NonProjectService',
    volunteerId:     d.volunteerId,
    volunteerName:   d.volunteerName || '',
    changes:         Array.isArray(d.changes) ? d.changes : [],   // JSONB
    targetId:        d.targetId || null,
    submittedBy,                                                    // JSONB
    status:          d.status,
    isActive:        d.isActive !== false,
    reviewNotes:     d.reviewNotes || null,
    expiresAt:       d.expiresAt || null,
    createdAt:       d.createdAt || new Date(),
    updatedAt:       d.updatedAt || new Date(),
    // indexedStatus, indexedVolunteerId, indexedDate: DROPPED
  };
}

// ── NonProjectService ─────────────────────────────────────────────────────────

/**
 * Map a Mongoose NonProjectService doc to PG NonProjectService row.
 * `auditHistory` becomes JSONB.
 * @returns {Object|null}
 */
export function mapNonProjectService(doc) {
  const d = raw(doc);
  if (!d?.serviceId || !d?.volunteerId || !d?.serviceDate) return null;
  if (!VALID_SVC_TYPE.has(d.serviceType)) return null;
  if (typeof d.duration !== 'number' || d.duration < 0.5) return null;

  return {
    id:            randomUUID(),
    serviceId:     d.serviceId,
    volunteerId:   d.volunteerId,
    volunteerName: d.volunteerName || '',
    serviceDate:   d.serviceDate,
    serviceType:   SVC_TYPE_MAP[d.serviceType],
    duration:      d.duration,
    description:   d.description || '',
    auditHistory:  Array.isArray(d.auditHistory) ? d.auditHistory : [],  // JSONB
    isActive:      d.isActive !== false,
    createdAt:     d.createdAt || new Date(),
    updatedAt:     d.updatedAt || new Date(),
    // indexedVolunteerId, indexedServiceDate, etc.: DROPPED
  };
}

// ── AuditLog ──────────────────────────────────────────────────────────────────

/**
 * Map a Mongoose AuditLog doc to PG AuditLog row.
 * `actionDetails`, `operator`, `submitter`, `changes` become JSONB.
 * Mongo stores creation time in `timestamp` field (not `createdAt`).
 * @returns {Object|null}
 */
export function mapAuditLog(doc) {
  const d = raw(doc);
  if (!d?.auditId || !d?.targetId || !d?.action) return null;
  if (!VALID_AUDIT_TARGET.has(d.targetType)) return null;
  if (!VALID_AUDIT_ACTION.has(d.action)) return null;

  const op  = d.operator  || {};
  const sub = d.submitter || {};
  const ad  = d.actionDetails || {};

  return {
    id:            randomUUID(),
    auditId:       d.auditId,
    targetType:    d.targetType,
    targetId:      d.targetId,
    action:        d.action,
    actionDetails: {                              // JSONB — actionDetails.applicationType
      applicationType: ad.applicationType || '',  //   may be 'system', allowed in JSONB
      reviewResult:    ad.reviewResult    || '',
      reviewNote:      ad.reviewNote      || '',
    },
    modifiedId:    d.modifiedId || null,
    changes:       Array.isArray(d.changes) ? d.changes : [],            // JSONB
    operator:      { id: op.id  || '', name: op.name  || '', role: op.role  || 'user' }, // JSONB
    submitter:     { id: sub.id || '', name: sub.name || '', role: sub.role || 'user' }, // JSONB
    // Mongo: timestamps: { createdAt: 'timestamp' } — the time field is `timestamp`
    timestamp:     d.timestamp || d.createdAt || new Date(),
    // indexedDate, indexedOperatorId, etc.: DROPPED
  };
}
