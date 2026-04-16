// src/server.js — v2.1
//
// API surface (all under /api/v1):
//   /auth                — login / register / me / logout / admin account management
//   /volunteers          — read + update (creation goes through /auth/admin/volunteers)
//   /departments         — 10 fixed organizational units (read public, mutate admin)
//   /service-items       — ~50 service categories scoped to departments
//   /system-settings     — singleton config (lockedBefore for monthly seal)
//   /project-supports    — CRUD + confirm/reject for support records
//   /support-ledger      — read-only admin ledger (replaces v1 /reviews)
//   /audit               — audit log query (admin only)
//   /exports             — CSV/Excel/JSON export (admin only)
//
// Phase 5: Removed MongoDB/Mongoose. Phase v2.1: removed ServiceApplication
// pipeline; reference data (Department/ServiceItem) added; review flow simplified.

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import morgan from 'morgan';

import prisma from './utils/prismaClient.js';
import { createInitialAdminIfMissing } from './startup/createInitialAdmin.js';
import authRoutes from './routes/authRoutes.js';
import volunteerRoutes from './routes/volunteerRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import serviceItemRoutes from './routes/serviceItemRoutes.js';
import systemSettingsRoutes from './routes/systemSettingsRoutes.js';
import projectSupportRoutes from './routes/projectSupportRoutes.js';
import supportLedgerRoutes from './routes/supportLedgerRoutes.js';
import auditRoutes from './routes/auditRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

// 安全 / 日志 / body 解析
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Behind Cloudflare tunnel — trust X-Forwarded-* headers so rate-limit
// and other middleware see real client IP instead of the Cloudflare edge IP.
app.set('trust proxy', 1);

// CORS — exact-match whitelist. Do NOT use .includes() substring checks:
// origin.includes('localhost') would match evil.localhost.com.
const DEV_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
]);
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (DEV_ORIGINS.has(origin)) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS not allowed: ${origin}`));
    },
    credentials: true,
  }),
);

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/volunteers', volunteerRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/service-items', serviceItemRoutes);
app.use('/api/v1/system-settings', systemSettingsRoutes);
app.use('/api/v1/project-supports', projectSupportRoutes);
app.use('/api/v1/support-ledger', supportLedgerRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/exports', exportRoutes);

// Health check — in production return minimal info (no version/env fingerprint).
app.get('/api/health', async (req, res) => {
  let pgStatus = 'unknown';
  try {
    await prisma.$queryRaw`SELECT 1`;
    pgStatus = 'connected';
  } catch {
    pgStatus = 'disconnected';
  }
  if (pgStatus !== 'connected') {
    return res.status(503).json({ status: 'degraded' });
  }
  const isDev = process.env.NODE_ENV !== 'production';
  return res.json({
    status: 'ok',
    ...(isDev && {
      message: '志愿者管理系统 API 正常运行',
      schemaVersion: '2.1+v3',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      postgresql: pgStatus,
    }),
  });
});

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>Volunteer Tracker API</title></head>
    <body style="font-family:sans-serif;padding:40px;max-width:800px;margin:auto">
      <h1>🚀 Volunteer Tracker Backend API (schema v2.1)</h1>
      <p>✅ Server running on port ${PORT}</p>
      <p>数据库: PostgreSQL (Prisma)</p>
      <p>请通过 <code>GET /api/health</code> 检查运行状态。</p>
    </body>
    </html>
  `);
});

app.use(notFound);
app.use(errorHandler);

const start = async () => {
  try {
    await createInitialAdminIfMissing();
  } catch (err) {
    console.error('[startup] admin bootstrap threw:', err);
  }

  app.listen(PORT, HOST, () => {
    console.log(`🚀 服务器运行在端口 ${PORT}`);
    console.log(`📡 健康检查: http://localhost:${PORT}/api/health`);
    console.log(`👤 志愿者: /api/v1/volunteers`);
    console.log(`🏢 部门: /api/v1/departments`);
    console.log(`📋 服务项: /api/v1/service-items`);
    console.log(`📝 项目支援: /api/v1/project-supports`);
    console.log(`📊 项目支援台账: /api/v1/support-ledger`);
    console.log(`📜 审计日志: /api/v1/audit`);
    console.log(`💾 导出: /api/v1/exports`);
  });
};

start();
