import { Router, IRouter } from 'express';
import { authenticate } from '../middleware/authenticate';
import { getTarget, listTargets } from '../controllers/target.controller';

const targetRouter: IRouter = Router();

// All target routes require authentication
targetRouter.use(authenticate);

targetRouter.get('/', listTargets);
targetRouter.get('/:id', getTarget);

export { targetRouter };
