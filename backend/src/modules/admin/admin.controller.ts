import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { RequestsService } from '../requests/requests.service';
import { RequestsRepository } from '../requests/requests.repository';
import { MatchingRepository } from '../matching/matching.repository';
import { UsersRepository } from '../users/users.repository';
import { BotRepository } from '../bot/bot.repository';

const adminRepository = new AdminRepository();
const adminService = new AdminService(adminRepository);

const requestsRepository = new RequestsRepository();
const usersRepository = new UsersRepository();
const matchingRepository = new MatchingRepository();
const botRepository = new BotRepository();
const requestsService = new RequestsService(requestsRepository, usersRepository, matchingRepository, botRepository);

export class AdminController {
  async getMetrics(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { geoNodeId } = req.query as { geoNodeId?: string };
      const metrics = await adminService.getMetrics(geoNodeId || undefined);
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

  async getGeoTree(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const tree = await adminService.getGeoTree();
      res.status(200).json({ data: tree });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
