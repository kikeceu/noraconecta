import { Request, Response, NextFunction } from 'express';
import { ProfessionalsService, VerificationStageTwoInput } from './professionals.service';
import { ProfessionalsRepository } from './professionals.repository';
import { ConfigRepository } from '../config/config.repository';
import { BotRepository } from '../bot/bot.repository';
import { WhatsAppAdapter } from '../../lib/whatsapp-adapter';
import { R2Client } from '../../lib/r2-client';

const professionalsRepository = new ProfessionalsRepository();
const configRepository = new ConfigRepository();
const botRepository = new BotRepository();
const r2Client = new R2Client();
const whatsappAdapter = new WhatsAppAdapter(r2Client, botRepository);
const professionalsService = new ProfessionalsService(
  professionalsRepository,
  whatsappAdapter,
  configRepository,
  botRepository,
);

export class ProfessionalsController {
  async register(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const body = req.body as { phone: string; name: string; categoryId: string };

      if (!body.phone) {
        res.status(400).json({ error: 'Phone is required', statusCode: 400 });
        return;
      }

      if (!body.name) {
        res.status(400).json({ error: 'Name is required', statusCode: 400 });
        return;
      }

      if (!body.categoryId) {
        res.status(400).json({ error: 'Category is required', statusCode: 400 });
        return;
      }

      const result = await professionalsService.register(
        body.phone,
        body.name,
        body.categoryId,
      );

      res.status(201).json({
        data: {
          professional: result.professional,
          verificationUrl: result.verificationUrl,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async getVerificationToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      if (!token) {
        res.status(400).json({ error: 'Verification token is required', statusCode: 400 });
        return;
      }

      const status = await professionalsService.getVerificationTokenStatus(token);
      res.status(200).json({ data: status });
    } catch (err) {
      next(err);
    }
  }

  async verify(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      if (!token) {
        res.status(400).json({ error: 'Verification token is required', statusCode: 400 });
        return;
      }

      const body = req.body as VerificationStageTwoInput;

      const professional = await professionalsService.submitVerification(token, body);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, categoryId } = req.query as {
        page?: string;
        limit?: string;
        status?: string;
        categoryId?: string;
      };

      const result = await professionalsService.list(
        page ? parseInt(page, 10) : undefined,
        limit ? parseInt(limit, 10) : undefined,
        status,
        categoryId,
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
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const result = await professionalsService.getByIdWithReputation(id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const professional = await professionalsService.approve(id);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const body = req.body as { reason?: string };
      const professional = await professionalsService.reject(id, body.reason);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async suspend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const professional = await professionalsService.suspend(id);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async reactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const professional = await professionalsService.reactivate(id);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async setBadge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const body = req.body as { hasBadge: boolean };

      if (body.hasBadge === undefined || typeof body.hasBadge !== 'boolean') {
        res.status(400).json({
          error: 'hasBadge field is required and must be a boolean',
          statusCode: 400,
        });
        return;
      }

      const professional = await professionalsService.setBadge(id, body.hasBadge);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async generateSession(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const result = await professionalsService.generateSessionToken(id);
      res.status(200).json({
        data: {
          professional: result.professional,
          sessionToken: result.sessionToken,
          panelUrl: result.panelUrl,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async getSessionByToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      if (!token) {
        res.status(400).json({ error: 'Session token is required', statusCode: 400 });
        return;
      }

      const professional = await professionalsService.getSessionByToken(token);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async getPanelData(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      if (!token) {
        res.status(400).json({ error: 'Session token is required', statusCode: 400 });
        return;
      }

      const data = await professionalsService.getPanelData(token);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async getPanelOrders(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };
      const { page, limit } = req.query as { page?: string; limit?: string };

      if (!token) {
        res.status(400).json({ error: 'Session token is required', statusCode: 400 });
        return;
      }

      const data = await professionalsService.getPanelOrders(
        token,
        page ? parseInt(page, 10) : undefined,
        limit ? parseInt(limit, 10) : undefined,
      );
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  async getPendingRequests(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      if (!token) {
        res.status(400).json({ error: 'Session token is required', statusCode: 400 });
        return;
      }

      const data = await professionalsService.getPendingRequests(token);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  async getActivityStats(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      if (!token) {
        res.status(400).json({ error: 'Session token is required', statusCode: 400 });
        return;
      }

      const days = parseInt(req.query.days as string) || 7;
      const validDays = [7, 30, 90].includes(days) ? days : 7;

      const data = await professionalsService.getActivityStats(token, validDays);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }
}

export const professionalsController = new ProfessionalsController();
