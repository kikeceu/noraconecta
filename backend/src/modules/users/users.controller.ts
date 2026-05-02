import { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

const usersRepository = new UsersRepository();
const usersService = new UsersService(usersRepository);

export class UsersController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = req.query as { page?: string; limit?: string };

      const result = await usersService.list(
        page ? parseInt(page, 10) : undefined,
        limit ? parseInt(limit, 10) : undefined,
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'User id is required', statusCode: 400 });
        return;
      }

      const user = await usersService.getById(id);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  }

  async block(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'User id is required', statusCode: 400 });
        return;
      }

      const user = await usersService.block(id);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  }

  async unblock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'User id is required', statusCode: 400 });
        return;
      }

      const user = await usersService.unblock(id);
      res.status(200).json({ data: user });
    } catch (err) {
      next(err);
    }
  }
}

export const usersController = new UsersController();
