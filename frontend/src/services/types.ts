// frontend/src/services/types.ts — v2.1
//
// Source of truth for shared API types. Mirrors the backend serializer output.
//
// Naming convention:
// - id      = cuid (Prisma PK, opaque to humans)
// - code    = human-readable identifier (PG-0001, PS-PG-0001-001, etc.)
//
// Removed in v2.1:
// - Volunteer.services (array; replaced by Department/ServiceItem)
// - Volunteer.role (truth source moved to Account.role)
// - Volunteer.nonProjectHours / nonProjectCount (now derived via aggregation)
// - All ServiceApplication / ApplicationStatus / NPS-* types (审核流删除)

export type Role = 'user' | 'b_admin' | 'a_admin' | 'admin';

export type VolunteerStatusDisplay = '在职' | '不在职';

export type RegionDisplay =
  | '中国大陆'
  | '中国台湾'
  | '东南亚'
  | '美国'
  | '欧洲'
  | '其他';

export type ActivityLevelDisplay = '高' | '中' | '低';

export type ProjectSupportStatus =
  | 'ACTIVE'
  | 'PENDING_CONFIRMATION'
  | 'REJECTED_BY_OWNER'
  | 'DELETED';

// v3 三大板块 + 受训考勤. Category drives submission UI tabbing and ledger
// grouping. TRAINING_ATTENDANCE items are blocked from individual submission
// and only reachable via the project-level batch entry endpoint (wave 2).
export type ServiceCategory =
  | 'PROJECT_MGMT'
  | 'PROJECT_TRAINING'
  | 'PROJECT_SUPPORT'
  | 'TRAINING_ATTENDANCE';

// ─── Reference data ───────────────────────────────────────────────────────────

export interface Department {
  id: string;          // human code, e.g. "BY_PROJECT"
  name: string;        // "笔译项目部"
  displayOrder: number;
  createdAt?: string;
}

export interface ServiceItem {
  id: string;          // cuid
  departmentId: string;
  departmentName?: string | null;
  name: string;
  category: ServiceCategory;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
}

export interface ServiceItemsByDepartment {
  department: Pick<Department, 'id' | 'name' | 'displayOrder'>;
  items: Pick<ServiceItem, 'id' | 'name' | 'category' | 'displayOrder'>[];
}

// ─── Identity ─────────────────────────────────────────────────────────────────

export interface VolunteerSummary {
  id: string;          // cuid
  volunteerCode: string;
  chineseName: string;
}

export interface Volunteer {
  id: string;          // cuid (Prisma PK)
  volunteerCode: string; // "PG-0001" (human, formerly volunteerId)
  chineseName: string;
  englishName: string;
  avatar: string;
  status: VolunteerStatusDisplay;
  region: RegionDisplay;
  province?: string | null;
  subRegion?: string | null;
  departmentId: string;
  department: Pick<Department, 'id' | 'name'> | null;
  activityLevel: ActivityLevelDisplay;
  email?: string | null;
  phone?: string | null;
  joinDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Account {
  id: string;
  email: string;
  name: string;
  role: Role;
  // FK to Volunteer.id (cuid). null only when role='admin'.
  volunteerId: string | null;
  // Joined human code; null for admin
  volunteerCode: string | null;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// Combined account + volunteer detail for admin account-list views
export interface AdminAccountItem extends Account {
  volunteer?: Volunteer | null;
}

// ─── Project support ──────────────────────────────────────────────────────────

export interface ProjectSupport {
  id: string;          // cuid
  supportId: string;   // "PS-PG-0003-001"
  volunteerId: string; // owner cuid
  volunteer: VolunteerSummary | null;
  submittedById: string;
  submittedBy: VolunteerSummary | null;
  serviceItemId: string;
  serviceItem: {
    id: string;
    name: string;
    departmentId: string;
    departmentName: string | null;
  } | null;
  // v3.2 tag attachments — multiple tags per PS, each carries its group info.
  // Replaces the dropped projectId FK from v3 wave 2.
  tags: SupportTagAttachment[];
  serviceDate: string;
  duration: number;
  description: string;
  status: ProjectSupportStatus;
  statusDisplay: string;
  confirmedAt: string | null;
  isProxy: boolean;
  createdAt?: string;
  updatedAt?: string;
}


// ─── Tag system (v3.2) ────────────────────────────────────────────────────────

export type TagSelectionMode = 'single' | 'multi';
export type TagOpMode = 'managed' | 'tag_only';
export type TagOpenness = 'closed' | 'open';

export interface Tag {
  id: string;
  groupId: string;
  name: string;
  createdById?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TagGroup {
  id: string;
  name: string;
  description: string | null;
  boundServiceItemIds: string[];
  selectionMode: TagSelectionMode;
  opMode: TagOpMode;
  openness: TagOpenness;
  required: boolean;
  tags: Tag[];
  createdById: string;
  createdBy: VolunteerSummary | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SupportTagAttachment {
  attachmentId: string;
  tagId: string;
  name: string;
  groupId: string;
  group: {
    id: string;
    name: string;
    selectionMode: TagSelectionMode;
    opMode: TagOpMode;
  } | null;
}

// ─── Volunteer list (v3 wave-3 "我的关注") ────────────────────────────────────

export interface VolunteerListMember {
  id: string;
  note: string | null;
  addedAt: string;
  volunteer: Volunteer;
}

export interface VolunteerList {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
  members: VolunteerListMember[];
}

// ─── System settings ──────────────────────────────────────────────────────────

export interface SystemSettings {
  id: number;
  lockedBefore: string | null;
  updatedAt?: string;
  updatedById?: string | null;
}

// ─── Generic API envelope ─────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: number;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext?: boolean;
  hasPrev?: boolean;
}

export interface PaginatedList<T> {
  records?: T[];        // ProjectSupport list shape
  data?: T[];           // Generic list shape
  pagination: PaginationInfo;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface VolunteerFilterParams {
  status?: string;
  region?: string | string[];
  province?: string | string[];
  departmentId?: string | string[];
  search?: string;
}

export type VolunteersParams = PaginationParams & VolunteerFilterParams;
