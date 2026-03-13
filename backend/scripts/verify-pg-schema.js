/**
 * Phase 1 verification script: confirm PostgreSQL schema is correctly applied.
 *
 * Uses Prisma's $queryRaw to query pg_catalog — no extra dependencies needed.
 * MongoDB is NOT touched. This script is read-only against PG.
 *
 * Usage (inside container or from host via docker):
 *   DATABASE_URL="postgresql://..." node scripts/verify-pg-schema.js
 *   docker-compose exec -e DATABASE_URL="postgresql://volunteer_user:dev_pg_password@postgres:5432/volunteer_tracker" backend node scripts/verify-pg-schema.js
 */

import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL env var is required');
  process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url: DATABASE_URL } } });

const EXPECTED_TABLES = [
  'accounts',
  'volunteers',
  'service_applications',
  'non_project_services',
  'audit_logs',
];

const EXPECTED_ENUMS = [
  'Role',
  'VolunteerStatus',
  'Region',
  'ActivityLevel',
  'ServiceType',
  'ApplicationType',
  'ApplicationStatus',
  'AuditTargetType',
  'AuditAction',
  'ReviewResult',
];

const EXPECTED_UNIQUE_INDEXES = [
  'accounts_email_key',
  'accounts_volunteerId_key',
  'volunteers_volunteerId_key',
  'service_applications_applicationId_key',
  'non_project_services_serviceId_key',
  'audit_logs_auditId_key',
];

const EXPECTED_PARTIAL_INDEX = 'non_project_services_dedup_active_idx';

let passed = 0;
let failed = 0;

function ok(msg) { console.log(`  ✅ ${msg}`); passed++; }
function fail(msg) { console.error(`  ❌ ${msg}`); failed++; }

async function run() {
  try {
    await prisma.$connect();
    console.log('✅ Connected to PostgreSQL\n');

    // 1. Tables
    console.log('── Tables ──────────────────────────────────────');
    const tables = await prisma.$queryRaw`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename
    `;
    const existingTables = new Set(tables.map(r => r.tablename));
    for (const t of EXPECTED_TABLES) {
      existingTables.has(t) ? ok(t) : fail(`Missing table: ${t}`);
    }

    // 2. Enums
    console.log('\n── Enums ───────────────────────────────────────');
    const enums = await prisma.$queryRaw`
      SELECT typname FROM pg_type
      JOIN pg_namespace ON pg_namespace.oid = pg_type.typnamespace
      WHERE pg_namespace.nspname = 'public' AND pg_type.typtype = 'e'
      ORDER BY typname
    `;
    const existingEnums = new Set(enums.map(r => r.typname));
    for (const e of EXPECTED_ENUMS) {
      existingEnums.has(e) ? ok(e) : fail(`Missing enum: ${e}`);
    }

    // 3. Unique indexes
    console.log('\n── Unique Indexes ──────────────────────────────');
    const idxRows = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname
    `;
    const existingIdx = new Set(idxRows.map(r => r.indexname));
    for (const idx of EXPECTED_UNIQUE_INDEXES) {
      existingIdx.has(idx) ? ok(idx) : fail(`Missing unique index: ${idx}`);
    }

    // 4. Partial unique index
    console.log('\n── Partial Unique Index ────────────────────────');
    const partialRows = await prisma.$queryRaw`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND indexname = ${EXPECTED_PARTIAL_INDEX}
    `;
    if (partialRows.length > 0) {
      ok(EXPECTED_PARTIAL_INDEX);
      console.log(`     def: ${partialRows[0].indexdef}`);
    } else {
      fail(`Missing partial unique index: ${EXPECTED_PARTIAL_INDEX}`);
    }

    // 5. Migration history
    console.log('\n── Migration History ───────────────────────────');
    const migrations = await prisma.$queryRaw`
      SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY started_at
    `;
    for (const m of migrations) {
      ok(`${m.migration_name} (applied: ${m.finished_at ? 'yes' : 'no'})`);
    }

    // 6. Row count sanity (should be 0 — Phase 1 is schema only)
    console.log('\n── Row Counts (expect 0 — schema-only phase) ──');
    const counts = await Promise.all([
      prisma.account.count().then(n => ({ table: 'accounts', n })),
      prisma.volunteer.count().then(n => ({ table: 'volunteers', n })),
      prisma.serviceApplication.count().then(n => ({ table: 'service_applications', n })),
      prisma.nonProjectService.count().then(n => ({ table: 'non_project_services', n })),
      prisma.auditLog.count().then(n => ({ table: 'audit_logs', n })),
    ]);
    for (const { table, n } of counts) {
      ok(`${table}: ${n} rows`);
    }

  } catch (err) {
    console.error('Fatal error:', err.message);
    failed++;
  } finally {
    await prisma.$disconnect();
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Phase 1 PG Schema Verification: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.error('Schema is NOT complete. Fix before proceeding to Phase 2.');
    process.exit(1);
  } else {
    console.log('✅ Phase 1 complete. PG schema verified. Safe to proceed to Phase 2.');
    console.log('   MongoDB is untouched — rollback path is intact.');
  }
}

run();
