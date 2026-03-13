-- CreateEnum
CREATE TYPE "Role" AS ENUM ('user', 'b_admin', 'a_admin', 'admin');

-- CreateEnum
CREATE TYPE "VolunteerStatus" AS ENUM ('在职', '不在职');

-- CreateEnum
CREATE TYPE "Region" AS ENUM ('中国大陆', '中国台湾', '东南亚', '美国', '欧洲', '其他');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('高', '中', '低');

-- CreateEnum
CREATE TYPE "ServiceType" AS ENUM ('翻译', '校对', '管理', '技术');

-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('create', 'update', 'delete');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('pending', 'approved', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "AuditTargetType" AS ENUM ('ServiceApplication', 'NonProjectService');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('application_review', 'application_withdraw', 'application_reopen', 'review_withdraw', 'system_cleanup', 'seed_import');

-- CreateEnum
CREATE TYPE "ReviewResult" AS ENUM ('approved', 'rejected', 'reopened', 'withdrawn', 'seeded');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'user',
    "volunteerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "volunteers" (
    "id" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "chineseName" TEXT NOT NULL,
    "englishName" TEXT NOT NULL,
    "avatar" TEXT NOT NULL DEFAULT 'https://ui-avatars.com/api/?name=Unknown&background=random',
    "status" "VolunteerStatus" NOT NULL DEFAULT '在职',
    "region" "Region" NOT NULL,
    "province" TEXT,
    "subRegion" TEXT,
    "services" "ServiceType"[],
    "nonProjectHours" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nonProjectCount" INTEGER NOT NULL DEFAULT 0,
    "activityLevel" "ActivityLevel" NOT NULL DEFAULT '中',
    "email" TEXT,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'user',
    "joinDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "volunteers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_applications" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "applicationType" "ApplicationType" NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'NonProjectService',
    "volunteerId" TEXT NOT NULL,
    "volunteerName" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "targetId" TEXT,
    "submittedBy" JSONB NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'pending',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reviewNotes" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "non_project_services" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "volunteerId" TEXT NOT NULL,
    "volunteerName" TEXT NOT NULL,
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "serviceType" "ServiceType" NOT NULL,
    "duration" DOUBLE PRECISION NOT NULL,
    "description" TEXT NOT NULL,
    "auditHistory" JSONB NOT NULL DEFAULT '[]',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "non_project_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "targetType" "AuditTargetType" NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actionDetails" JSONB NOT NULL,
    "modifiedId" TEXT,
    "changes" JSONB NOT NULL DEFAULT '[]',
    "operator" JSONB NOT NULL,
    "submitter" JSONB NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_volunteerId_key" ON "accounts"("volunteerId");

-- CreateIndex
CREATE INDEX "accounts_role_isActive_idx" ON "accounts"("role", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "volunteers_volunteerId_key" ON "volunteers"("volunteerId");

-- CreateIndex
CREATE INDEX "volunteers_status_idx" ON "volunteers"("status");

-- CreateIndex
CREATE INDEX "volunteers_region_idx" ON "volunteers"("region");

-- CreateIndex
CREATE INDEX "volunteers_activityLevel_idx" ON "volunteers"("activityLevel");

-- CreateIndex
CREATE INDEX "volunteers_nonProjectHours_idx" ON "volunteers"("nonProjectHours");

-- CreateIndex
CREATE UNIQUE INDEX "service_applications_applicationId_key" ON "service_applications"("applicationId");

-- CreateIndex
CREATE INDEX "service_applications_status_createdAt_idx" ON "service_applications"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "service_applications_volunteerId_createdAt_idx" ON "service_applications"("volunteerId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "service_applications_createdAt_idx" ON "service_applications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "non_project_services_serviceId_key" ON "non_project_services"("serviceId");

-- CreateIndex
CREATE INDEX "non_project_services_volunteerId_serviceDate_idx" ON "non_project_services"("volunteerId", "serviceDate" DESC);

-- CreateIndex
CREATE INDEX "non_project_services_serviceType_idx" ON "non_project_services"("serviceType");

-- CreateIndex
CREATE INDEX "non_project_services_isActive_idx" ON "non_project_services"("isActive");

-- CreateIndex
CREATE INDEX "non_project_services_serviceDate_idx" ON "non_project_services"("serviceDate");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_auditId_key" ON "audit_logs"("auditId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_targetId_idx" ON "audit_logs"("targetId");

-- CreateIndex
CREATE INDEX "audit_logs_modifiedId_idx" ON "audit_logs"("modifiedId");
