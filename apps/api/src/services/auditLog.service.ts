import { AuditAction, Prisma } from '@prisma/client';
import prisma from '../lib/db';
import { logger } from '../utils/logger';

interface AuditLogParams {
  userId?: string | null;
  action: AuditAction;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonObject;
}

/**
 * Write a security audit event to the database.
 *
 * IMPORTANT:
 * - Never include passwords, tokens, or secrets in metadata.
 * - Always called async/fire-and-forget with error swallowed
 *   so that an audit failure never breaks the primary operation.
 */
export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        ipAddress: params.ipAddress ?? null,
        userAgent: params.userAgent ?? null,
        metadata: params.metadata ?? undefined,
      },
    });
  } catch (err) {
    // Log the failure but never throw — audit logging must not disrupt auth flow
    logger.error('Failed to write audit log', err);
  }
}
