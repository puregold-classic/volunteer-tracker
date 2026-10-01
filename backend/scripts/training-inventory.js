import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import prisma from '../src/utils/prismaClient.js';
import { trainingInventory } from '../src/services/TrainingInventoryService.js';

const output = process.argv[2];
if (!output) throw new Error('Usage: node scripts/training-inventory.js /path/to/report.json');
const url = new URL(process.env.DATABASE_URL);
try {
  const report = await trainingInventory(prisma);
  report.environment = { host: url.hostname, database: url.pathname.slice(1), generatedAt: new Date().toISOString() };
  writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ environment: report.environment, summary: report.summary, candidateSessions: report.candidates.length, reviewGroups: report.review.length, untagged: report.untagged.length, output }, null, 2));
} finally { await prisma.$disconnect(); }
