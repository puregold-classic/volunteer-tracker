// prisma/seed.js — v2.1
//
// Idempotent reference data + a few sample accounts for the dev sandbox.
// Run: `npx prisma db seed` (configured in package.json prisma.seed)
//
// What this does:
// 1. Upsert 10 fixed Departments (by id code).
// 2. Upsert ~50 ServiceItems scoped under each department.
// 3. Ensure SystemSettings singleton row exists (migration also does this).
// 4. Create a small set of sample volunteer accounts for testing
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
  { id: 'BY_PROJECT',  name: '笔译项目部', displayOrder: 1 },
  { id: 'KY_PROJECT',  name: '口译项目部', displayOrder: 2 },
  { id: 'XZT',         name: 'XZT',         displayOrder: 3 },
  { id: 'BY_TRAINING', name: '笔译培训部', displayOrder: 4 },
  { id: 'KY_TRAINING', name: '口译培训部', displayOrder: 5 },
  { id: 'DOCS',        name: '文档部',     displayOrder: 6 },
  { id: 'PROMO',       name: '推广部',     displayOrder: 7 },
  { id: 'TECH',        name: '技术部',     displayOrder: 8 },
  { id: 'CARE',        name: '人文部',     displayOrder: 9 },
  { id: 'MGMT',        name: '管理部',     displayOrder: 10 },
];

const SERVICE_ITEMS = {
  BY_PROJECT:  ['服务统计', '沟通反馈', '管理策划'],
  KY_PROJECT:  ['服务统计', '沟通反馈'],
  XZT:         ['录制', '笔记', 'PM', '信息传递', '服务统计', '沟通反馈'],
  BY_TRAINING: ['策划', '对外联络', '沟通与记录', '项目执行', '服务统计'],
  KY_TRAINING: ['策划', '对外联络', '沟通与记录', '项目执行', '服务统计'],
  DOCS:        ['国宝录入', '文件改名', '文件整理归档', '服务统计'],
  PROMO:       ['统筹', '策划', '文案', '海报', '推广', '运营', '服务统计'],
  TECH:        ['计时', '播放', '聚焦', '录制', '分组', '培训', '服务统计', '技术培训'],
  CARE:        ['信息更新', '人文关怀', '沟通管理', '服务统计', '人文培训'],
  MGMT:        ['组织设计', '培训设计', '制度建立', '流程改善', '服务统计'],
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
  let totalCount = 0;
  for (const [departmentId, items] of Object.entries(SERVICE_ITEMS)) {
    for (let i = 0; i < items.length; i += 1) {
      const name = items[i];
      const displayOrder = i + 1;
      // Upsert by composite (departmentId, name) — this is the natural key
      const existing = await prisma.serviceItem.findUnique({
        where: { departmentId_name: { departmentId, name } },
      });
      if (existing) {
        await prisma.serviceItem.update({
          where: { id: existing.id },
          data: { displayOrder, isActive: true },
        });
      } else {
        await prisma.serviceItem.create({
          data: { departmentId, name, displayOrder, isActive: true },
        });
      }
      totalCount += 1;
    }
  }
  console.log(`  ✓ ${totalCount} service items across ${Object.keys(SERVICE_ITEMS).length} departments`);
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
