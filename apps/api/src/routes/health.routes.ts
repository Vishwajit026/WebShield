import { Router, IRouter } from 'express';
import { healthCheck } from '../controllers/health.controller';

const router: IRouter = Router();

router.get('/', healthCheck);

export default router;
