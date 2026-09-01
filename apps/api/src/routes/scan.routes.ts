import { Router, IRouter } from 'express';
import { authenticate } from '../middleware/authenticate';
import { scanRateLimit } from '../middleware/rateLimiter';
import {
  cancelScanController,
  compareScansController,
  createScan,
  getScan,
  getFindings,
  listScans,
} from '../controllers/scan.controller';
import { createScanReportController } from '../controllers/report.controller';

const router: IRouter = Router();

// All scan routes require authentication
router.use(authenticate);

// List scans
router.get('/', listScans);

// Start a new scan (rate limited)
router.post('/', scanRateLimit, createScan);

// Compare two scans (must be before /:id)
router.get('/compare', compareScansController);

// Cancel an active scan
router.post('/:id/cancel', cancelScanController);

// Generate report for completed scan
router.post('/:id/reports', createScanReportController);

// Get specific scan by ID
router.get('/:id', getScan);

// Get findings for a specific scan
router.get('/:id/findings', getFindings);

export default router;
