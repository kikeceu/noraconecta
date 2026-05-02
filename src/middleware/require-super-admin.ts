import { Request, Response, NextFunction } from 'express';
import { requireAuth } from './require-auth';
import { AppError } from './error-handler';

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.admin?.role !== 'SUPERADMIN') {
      next(new AppError('Forbidden: SUPERADMIN role required', 403));
      return;
    }
    next();
  });
}
