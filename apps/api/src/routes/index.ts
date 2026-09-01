import { Router, IRouter } from 'express';
import healthRouter from './health.routes';
import authRouter from './auth.routes';
import scanRouter from './scan.routes';
import dashboardRouter from './dashboard.routes';
import { targetRouter } from './target.routes';
import { reportRouter } from './report.routes';
import { adminRouter } from './admin.routes';

const router: IRouter = Router();

router.use('/health', healthRouter);
router.use('/auth', authRouter);
router.use('/scans', scanRouter);
router.use('/targets', targetRouter);
router.use('/dashboard', dashboardRouter);
router.use('/reports', reportRouter);
router.use('/admin', adminRouter);

export default router;
