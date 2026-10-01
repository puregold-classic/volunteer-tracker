import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
import prisma from '../src/utils/prismaClient.js';
import { migrateTraining } from '../src/services/TrainingMigrationService.js';

const args = process.argv.slice(2);
const option = (key) => args[args.indexOf(key) + 1];
if (!args.includes('--manifest') || !args.includes('--operator') || !args.includes('--output')) throw new Error('Usage: node scripts/migrate-training.js --manifest mapping.json --operator ACCOUNT_ID --output result.json [--apply]');
try {
  const account = await prisma.account.findUnique({ where: { id: option('--operator') } });
  if (!account?.isActive) throw new Error('系统管理员不存在或已停用');
  const result = await migrateTraining(prisma, JSON.parse(readFileSync(option('--manifest'), 'utf8')), { accountId: account.id, role: account.role, name: account.name }, { apply: args.includes('--apply') });
  writeFileSync(option('--output'), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ applied: result.applied, sessions: result.sessions.length, output: option('--output') }));
} finally { await prisma.$disconnect(); }
