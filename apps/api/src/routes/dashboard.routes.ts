import { Router, IRouter } from 'express';
import { authenticate } from '../middleware/authenticate';
import { getOverview } from '../controllers/dashboard.controller';

const router: IRouter = Router();

// All dashboard endpoints require authentication
router.use(authenticate);

// GET /api/dashboard/overview
router.get('/overview', getOverview);

export default router;
