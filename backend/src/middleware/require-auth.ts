import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { AppError } from './error-handler';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const headerToken = authHeader?.startsWith('Bearer ')
    ? authHeader.split(' ')[1]
    : null;
  const cookieToken = req.cookies?.admin_token as string | undefined;
  const token = headerToken || cookieToken;

  if (!token) {
    next(new AppError('Missing or invalid authorization header', 401));
    return;
  }

  try {
    const payload = verifyToken(token);
    req.admin = payload;
    next();
  } catch {
    next(new AppError('Invalid or expired token', 401));
  }
}
