import { Request, Response, NextFunction } from 'express';
import { RegisterSchema, LoginSchema, registerUser, loginUser, refreshTokens, logoutUser } from '../services/auth.service';
import { hashRefreshToken } from '../utils/jwt';
import prisma from '../lib/db';
import config from '../config/env';

// ── Cookie config ─────────────────────────────────────────────────────────────

const REFRESH_COOKIE_NAME = 'ws_refresh';

function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
    maxAge: config.jwt.refreshExpiresInMs(),
    path: '/api/auth', // Restrict cookie scope to auth routes
  });
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: config.nodeEnv === 'production' ? 'strict' : 'lax',
    path: '/api/auth',
  });
}

function getIp(req: Request): string {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'unknown'
  );
}

// ── POST /api/auth/register ───────────────────────────────────────────────────

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = RegisterSchema.parse(req.body);
    const user = await registerUser(input, {
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.status(201).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/login ──────────────────────────────────────────────────────

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const input = LoginSchema.parse(req.body);
    const result = await loginUser(input, {
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/refresh ────────────────────────────────────────────────────

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

    if (!rawToken) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Refresh token missing.' },
      });
      return;
    }

    const result = await refreshTokens(rawToken, {
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      success: true,
      data: { accessToken: result.accessToken },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

    if (rawToken) {
      await logoutUser(rawToken, {
        userId: req.user?.id,
        ipAddress: getIp(req),
        userAgent: req.headers['user-agent'],
      });
    }

    clearRefreshCookie(res);

    res.status(200).json({
      success: true,
      data: { message: 'Logged out successfully.' },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/auth/me ──────────────────────────────────────────────────────────

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'User not found.' },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/auth/sessions ────────────────────────────────────────────────────

export async function getSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const currentToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

    let currentTokenHash: string | null = null;
    if (currentToken) {
      currentTokenHash = hashRefreshToken(currentToken);
    }

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
        tokenHash: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const safeSessions = sessions.map(s => ({
      id: s.id,
      userAgent: s.userAgent,
      ipAddress: s.ipAddress,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
      isCurrent: currentTokenHash ? s.tokenHash === currentTokenHash : false,
    }));

    res.status(200).json({
      success: true,
      data: { sessions: safeSessions },
    });
  } catch (err) {
    next(err);
  }
}

// ── DELETE /api/auth/sessions/:id ────────────────────────────────────────────

export async function revokeSessionById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const requestingUserId = req.user!.id;

    const { revokeSession } = await import('../services/session.service');
    await revokeSession(id, requestingUserId, {
      ipAddress: getIp(req),
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      data: { message: 'Session revoked.' },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/sessions/revoke-others ─────────────────────────────────────

export async function revokeOtherSessions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!.id;
    const currentToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME];

    const { revokeOtherSessions: revokeOthers } = await import('../services/session.service');

    const count = await revokeOthers(
      userId,
      currentToken ? hashRefreshToken(currentToken) : '',
      {
        ipAddress: getIp(req),
        userAgent: req.headers['user-agent'],
      }
    );

    res.status(200).json({
      success: true,
      data: { message: `${count} other session(s) revoked.` },
    });
  } catch (err) {
    next(err);
  }
}
