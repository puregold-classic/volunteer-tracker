// prisma/seed.js — v3 (12 departments + ServiceCategory)
//
// Idempotent reference data + a few sample accounts for the dev sandbox.
// Run: `npx prisma db seed` (configured in package.json prisma.seed)
//
// What this does:
// 1. Upsert 12 fixed Departments (by id code).
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

const DEPARTMENTS = [
  { id: 'BY_PROJECT',   name: '笔译项目部', displayOrder: 1 },
  { id: 'KY_PROJECT',   name: '口译项目部', displayOrder: 2 },
  { id: 'XZT',          name: 'XZT',         displayOrder: 3 },
  { id: 'BY_TRAINING',  name: '笔译培训部', displayOrder: 4 },
  { id: 'KY_TRAINING',  name: '口译培训部', displayOrder: 5 },
  { id: 'DOCS',         name: '文档部',     displayOrder: 6 },
  { id: 'PROMO',        name: '推广部',     displayOrder: 7 },
  { id: 'TECH',         name: '技术部',     displayOrder: 8 },
  { id: 'CARE',         name: '人文部',     displayOrder: 9 },
  { id: 'MGMT',         name: '管理部',     displayOrder: 10 },
  { id: 'READING_CLUB', name: '共读会',     displayOrder: 11 },
  { id: 'VIDEO',        name: '视频部',     displayOrder: 12 },
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
  ],
  KY_PROJECT: [
    { name: '服务统计', category: 'PROJECT_MGMT' },
    { name: '沟通反馈', category: 'PROJECT_MGMT' },
    { name: '管理策划', category: 'PROJECT_MGMT' },
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
  DOCS: [
    { name: '国宝录入',     category: 'PROJECT_SUPPORT' },
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
    { name: '视频剪辑', category: 'PROJECT_SUPPORT' },
  ],
};

// ─── Sample volunteer accounts for sandbox testing ────────────────────────────
//
// These are intentionally low-stakes test fixtures. Real volunteers are created
// via /auth/admin/volunteers (CSV import or single-create) by an admin.
//
// All sample accounts use the same password for convenience. Change before
// touching anything resembling production.

const SAMPLE_VOLUNTEERS = [
  {
    chineseName: '张笔译', englishName: 'Zhang Translator',
    email: 'sample-by-leader@vt.local', password: 'Sample@123',
    role: 'b_admin', region: '中国大陆', province: '北京市',
    departmentId: 'BY_PROJECT',
  },
  {
    chineseName: '李口译', englishName: 'Li Interpreter',
    email: 'sample-ky-reviewer@vt.local', password: 'Sample@123',
    role: 'a_admin', region: '中国大陆', province: '上海市',
    departmentId: 'KY_PROJECT',
  },
  {
    chineseName: '王技术', englishName: 'Wang Tech',
    email: 'sample-tech-user@vt.local', password: 'Sample@123',
    role: 'user', region: '中国大陆', province: '广东省',
    departmentId: 'TECH',
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

async function nextVolunteerCode() {
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

    const volunteerCode = await nextVolunteerCode();
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
