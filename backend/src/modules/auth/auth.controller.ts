import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { AppError } from '../../middleware/error-handler';

const authRepository = new AuthRepository();
const authService = new AuthService(authRepository);

const COOKIE_NAME = 'admin_token';

function getCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    domain: isProduction ? '.nora.com.ar' : undefined,
  };
}

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as { email: string; password: string };

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required', statusCode: 400 });
        return;
      }

      const result = await authService.login(email, password);
      res.cookie(COOKIE_NAME, result.token, {
        ...getCookieOptions(),
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({ admin: result.admin });
    } catch (err) {
      next(err);
    }
  }

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie(COOKIE_NAME, getCookieOptions());
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.admin?.adminId) {
        throw new AppError('Unauthorized', 401);
      }

      const admin = await authService.getAdminById(req.admin.adminId);

      if (!admin) {
        throw new AppError('Admin not found', 404);
      }

      res.status(200).json({ admin });
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
