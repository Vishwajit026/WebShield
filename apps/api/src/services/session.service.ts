import prisma from '../lib/db';
import { Errors } from '../utils/errors';
import { writeAuditLog } from './auditLog.service';

export interface SessionInfo {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  expiresAt: Date;
}

// ── List active sessions ───────────────────────────────────────────────────────

export async function getActiveSessions(userId: string): Promise<SessionInfo[]> {
  const sessions = await prisma.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      userAgent: true,
      ipAddress: true,
      createdAt: true,
      expiresAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return sessions;
}

// ── Revoke a specific session ─────────────────────────────────────────────────

export async function revokeSession(
  sessionId: string,
  requestingUserId: string,
  context: { ipAddress?: string; userAgent?: string }
): Promise<void> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, revokedAt: true },
  });

  if (!session) {
    throw Errors.notFound('Session');
  }

  // IDOR/BOLA prevention — users can only revoke their own sessions
  if (session.userId !== requestingUserId) {
    throw Errors.forbidden('You cannot revoke another user\'s session.');
  }

  if (session.revokedAt) {
    // Already revoked — idempotent, just return
    return;
  }

  await prisma.session.update({
    where: { id: sessionId },
    data: { revokedAt: new Date() },
  });

  void writeAuditLog({
    userId: requestingUserId,
    action: 'SESSION_REVOKED',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: { revokedSessionId: sessionId },
  });
}

// ── Revoke all OTHER sessions ─────────────────────────────────────────────────

export async function revokeOtherSessions(
  userId: string,
  currentTokenHash: string,
  context: { ipAddress?: string; userAgent?: string }
): Promise<number> {
  // Find current session to keep it
  const currentSession = await prisma.session.findUnique({
    where: { tokenHash: currentTokenHash },
    select: { id: true },
  });

  const excludeId = currentSession?.id;

  const result = await prisma.session.updateMany({
    where: {
      userId,
      revokedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    data: { revokedAt: new Date() },
  });

  void writeAuditLog({
    userId,
    action: 'ALL_SESSIONS_REVOKED',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
    metadata: { count: result.count },
  });

  return result.count;
}
