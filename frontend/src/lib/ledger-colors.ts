// frontend/src/lib/ledger-colors.ts — v3 wave 3
//
// Single source of truth for category + department colors used in the
// support ledger, submit dialog, and record-card badges. Keeping these
// centralized means 换部门色 / 换板块色 时只改一个文件。
//
// Design:
// - 4 category base colors (ring the "三大板块 + 受训" concept)
// - 15 department colors, grouped by hue family to match a dept's group.
//   Departments that span categories (TECH, CARE, NET_TECH) get their own
//   distinct hue so they don't collide with either family.
//
// For category-level charts (Phase C trend stacked bar, Phase D board
// filter chips) use CATEGORY_COLOR.
// For dept-level charts (Phase D department bars, Phase E volunteer
// drill-down with same-color-per-dept) use DEPT_COLOR.
// The same palette drives the submit-form tabs and the record-card
// project tag.

import type { ServiceCategory } from '@services/types';

export const CATEGORY_COLOR: Record<ServiceCategory, string> = {
  PROJECT_MGMT: '#6366f1',        // indigo-500
  PROJECT_TRAINING: '#10b981',    // emerald-500
  PROJECT_SUPPORT: '#f59e0b',     // amber-500
  TRAINING_ATTENDANCE: '#64748b', // slate-500
};

export const CATEGORY_SOFT: Record<ServiceCategory, string> = {
  PROJECT_MGMT: '#e0e7ff',        // indigo-100
  PROJECT_TRAINING: '#d1fae5',    // emerald-100
  PROJECT_SUPPORT: '#fef3c7',     // amber-100
  TRAINING_ATTENDANCE: '#e2e8f0', // slate-200
};

export const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  PROJECT_MGMT: '项目管理',
  PROJECT_TRAINING: '项目培训',
  PROJECT_SUPPORT: '项目支持',
  TRAINING_ATTENDANCE: '受训考勤',
};

// Categories in canonical display order (for chip rows, chart legends).
export const CATEGORY_ORDER: ServiceCategory[] = [
  'PROJECT_MGMT',
  'PROJECT_TRAINING',
  'PROJECT_SUPPORT',
  'TRAINING_ATTENDANCE',
];

// 15 departments (v3.5 三大组 reorg). Hue families track each dept's group:
// - indigo shades → 翻译项目 family (KY_PROJECT / BY_PROJECT / SPECIAL_PROJECT / XZT)
// - emerald shades → 组织培训 family (KY_TRAINING / BY_TRAINING / BY_EXAM / READING_CLUB)
// - amber/orange/sky/rose → 项目支援 family (MGMT / TECH / PROMO / CARE / VIDEO / DOCS / NET_TECH)
//   (TECH / CARE / NET_TECH still carry training/support-spanning items but live in 支援组)
export const DEPT_COLOR: Record<string, string> = {
  // 翻译项目 — indigo
  KY_PROJECT: '#4f46e5',       // indigo-600
  BY_PROJECT: '#6366f1',       // indigo-500
  SPECIAL_PROJECT: '#4338ca',  // indigo-700
  XZT: '#818cf8',              // indigo-400
  // 组织培训 — emerald
  KY_TRAINING: '#059669',      // emerald-600
  BY_TRAINING: '#10b981',      // emerald-500
  BY_EXAM: '#047857',          // emerald-700
  READING_CLUB: '#34d399',     // emerald-400
  // 项目支援 — amber/orange/sky/rose
  MGMT: '#fbbf24',             // amber-400
  TECH: '#0ea5e9',             // sky-500
  PROMO: '#d97706',            // amber-600
  CARE: '#f43f5e',             // rose-500
  VIDEO: '#f97316',            // orange-500
  DOCS: '#f59e0b',             // amber-500
  NET_TECH: '#0284c7',         // sky-600
};

/** Fallback to slate for unknown dept ids — shouldn't happen but safer than undefined. */
export const deptColor = (deptId: string | null | undefined): string =>
  (deptId && DEPT_COLOR[deptId]) || '#94a3b8';

/** Fallback to slate for unknown category — treat like attendance. */
export const categoryColor = (cat: ServiceCategory | null | undefined): string =>
  (cat && CATEGORY_COLOR[cat]) || '#64748b';
