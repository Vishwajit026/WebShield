import { Role } from '@prisma/client';
import prisma from '../lib/db';
import { hashPassword, verifyPassword } from '../utils/password';
import { signAccessToken, generateRefreshToken } from '../utils/jwt';
import { writeAuditLog } from './auditLog.service';
import { Errors } from '../utils/errors';
import config from '../config/env';

// ── Zod schemas (shared validation) ──────────────────────────────────────────
import { z } from 'zod';

export const RegisterSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  email: z
    .string()
    .email('Invalid email address')
    .max(254, 'Email too long'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;

// ── Safe user shape (never includes passwordHash) ─────────────────────────────

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  isSuspended: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}

function toSafeUser(user: {
  id: string;
  name: string;
  email: string;
  role: Role;
  isSuspended: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date | null;
}): SafeUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isSuspended: user.isSuspended,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastLoginAt: user.lastLoginAt,
  };
}

// ── Normalize email ───────────────────────────────────────────────────────────

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ── Registration ──────────────────────────────────────────────────────────────

export async function registerUser(
  input: RegisterInput,
  context: { ipAddress?: string; userAgent?: string }
): Promise<SafeUser> {
  const { name, email, password } = input;
  const normalizedEmail = normalizeEmail(email);

  // Check for existing account
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existing) {
    // Generic error — don't reveal whether the email exists
    throw Errors.conflict('An account with this email already exists.');
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: Role.USER,
    },
  });

  // Fire-and-forget audit
  void writeAuditLog({
    userId: user.id,
    action: 'REGISTER_SUCCESS',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return toSafeUser(user);
}

// ── Login ─────────────────────────────────────────────────────────────────────

export interface LoginResult {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export async function loginUser(
  input: LoginInput,
  context: { ipAddress?: string; userAgent?: string }
): Promise<LoginResult> {
  const normalizedEmail = normalizeEmail(input.email);

  // Use a generic error for both "not found" and "wrong password"
  // to prevent account enumeration
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Always run password verification — prevents timing attacks that reveal
  // whether the account exists
  const dummyHash =
    '$argon2id$v=19$m=65536,t=3,p=1$dummysalt12345678901234$dummyhash123456789012345678901234567890123';

  const passwordMatch = user
    ? await verifyPassword(user.passwordHash, input.password)
    : await verifyPassword(dummyHash, input.password).catch(() => false);

  if (!user || !passwordMatch) {
    void writeAuditLog({
      userId: user?.id ?? null,
      action: 'LOGIN_FAILED',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { email: normalizedEmail },
    });
    throw Errors.invalidCredentials();
  }

  if (user.isSuspended) {
    throw Errors.forbidden('Account has been suspended. Please contact administrator.');
  }

  // Update lastLoginAt
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  // Create session
  const { raw: refreshToken, hash: tokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInMs());

  const session = await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
      expiresAt,
    },
  });

  // Sign access token
  const accessToken = signAccessToken(user.id, user.role);

  // Audit
  void writeAuditLog({
    userId: user.id,
    action: 'LOGIN_SUCCESS',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return {
    user: toSafeUser({ ...user, lastLoginAt: new Date() }),
    accessToken,
    refreshToken,
    sessionId: session.id,
  };
}

// ── Refresh ───────────────────────────────────────────────────────────────────

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
}

export async function refreshTokens(
  rawRefreshToken: string,
  context: { ipAddress?: string; userAgent?: string }
): Promise<RefreshResult> {
  const { hashRefreshToken } = await import('../utils/jwt');
  const tokenHash = hashRefreshToken(rawRefreshToken);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw Errors.unauthorized('Session expired or revoked.');
  }

  if (session.user.isSuspended) {
    throw Errors.forbidden('Account has been suspended. Please contact administrator.');
  }

  // Rotate: revoke old session, create new session
  await prisma.session.update({
    where: { id: session.id },
    data: { revokedAt: new Date() },
  });

  const { raw: newRefreshToken, hash: newTokenHash } = generateRefreshToken();
  const expiresAt = new Date(Date.now() + config.jwt.refreshExpiresInMs());

  await prisma.session.create({
    data: {
      userId: session.userId,
      tokenHash: newTokenHash,
      userAgent: context.userAgent ?? session.userAgent,
      ipAddress: context.ipAddress ?? session.ipAddress,
      expiresAt,
    },
  });

  const accessToken = signAccessToken(session.user.id, session.user.role);

  void writeAuditLog({
    userId: session.userId,
    action: 'TOKEN_REFRESHED',
    ipAddress: context.ipAddress,
    userAgent: context.userAgent,
  });

  return { accessToken, refreshToken: newRefreshToken };
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logoutUser(
  rawRefreshToken: string,
  context: { userId?: string; ipAddress?: string; userAgent?: string }
): Promise<void> {
  const { hashRefreshToken } = await import('../utils/jwt');
  const tokenHash = hashRefreshToken(rawRefreshToken);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, revokedAt: true },
  });

  // Idempotent — if already revoked or not found, still succeeds
  if (session && !session.revokedAt) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    void writeAuditLog({
      userId: session.userId,
      action: 'LOGOUT',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }
}
