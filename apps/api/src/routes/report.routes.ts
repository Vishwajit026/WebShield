import { Router, IRouter } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  getReportController,
  downloadReportController,
  listUserReportsController,
} from '../controllers/report.controller';

const reportRouter: IRouter = Router();

// All report routes require authentication
reportRouter.use(authenticate);

reportRouter.get('/', listUserReportsController);
reportRouter.get('/:id', getReportController);
reportRouter.get('/:id/download', downloadReportController);

export { reportRouter };
