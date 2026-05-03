import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';

const adminRepository = new AdminRepository();
const adminService = new AdminService(adminRepository);

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
}

export const adminController = new AdminController();
