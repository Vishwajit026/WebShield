import net from 'net';
import path from 'path';
import fs from 'fs';
import { PGlite } from '@electric-sql/pglite';
import { fromNodeSocket } from 'pg-gateway/node';

const dataDir = path.resolve(__dirname, '../.dev-pgdata');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new PGlite(dataDir);

async function initSchema() {
  console.log('[dev-db] ⏳ Initializing database schema...');
  try {
    await db.exec(`
      DO $$ BEGIN
        CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "AuditAction" AS ENUM (
          'REGISTER_SUCCESS', 'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT',
          'SESSION_REVOKED', 'ALL_SESSIONS_REVOKED', 'ADMIN_ACTION', 'TOKEN_REFRESHED',
          'SCAN_CREATED', 'SCAN_COMPLETED', 'SCAN_FAILED', 'SCAN_CANCELLED',
          'REPORT_GENERATED', 'REPORT_DOWNLOADED', 'USER_SUSPENDED', 'USER_REACTIVATED',
          'ROLE_CHANGED', 'ADMIN_VIEWED_USER', 'ADMIN_VIEWED_SCAN', 'ADMIN_VIEWED_REPORT'
        );
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "ScanStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "ReportStatus" AS ENUM ('GENERATING', 'COMPLETED', 'FAILED');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      DO $$ BEGIN
        CREATE TYPE "Confidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW');
      EXCEPTION WHEN duplicate_object THEN null;
      END $$;

      CREATE TABLE IF NOT EXISTS "users" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "email" TEXT UNIQUE NOT NULL,
        "passwordHash" TEXT NOT NULL,
        "role" "Role" NOT NULL DEFAULT 'USER',
        "isSuspended" BOOLEAN NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "lastLoginAt" TIMESTAMP(3)
      );
      CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
      CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
      CREATE INDEX IF NOT EXISTS "users_isSuspended_idx" ON "users"("isSuspended");

      CREATE TABLE IF NOT EXISTS "sessions" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "tokenHash" TEXT UNIQUE NOT NULL,
        "userAgent" TEXT,
        "ipAddress" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "expiresAt" TIMESTAMP(3) NOT NULL,
        "revokedAt" TIMESTAMP(3)
      );
      CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId");
      CREATE INDEX IF NOT EXISTS "sessions_tokenHash_idx" ON "sessions"("tokenHash");

      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
        "action" "AuditAction" NOT NULL,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "metadata" JSONB,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");
      CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs"("action");
      CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

      CREATE TABLE IF NOT EXISTS "targets" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "url" TEXT NOT NULL,
        "normalizedUrl" TEXT NOT NULL,
        "hostname" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "targets_userId_idx" ON "targets"("userId");
      CREATE INDEX IF NOT EXISTS "targets_hostname_idx" ON "targets"("hostname");

      CREATE TABLE IF NOT EXISTS "scans" (
        "id" TEXT PRIMARY KEY,
        "targetId" TEXT NOT NULL REFERENCES "targets"("id") ON DELETE CASCADE,
        "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "status" "ScanStatus" NOT NULL DEFAULT 'QUEUED',
        "startedAt" TIMESTAMP(3),
        "completedAt" TIMESTAMP(3),
        "securityScore" INTEGER,
        "totalFindings" INTEGER NOT NULL DEFAULT 0,
        "criticalCount" INTEGER NOT NULL DEFAULT 0,
        "highCount" INTEGER NOT NULL DEFAULT 0,
        "mediumCount" INTEGER NOT NULL DEFAULT 0,
        "lowCount" INTEGER NOT NULL DEFAULT 0,
        "infoCount" INTEGER NOT NULL DEFAULT 0,
        "errorMessage" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "scans_userId_idx" ON "scans"("userId");
      CREATE INDEX IF NOT EXISTS "scans_targetId_idx" ON "scans"("targetId");
      CREATE INDEX IF NOT EXISTS "scans_status_idx" ON "scans"("status");
      CREATE INDEX IF NOT EXISTS "scans_createdAt_idx" ON "scans"("createdAt");

      CREATE TABLE IF NOT EXISTS "findings" (
        "id" TEXT PRIMARY KEY,
        "scanId" TEXT NOT NULL REFERENCES "scans"("id") ON DELETE CASCADE,
        "scanner" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "category" TEXT NOT NULL,
        "severity" "Severity" NOT NULL,
        "confidence" "Confidence" NOT NULL,
        "description" TEXT NOT NULL,
        "evidence" TEXT,
        "impact" TEXT,
        "remediation" TEXT,
        "reference" TEXT,
        "affectedComponent" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "findings_scanId_idx" ON "findings"("scanId");
      CREATE INDEX IF NOT EXISTS "findings_severity_idx" ON "findings"("severity");
      CREATE INDEX IF NOT EXISTS "findings_category_idx" ON "findings"("category");

      CREATE TABLE IF NOT EXISTS "reports" (
        "id" TEXT PRIMARY KEY,
        "scanId" TEXT NOT NULL REFERENCES "scans"("id") ON DELETE CASCADE,
        "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "status" "ReportStatus" NOT NULL DEFAULT 'GENERATING',
        "fileName" TEXT NOT NULL,
        "filePath" TEXT NOT NULL,
        "fileSize" INTEGER,
        "errorMessage" TEXT,
        "generatedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS "reports_userId_idx" ON "reports"("userId");
      CREATE INDEX IF NOT EXISTS "reports_scanId_idx" ON "reports"("scanId");
    `);
    console.log('[dev-db] ✅ Schema initialized successfully.');
  } catch (err) {
    console.error('[dev-db] Schema initialization error:', err);
  }
}

const server = net.createServer(socket => {
  fromNodeSocket(socket, {
    server: db,
    auth: {
      method: 'trust',
    },
  }).catch(err => {
    if (err.code !== 'ECONNRESET') {
      console.error('[dev-db] Socket error:', err.message);
    }
  });
});

const PORT = 5432;

initSchema().then(() => {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`[dev-db] 🐘 Embedded PostgreSQL server listening on 127.0.0.1:${PORT}`);
    console.log(`[dev-db] Data directory: ${dataDir}`);
  });
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
