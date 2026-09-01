import { Router, IRouter } from 'express';
import { authRateLimit, refreshRateLimit } from '../middleware/rateLimiter';
import { authenticate } from '../middleware/authenticate';
import {
  register,
  login,
  refresh,
  logout,
  me,
  getSessions,
  revokeSessionById,
  revokeOtherSessions,
} from '../controllers/auth.controller';

const router: IRouter = Router();

// ── Public routes (rate limited) ──────────────────────────────────────────────

router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);
router.post('/refresh', refreshRateLimit, refresh);

// ── Protected routes (require valid access token) ─────────────────────────────

router.post('/logout', authenticate, logout);
router.get('/me', authenticate, me);
router.get('/sessions', authenticate, getSessions);

// Sessions management
// Note: revoke-others must come before :id to avoid route conflict
router.post('/sessions/revoke-others', authenticate, revokeOtherSessions);
router.delete('/sessions/:id', authenticate, revokeSessionById);

export default router;
