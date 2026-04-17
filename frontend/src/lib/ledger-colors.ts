// frontend/src/lib/ledger-colors.ts — v3 wave 3
//
// Single source of truth for category + department colors used in the
// support ledger, submit dialog, and record-card badges. Keeping these
// centralized means 换部门色 / 换板块色 时只改一个文件。
//
// Design:
// - 4 category base colors (ring the "三大板块 + 受训" concept)
// - 12 department colors, grouped by hue family to match a dept's dominant
//   category. Departments that span categories (TECH, CARE) get their own
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

// 12 departments. Hue families:
// - indigo shades  → 项目管理 family (BY_PROJECT / KY_PROJECT / XZT)
// - emerald shades → 项目培训 family (BY_TRAINING / KY_TRAINING / READING_CLUB)
// - amber/orange   → 项目支持 family (DOCS / PROMO / MGMT / VIDEO)
// - sky / rose     → mixed-category depts (TECH / CARE, span training+support)
export const DEPT_COLOR: Record<string, string> = {
  BY_PROJECT: '#6366f1',    // indigo-500
  KY_PROJECT: '#4f46e5',    // indigo-600
  XZT: '#818cf8',           // indigo-400
  BY_TRAINING: '#10b981',   // emerald-500
  KY_TRAINING: '#059669',   // emerald-600
  READING_CLUB: '#34d399',  // emerald-400
  DOCS: '#f59e0b',          // amber-500
  PROMO: '#d97706',         // amber-600
  MGMT: '#fbbf24',          // amber-400
  VIDEO: '#f97316',         // orange-500
  TECH: '#0ea5e9',          // sky-500
  CARE: '#f43f5e',          // rose-500
};

/** Fallback to slate for unknown dept ids — shouldn't happen but safer than undefined. */
export const deptColor = (deptId: string | null | undefined): string =>
  (deptId && DEPT_COLOR[deptId]) || '#94a3b8';

/** Fallback to slate for unknown category — treat like attendance. */
export const categoryColor = (cat: ServiceCategory | null | undefined): string =>
  (cat && CATEGORY_COLOR[cat]) || '#64748b';
