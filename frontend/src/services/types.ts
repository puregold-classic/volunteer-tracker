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
  name: string;        // "笔译项目管理"
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
  birthday?: string | null;   // ISO date; drives birthday-based volunteerCode
  bio?: string | null;        // v3.9 个人简介, <=200 chars, public
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
  // v3.8: 部长(a_admin) 的管辖部门 = 自己志愿者档案的部门；admin 为 null
  departmentId?: string | null;
  departmentName?: string | null;
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
  submittedById: string | null;
  submittedByAccountId?: string | null;
  submittedByAccount?: { id: string; name: string } | null;
  trainingSessionId?: string | null;
  submittedBy: VolunteerSummary | null;
  serviceItemId: string;
  serviceItem: {
    id: string;
    name: string;
    category: ServiceCategory;
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
  isActive?: boolean;
  id: string;
  groupId: string;
  name: string;
  createdById?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TagGroup {
  applicability?: 'all' | 'specified' | 'legacy';
  isActive?: boolean;
  invalidServiceItemIds?: string[];
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

// ─── Forum ───────────────────────────────────────────────────────────────────
export interface ForumAuthorIdentity {
  accountId: string | null;
  name: string;
  avatar: string | null;
  volunteerId: string | null;
  isSystemAdmin: boolean;
  isDeleted?: boolean;
}
export interface ForumAccount extends ForumAuthorIdentity {
  accountId: string;
  volunteerCode?: string | null;
  isActive?: boolean;
}
export interface CircleCapabilities {
  accountId: string;
  circleRole: 'OWNER' | 'STEWARD' | null;
  isSystemAdmin: boolean;
  canCreateCircle: boolean;
  canViewManagement: boolean;
  canEditCircle: boolean;
  canManageAssets: boolean;
  canManageStewards: boolean;
  canManageOwners: boolean;
  canTransferOwnership: boolean;
  canChangeSlug: boolean;
  canArchiveCircle: boolean;
  canRestoreCircle: boolean;
}
export interface ForumCircle {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  archivedAt: string | null;
  createdAt: string;
  postCount: number;
  coverId: string | null;
  isFollowing: boolean;
  needsOwner: boolean;
  roles: Array<{ role: 'OWNER' | 'STEWARD'; account: ForumAccount }>;
  capabilities: CircleCapabilities;
}

export interface ForumContentCapabilities {
  canRead: boolean; canManageRead: boolean; canInteract: boolean;
  canEdit: boolean; canDelete: boolean; canRestore: boolean;
  canPin: boolean; canFeature: boolean;
}
export type ForumBodyFormat = 'MARKDOWN' | 'RICH_TEXT';
export interface ForumContent {
  bodyFormat: ForumBodyFormat;
  id: string; author: ForumAuthorIdentity; status: 'ACTIVE' | 'DELETED';
  createdAt: string; updatedAt: string; editedAt: string | null;
  deletedAt: string | null; lastEditKind: 'AUTHOR' | 'ADMIN' | null;
  capabilities: ForumContentCapabilities;
}
export interface ForumPost extends ForumContent {
  circle: Pick<ForumCircle, 'id' | 'slug' | 'name' | 'status'>;
  title: string; body?: string; excerpt?: string; commentCount: number; lastActivityAt: string;
  likeCount: number; isLiked: boolean; isFavorited: boolean;
  isPinned: boolean; pinnedAt: string | null; isFeatured: boolean; featuredAt: string | null;
}
export interface ForumComment extends ForumContent { postId: string; circleId: string; body: string; isPinned: boolean; pinnedAt: string | null; isFavorited: boolean }
export interface ForumPageResult<T> {
  data: T[]; count: number; total: number; totalPages: number; currentPage: number;
}
export interface ForumCommentPage extends ForumPageResult<ForumComment> {
  nextCursor: string | null; locatedCommentId: string | null; hasEarlier: boolean;
}
export interface MyForumContent {
  id: string; postId: string; circle: ForumPost['circle']; createdAt: string; deletedAt: string | null;
  status: 'ACTIVE' | 'DELETED'; unavailableReason: string | null;
  title: string | null; excerpt: string | null; commentCount: number | null;
}

export type ForumSort = 'hot' | 'activity' | 'new';
export interface ForumPostListResult extends ForumPageResult<ForumPost> { sort: ForumSort; featuredOnly: boolean }
export interface MyForumCircle {
  id: string; slug: string; name: string; status: 'ACTIVE' | 'ARCHIVED'; description: string | null;
  isFollowing: boolean; circleRole: 'OWNER' | 'STEWARD' | null; canManage: boolean;
}

export interface CircleFile {
  id: string; circleId: string; name: string; size: number; createdAt: string; deletedAt: string | null;
  uploader: ForumAuthorIdentity;
}
export interface CircleFilePage { data: CircleFile[]; total: number; totalPages: number; currentPage: number }

export interface ForumDirectoryIdentity {
  id: string; label: string; mine: boolean; saved: boolean;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED'; unavailableReason: string | null; createdAt: string;
}
export interface ForumDirectoryComment extends ForumDirectoryIdentity {
  postId: string; circleId: string; excerpt: string | null; body: string | null; bodyFormat: ForumBodyFormat | null;
  author: ForumAuthorIdentity | null; isPinned: boolean;
}
export interface ForumDirectoryPost extends ForumDirectoryIdentity {
  circleId: string; title: string | null; excerpt: string | null; author: ForumAuthorIdentity | null;
  commentCount: number | null; comments: ForumDirectoryComment[];
}
export interface ForumDirectoryCircle extends ForumDirectoryIdentity {
  name: string | null; slug: string | null; description: string | null; coverId: string | null;
  circleRole: 'OWNER' | 'STEWARD' | null; canManage: boolean; managementSlug: string | null; posts: ForumDirectoryPost[];
}
export interface ForumDirectory { circles: ForumDirectoryCircle[] }
