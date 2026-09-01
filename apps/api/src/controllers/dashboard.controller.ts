import { Request, Response, NextFunction } from 'express';
import { getDashboardOverview } from '../services/dashboard.service';

/**
 * GET /api/dashboard/overview
 * Returns aggregate metrics, latest score, and recent scans for the authenticated user.
 */
export async function getOverview(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const overview = await getDashboardOverview(userId);

    res.status(200).json({
      success: true,
      data: overview,
    });
  } catch (err) {
    next(err);
  }
}
