// prisma/seed.js — v3.5 (15 departments, 三大组 reorg + ServiceCategory)
//
// Idempotent reference data + a few sample accounts for the dev sandbox.
// Run: `npx prisma db seed` (configured in package.json prisma.seed)
//
// What this does:
// 1. Upsert 15 fixed Departments (by id code).
// 2. Upsert ~60 ServiceItems (name + category) scoped under each department.
// 3. Soft-disable any orphan items — items in the DB that are no longer in
//    the canonical list (e.g. v2 TECH."培训" consolidated into 技术培训).
// 4. Ensure SystemSettings singleton row exists (migration also does this).
// 5. Create a small set of sample volunteer accounts for testing
//    (only if their email isn't already taken).
//
// What this DOES NOT do:
// - Create the system admin (createInitialAdmin.js handles that on server start)
// - Create real volunteer data (admin-imported via CSV in real use)

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Reference data (organizational truth) ────────────────────────────────────

// v3.5 reorg — departments grouped into 三大组 that line up with the three main
// ServiceCategory buckets (翻译项目→PROJECT_MGMT / 组织培训→PROJECT_TRAINING /
// 项目支援→PROJECT_SUPPORT; 受训/TRAINING_ATTENDANCE is the cross-cutting 4th).
// id codes are kept stable across renames so historical FKs / records don't break;
// only the display name changes. displayOrder renumbered to make groups contiguous.
const DEPARTMENTS = [
  // ── 翻译项目（核心）— PROJECT_MGMT family ──
  { id: 'KY_PROJECT',      name: '口译项目管理',   displayOrder: 1 },
  { id: 'BY_PROJECT',      name: '笔译项目管理',   displayOrder: 2 },
  { id: 'SPECIAL_PROJECT', name: '特殊项目管理部', displayOrder: 3 },  // v3.5 新增
  { id: 'XZT',             name: 'XZT项目管理部',  displayOrder: 4 },
  // ── 组织培训 — PROJECT_TRAINING family ──
  { id: 'KY_TRAINING',     name: '口译培训',       displayOrder: 5 },
  { id: 'BY_TRAINING',     name: '笔译培训',       displayOrder: 6 },
  { id: 'BY_EXAM',         name: '笔译考核',       displayOrder: 7 },  // v3.5 新增
  { id: 'READING_CLUB',    name: '共读会',         displayOrder: 8 },
  // ── 项目支援 — PROJECT_SUPPORT family ──
  { id: 'MGMT',            name: '支援管理部',     displayOrder: 9 },  // v3.5: 管理部 → 支援管理部
  { id: 'TECH',            name: '技术部',         displayOrder: 10 },
  { id: 'PROMO',           name: '推广部',         displayOrder: 11 },
  { id: 'CARE',            name: '人文关怀部',     displayOrder: 12 },  // v3.5: 人文部 → 人文关怀部
  { id: 'VIDEO',           name: '视频部',         displayOrder: 13 },
  { id: 'DOCS',            name: '文档管理部',     displayOrder: 14 },  // v3.5: 文档部 → 文档管理部
  { id: 'NET_TECH',        name: '网络技术部',     displayOrder: 15 },
];

// ServiceItem shape: { name, category }
// Category values: PROJECT_MGMT / PROJECT_TRAINING / PROJECT_SUPPORT / TRAINING_ATTENDANCE
// TRAINING_ATTENDANCE items are only accepted by the wave-2 project-level batch
// entry endpoint — individual submission is rejected at the service layer.
const SERVICE_ITEMS = {
  BY_PROJECT: [
    { name: '服务统计', category: 'PROJECT_MGMT' },
    { name: '沟通反馈', category: 'PROJECT_MGMT' },
    { name: '管理策划', category: 'PROJECT_MGMT' },
    { name: '笔译执行', category: 'PROJECT_MGMT' },  // v3.2: 触发 笔译岗位 + 项目方 tag popup
    { name: '文稿整理', category: 'PROJECT_MGMT' },  // v3.2 新增
  ],
  KY_PROJECT: [
    { name: '服务统计', category: 'PROJECT_MGMT' },
    { name: '沟通反馈', category: 'PROJECT_MGMT' },
    { name: '管理策划', category: 'PROJECT_MGMT' },
    { name: '口译执行', category: 'PROJECT_MGMT' },  // v3.2: 触发 口译岗位 + 项目方 tag popup
  ],
  // v3.5 新增。仿照 笔译/口译 项目部，执行项命名为「特殊项目执行」。
  SPECIAL_PROJECT: [
    { name: '服务统计',     category: 'PROJECT_MGMT' },
    { name: '沟通反馈',     category: 'PROJECT_MGMT' },
    { name: '管理策划',     category: 'PROJECT_MGMT' },
    { name: '特殊项目执行', category: 'PROJECT_MGMT' },
  ],
  XZT: [
    { name: '录制',     category: 'PROJECT_MGMT' },
    { name: '笔记',     category: 'PROJECT_MGMT' },
    { name: 'PM',       category: 'PROJECT_MGMT' },
    { name: '信息传递', category: 'PROJECT_MGMT' },
    { name: '服务统计', category: 'PROJECT_MGMT' },
    { name: '沟通反馈', category: 'PROJECT_MGMT' },
  ],
  BY_TRAINING: [
    { name: '策划',       category: 'PROJECT_TRAINING' },
    { name: '对外联络',   category: 'PROJECT_TRAINING' },
    { name: '沟通与记录', category: 'PROJECT_TRAINING' },
    { name: '项目执行',   category: 'PROJECT_TRAINING' },
    { name: '服务统计',   category: 'PROJECT_TRAINING' },
    { name: '受训',       category: 'TRAINING_ATTENDANCE' },
  ],
  KY_TRAINING: [
    { name: '策划',       category: 'PROJECT_TRAINING' },
    { name: '对外联络',   category: 'PROJECT_TRAINING' },
    { name: '沟通与记录', category: 'PROJECT_TRAINING' },
    { name: '项目执行',   category: 'PROJECT_TRAINING' },
    { name: '服务统计',   category: 'PROJECT_TRAINING' },
    { name: '受训',       category: 'TRAINING_ATTENDANCE' },
  ],
  // v3.5 新增独立部门「笔译考核」。归 组织培训 组（PROJECT_TRAINING）。
  BY_EXAM: [
    { name: '考题设计', category: 'PROJECT_TRAINING' },
    { name: '组织考试', category: 'PROJECT_TRAINING' },
    { name: '改卷点评', category: 'PROJECT_TRAINING' },
  ],
  DOCS: [
    // v3.5: 国宝录入 → 国宝表格录入（rename；旧项会被 orphan sweep 软停留作审计）
    { name: '国宝表格录入', category: 'PROJECT_SUPPORT' },
    { name: '文件改名',     category: 'PROJECT_SUPPORT' },
    { name: '文件整理归档', category: 'PROJECT_SUPPORT' },
    { name: '服务统计',     category: 'PROJECT_SUPPORT' },
  ],
  PROMO: [
    { name: '统筹',     category: 'PROJECT_SUPPORT' },
    { name: '策划',     category: 'PROJECT_SUPPORT' },
    { name: '文案',     category: 'PROJECT_SUPPORT' },
    { name: '海报',     category: 'PROJECT_SUPPORT' },
    { name: '推广',     category: 'PROJECT_SUPPORT' },
    { name: '运营',     category: 'PROJECT_SUPPORT' },
    { name: '服务统计', category: 'PROJECT_SUPPORT' },
  ],
  // v2 "培训" consolidated into 技术培训 per v3 (user confirmed they're the same).
  // Any existing rows still pointing to TECH."培训" remain in the DB for audit
  // but the item itself is soft-disabled by orphan sweep below so it cannot be
  // selected for new submissions.
  TECH: [
    { name: '计时',     category: 'PROJECT_SUPPORT' },
    { name: '播放',     category: 'PROJECT_SUPPORT' },
    { name: '聚焦',     category: 'PROJECT_SUPPORT' },
    { name: '录制',     category: 'PROJECT_SUPPORT' },
    { name: '分组',     category: 'PROJECT_SUPPORT' },
    { name: '服务统计', category: 'PROJECT_SUPPORT' },
    { name: '技术培训', category: 'PROJECT_TRAINING' },
    { name: '受训',     category: 'TRAINING_ATTENDANCE' },
  ],
  CARE: [
    { name: '信息更新', category: 'PROJECT_SUPPORT' },
    { name: '人文关怀', category: 'PROJECT_SUPPORT' },
    { name: '沟通管理', category: 'PROJECT_SUPPORT' },
    { name: '片区管理', category: 'PROJECT_SUPPORT' },  // v3.5 新增（五大区域群）
    { name: '服务统计', category: 'PROJECT_SUPPORT' },
    { name: '人文培训', category: 'PROJECT_TRAINING' },
    { name: '受训',     category: 'TRAINING_ATTENDANCE' },
  ],
  MGMT: [
    { name: '组织设计', category: 'PROJECT_SUPPORT' },
    { name: '培训设计', category: 'PROJECT_SUPPORT' },
    { name: '制度建立', category: 'PROJECT_SUPPORT' },
    { name: '流程改善', category: 'PROJECT_SUPPORT' },
    { name: '服务统计', category: 'PROJECT_SUPPORT' },
  ],
  READING_CLUB: [
    { name: '策划共读', category: 'PROJECT_TRAINING' },
    { name: '组织共读', category: 'PROJECT_TRAINING' },
    { name: '受训',     category: 'TRAINING_ATTENDANCE' },
  ],
  VIDEO: [
    { name: '字幕稿',   category: 'PROJECT_SUPPORT' },
    { name: '上字幕',   category: 'PROJECT_SUPPORT' },
    { name: '录音',     category: 'PROJECT_SUPPORT' },
    { name: '视频剪辑', category: 'PROJECT_SUPPORT' },
    { name: '沟通管理', category: 'PROJECT_SUPPORT' },
    { name: '服务统计', category: 'PROJECT_SUPPORT' },
  ],
  NET_TECH: [  // v3.2 新增部门
    { name: '网站开发', category: 'PROJECT_SUPPORT' },
  ],
};

// ─── v3.2 Tag seed — initial groups + values ────────────────────────────────
//
// Each group has 3 orthogonal config axes:
//   selectionMode: single (radio) | multi (checkbox) in submit UI
//   opMode:        managed (enables batch ops) | tag_only (label-only)
//   openness:      closed (fixed by admin) | open (runtime-addable)
//
// Seed 3 closed tag_only dimensions + 1 default session group. Admin can
// create more groups at runtime via /tags UI.

const TAG_GROUPS = [
  {
    name: '项目方',
    description: '委托翻译/口译服务的客户方。选了 笔译执行 / 口译执行 item 时会弹出选择。',
    // boundServiceItems by (deptId, itemName) pairs — resolved after items seed.
    boundServiceItems: [
      { departmentId: 'BY_PROJECT', name: '笔译执行' },
      { departmentId: 'KY_PROJECT', name: '口译执行' },
    ],
    selectionMode: 'single',
    opMode: 'tag_only',
    openness: 'closed',
    required: false,
    tags: ['DCI', 'YSI', 'ACI', 'XZT', 'DSEU', 'IR', 'PG'],
  },
  {
    name: '笔译岗位',
    description: '一条笔译执行 PS 在翻译链路中承担的角色。',
    boundServiceItems: [
      { departmentId: 'BY_PROJECT', name: '笔译执行' },
    ],
    selectionMode: 'single',
    opMode: 'tag_only',
    openness: 'closed',
    required: true,
    tags: ['初翻', '一校', '二校', '终校', '终审质检'],
  },
  {
    name: '口译岗位',
    description: '一条口译执行 PS 担任的岗位。',
    boundServiceItems: [
      { departmentId: 'KY_PROJECT', name: '口译执行' },
    ],
    selectionMode: 'single',
    opMode: 'tag_only',
    openness: 'closed',
    required: true,
    tags: ['A岗', 'B岗'],
  },
  {
    // v3.5: 原「培训」组改名「受训」—— 这是受训考勤维度，跟下面的「培训项目」
    // （组织培训维度）正交。改名的迁移在 seedTagGroups 里处理（见 renameTagGroup）。
    name: '受训',
    description: '受训考勤批量录入池。每个 tag 代表一次具体受训事件（如"2026-04 新译员培训 第 3 期"），a_admin 粘贴名单批量建 PS + 自动打 tag。未来非培训的批量场景可以让 admin 另建 managed 组。',
    // 绑 TRAINING_ATTENDANCE 类所有 service item — 批量建 PS 时从这个清单里选具体哪门课
    boundCategory: 'TRAINING_ATTENDANCE',
    boundServiceItems: [],
    selectionMode: 'multi',
    opMode: 'managed',
    openness: 'open',
    required: false,
    tags: [],  // 留空由 a_admin 运行时创建
  },
  {
    // v3.5: 「组织培训」维度的标签 —— 一次笔译培训具体属于哪个培训项目。
    // 跟「受训」组无关（这是组织方视角，不是考勤）。绑在 笔译培训.项目执行 上，
    // 选该服务项时弹出。openness=open 允许日后新培训项目运行时加。
    name: '培训项目',
    description: '组织培训时具体是哪一类培训项目（初翻 / 校对 / 雪山流等）。选 笔译培训 的「项目执行」时弹出。属"组织培训"维度，与"受训考勤"无关。',
    boundServiceItems: [
      { departmentId: 'BY_TRAINING', name: '项目执行' },
    ],
    selectionMode: 'single',
    opMode: 'tag_only',
    openness: 'open',
    required: false,
    tags: ['初翻培训', '校对培训', '雪山流项目培训'],
  },
];

// ─── Sample volunteer accounts for sandbox testing ────────────────────────────
//
// These are intentionally low-stakes test fixtures. Real volunteers are created
// via /auth/admin/volunteers (CSV import or single-create) by an admin.
//
// All sample accounts use the same password for convenience. Change before
// touching anything resembling production.

// birthday 演示生日制 code：张笔译 与 王技术 同生日 (03-05) → 0305a / 0305b 展示去重；
// 陈推广 不给生日 → 落回 PG-NNNN 流水号，展示 fallback。
const SAMPLE_VOLUNTEERS = [
  {
    chineseName: '张笔译', englishName: 'Zhang Translator',
    email: 'sample-by-leader@vt.local', password: 'Sample@123',
    role: 'b_admin', region: '中国大陆', province: '北京市',
    departmentId: 'BY_PROJECT', birthday: '1990-03-05',
  },
  {
    chineseName: '李口译', englishName: 'Li Interpreter',
    email: 'sample-ky-reviewer@vt.local', password: 'Sample@123',
    role: 'a_admin', region: '中国大陆', province: '上海市',
    departmentId: 'KY_PROJECT', birthday: '1988-07-12',
  },
  {
    chineseName: '王技术', englishName: 'Wang Tech',
    email: 'sample-tech-user@vt.local', password: 'Sample@123',
    role: 'user', region: '中国大陆', province: '广东省',
    departmentId: 'TECH', birthday: '1995-03-05',
  },
  {
    chineseName: '陈推广', englishName: 'Chen Promo',
    email: 'sample-promo-user@vt.local', password: 'Sample@123',
    role: 'user', region: '中国台湾', province: '台北市',
    departmentId: 'PROMO',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REGION_TO_PG = {
  '中国大陆': 'MAINLAND',
  '中国台湾': 'TAIWAN',
  '东南亚': 'SOUTHEAST',
  '美国': 'USA',
  '欧洲': 'EUROPE',
  '其他': 'OTHER',
};

function birthdayToMMDD(birthday) {
  if (!birthday) return null;
  const d = birthday instanceof Date ? birthday : new Date(birthday);
  if (Number.isNaN(d.getTime())) return null;
  return `${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
}

// Mirrors IDGenerator.generateVolunteerCode: birthday → "MMDD" + next free
// letter, else legacy "PG-NNNN". (Seed is standalone so it can't import the app
// util cleanly; kept in sync intentionally.)
async function nextVolunteerCode(birthday = null) {
  const mmdd = birthdayToMMDD(birthday);
  if (mmdd) {
    const rows = await prisma.volunteer.findMany({
      where: { volunteerCode: { startsWith: mmdd } },
      select: { volunteerCode: true },
    });
    const re = new RegExp(`^${mmdd}([a-z])$`);
    const taken = new Set(rows.map((r) => (re.exec(r.volunteerCode) || [])[1]).filter(Boolean));
    for (let i = 0; i < 26; i += 1) {
      const letter = String.fromCharCode(97 + i);
      if (!taken.has(letter)) return `${mmdd}${letter}`;
    }
    throw new Error(`生日 ${mmdd} 当天志愿者已超过 26 人`);
  }
  const last = await prisma.volunteer.findFirst({
    where: { volunteerCode: { startsWith: 'PG-' } },
    orderBy: { volunteerCode: 'desc' },
    select: { volunteerCode: true },
  });
  const lastNum = last?.volunteerCode
    ? parseInt(last.volunteerCode.split('-')[1] || '0', 10)
    : 0;
  return `PG-${String(lastNum + 1).padStart(4, '0')}`;
}

// ─── Seeders ──────────────────────────────────────────────────────────────────

async function seedDepartments() {
  console.log('→ seeding departments…');
  // displayOrder is @unique. The v3.5 reorg renumbers existing departments, so a
  // naive sequential upsert can transiently collide (e.g. setting KY_PROJECT→1
  // while BY_PROJECT still holds 1). Park every existing department at a high,
  // collision-free displayOrder first, then upsert with the final values into a
  // now-empty 1..N space.
  const existing = await prisma.department.findMany({ select: { id: true } });
  for (let i = 0; i < existing.length; i += 1) {
    await prisma.department.update({
      where: { id: existing[i].id },
      data: { displayOrder: 1000 + i },
    });
  }
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { id: dept.id },
      update: { name: dept.name, displayOrder: dept.displayOrder },
      create: dept,
    });
  }
  console.log(`  ✓ ${DEPARTMENTS.length} departments`);
}

async function seedServiceItems() {
  console.log('→ seeding service items…');
  let upserted = 0;
  let deactivated = 0;

  for (const [departmentId, items] of Object.entries(SERVICE_ITEMS)) {
    const wantedNames = new Set(items.map((it) => it.name));

    for (let i = 0; i < items.length; i += 1) {
      const { name, category } = items[i];
      const displayOrder = i + 1;

      const existing = await prisma.serviceItem.findUnique({
        where: { departmentId_name: { departmentId, name } },
      });
      if (existing) {
        await prisma.serviceItem.update({
          where: { id: existing.id },
          data: { displayOrder, category, isActive: true },
        });
      } else {
        await prisma.serviceItem.create({
          data: { departmentId, name, category, displayOrder, isActive: true },
        });
      }
      upserted += 1;
    }

    // Soft-disable orphans — items that existed before but are no longer in
    // the canonical list. Records pointing at them remain readable for audit;
    // they're just not selectable for new submissions.
    const orphans = await prisma.serviceItem.findMany({
      where: {
        departmentId,
        isActive: true,
        NOT: { name: { in: Array.from(wantedNames) } },
      },
    });
    for (const orphan of orphans) {
      await prisma.serviceItem.update({
        where: { id: orphan.id },
        data: { isActive: false },
      });
      deactivated += 1;
      console.log(`    ⚠ soft-disabled orphan: ${departmentId}.${orphan.name}`);
    }
  }

  console.log(`  ✓ ${upserted} items upserted across ${Object.keys(SERVICE_ITEMS).length} departments`);
  if (deactivated > 0) {
    console.log(`  ⚠ ${deactivated} orphan items soft-disabled`);
  }
}

async function ensureSystemSettings() {
  console.log('→ ensuring system_settings singleton…');
  await prisma.systemSettings.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, updatedAt: new Date() },
  });
  console.log('  ✓ system_settings ready');
}

async function seedTagGroups() {
  console.log('→ seeding tag groups + tags…');
  // v3.5 one-time rename: the old '培训' batch-pool group is now '受训'. Seeds key
  // groups by name, so without this the rename would orphan the old group and
  // create a duplicate. Idempotent: only fires while '培训' exists and '受训' doesn't.
  const oldTrainingGroup = await prisma.tagGroup.findUnique({ where: { name: '培训' } });
  const newReceivedGroup = await prisma.tagGroup.findUnique({ where: { name: '受训' } });
  if (oldTrainingGroup && !newReceivedGroup) {
    await prisma.tagGroup.update({ where: { id: oldTrainingGroup.id }, data: { name: '受训' } });
    console.log('  ✓ renamed tag group 培训 → 受训');
  }

  // Tag groups require an owner volunteer. We pick the first a_admin sample
  // (sample-ky-reviewer → 李口译) if present, else any volunteer, else skip.
  const adminVol = await prisma.volunteer.findFirst({
    where: {
      account: { role: { in: ['a_admin', 'admin', 'b_admin'] } },
    },
    select: { id: true, chineseName: true, volunteerCode: true },
    orderBy: { createdAt: 'asc' },
  });
  const ownerVol = adminVol ?? await prisma.volunteer.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true, chineseName: true, volunteerCode: true },
  });
  if (!ownerVol) {
    console.log('  ⚠ no volunteer in DB — skipping tag group seed');
    return;
  }

  let groupsCreated = 0;
  let groupsUpdated = 0;
  let tagsCreated = 0;

  for (const g of TAG_GROUPS) {
    // Resolve boundServiceItems → serviceItemId list.
    // Two mechanisms (additive): explicit (departmentId, name) pairs, and/or
    // boundCategory (all ServiceItems with that ServiceCategory).
    const itemIds = new Set();
    for (const pair of g.boundServiceItems) {
      const si = await prisma.serviceItem.findUnique({
        where: { departmentId_name: { departmentId: pair.departmentId, name: pair.name } },
        select: { id: true },
      });
      if (si) itemIds.add(si.id);
    }
    if (g.boundCategory) {
      const catItems = await prisma.serviceItem.findMany({
        where: { category: g.boundCategory },
        select: { id: true },
      });
      for (const si of catItems) itemIds.add(si.id);
    }
    const boundServiceItemIds = Array.from(itemIds);

    const existing = await prisma.tagGroup.findUnique({ where: { name: g.name } });
    const groupData = {
      description: g.description,
      boundServiceItemIds,
      selectionMode: g.selectionMode,
      opMode: g.opMode,
      openness: g.openness,
      required: g.required,
    };

    let group;
    if (existing) {
      // Don't overwrite non-structural fields admin may have edited. Update
      // only the configuration axes and boundServiceItemIds to keep them in
      // sync with new service items.
      group = await prisma.tagGroup.update({
        where: { id: existing.id },
        data: groupData,
      });
      groupsUpdated += 1;
    } else {
      group = await prisma.tagGroup.create({
        data: {
          name: g.name,
          ...groupData,
          createdById: ownerVol.id,
        },
      });
      groupsCreated += 1;
    }

    // Upsert tags within the group
    for (const tagName of g.tags) {
      const existingTag = await prisma.tag.findUnique({
        where: { groupId_name: { groupId: group.id, name: tagName } },
      });
      if (!existingTag) {
        await prisma.tag.create({
          data: {
            groupId: group.id,
            name: tagName,
            createdById: ownerVol.id,
          },
        });
        tagsCreated += 1;
      }
    }
  }

  console.log(`  ✓ tag groups: ${groupsCreated} created, ${groupsUpdated} updated`);
  console.log(`  ✓ ${tagsCreated} new tags`);
}

async function seedSampleVolunteers() {
  console.log('→ seeding sample volunteers (skipping existing)…');
  let created = 0;
  let skipped = 0;

  for (const sample of SAMPLE_VOLUNTEERS) {
    // Skip if email already taken (idempotent)
    const existing = await prisma.account.findUnique({ where: { email: sample.email } });
    if (existing) {
      skipped += 1;
      continue;
    }

    const volunteerCode = await nextVolunteerCode(sample.birthday);
    const passwordHash = await bcrypt.hash(sample.password, 10);

    await prisma.$transaction(async (tx) => {
      const v = await tx.volunteer.create({
        data: {
          volunteerCode,
          chineseName: sample.chineseName,
          englishName: sample.englishName,
          status: 'ACTIVE',
          region: REGION_TO_PG[sample.region] || 'OTHER',
          province: sample.province || null,
          birthday: sample.birthday ? new Date(sample.birthday) : null,
          departmentId: sample.departmentId,
          email: sample.email,
        },
      });
      await tx.account.create({
        data: {
          email: sample.email,
          passwordHash,
          name: sample.chineseName,
          role: sample.role,
          volunteerId: v.id,
        },
      });
    });
    created += 1;
    console.log(`  ✓ ${sample.email} (${volunteerCode}, ${sample.role})`);
  }

  console.log(`  → ${created} created, ${skipped} skipped (already existed)`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== seed start ===');
  await seedDepartments();
  await seedServiceItems();
  await ensureSystemSettings();
  await seedSampleVolunteers();
  // Tag groups need volunteers in DB (for createdBy FK) — seed last.
  await seedTagGroups();
  console.log('=== seed done ===');
  console.log('');
  console.log('Sample login credentials (sandbox only):');
  for (const s of SAMPLE_VOLUNTEERS) {
    console.log(`  ${s.email}  /  ${s.password}  (${s.role}, ${s.departmentId})`);
  }
  console.log('');
}

main()
  .catch((e) => {
    console.error('seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
