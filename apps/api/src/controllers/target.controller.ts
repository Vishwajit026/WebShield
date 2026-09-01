import { Request, Response, NextFunction } from 'express';
import * as targetService from '../services/target.service';

/**
 * GET /api/targets
 * Returns a paginated list of targets belonging to the authenticated user.
 */
export async function listTargets(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 10;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const result = await targetService.getUserTargets(userId, { page, limit, search });
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/targets/:id
 * Retrieves details of a specific target belonging to the authenticated user.
 */
export async function getTarget(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.id;
    const targetId = req.params.id;

    const result = await targetService.getTargetById(targetId, userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}
