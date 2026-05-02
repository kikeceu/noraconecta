import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';

const authRepository = new AuthRepository();
const authService = new AuthService(authRepository);

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as { email: string; password: string };

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required', statusCode: 400 });
        return;
      }

      const result = await authService.login(email, password);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const authController = new AuthController();
