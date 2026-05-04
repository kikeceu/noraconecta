import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { RequestsService } from '../requests/requests.service';
import { RequestsRepository } from '../requests/requests.repository';
import { UsersRepository } from '../users/users.repository';

const adminRepository = new AdminRepository();
const adminService = new AdminService(adminRepository);

const requestsRepository = new RequestsRepository();
const usersRepository = new UsersRepository();
const requestsService = new RequestsService(requestsRepository, usersRepository);

export class AdminController {
  async getMetrics(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const metrics = await adminService.getMetrics();
      res.status(200).json({ data: metrics });
    } catch (err) {
      next(err);
    }
  }

  async autoCloseRequests(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const processed = await requestsService.autoClosePendingConfirmations();
      res.status(200).json({ data: { processed } });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
