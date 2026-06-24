import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { ConfigRepository } from '../config/config.repository';
import { RequestsService } from '../requests/requests.service';
import { RequestsRepository } from '../requests/requests.repository';
import { MatchingRepository } from '../matching/matching.repository';
import { UsersRepository } from '../users/users.repository';
import { BotRepository } from '../bot/bot.repository';

const adminRepository = new AdminRepository();
const configRepository = new ConfigRepository();
const adminService = new AdminService(adminRepository, configRepository);

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

  async getMembershipDiscount(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const result = await adminService.getMembershipDiscount();
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async setMembershipDiscount(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { active, discountPct, durationHours } = req.body as {
        active: boolean;
        discountPct?: number;
        durationHours?: number;
      };
      await adminService.setMembershipDiscount(active, discountPct, durationHours);
      res.status(200).json({ ok: true });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
