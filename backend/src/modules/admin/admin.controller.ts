import { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { ConfigRepository } from '../config/config.repository';
import { RequestsService } from '../requests/requests.service';
import { RequestsRepository } from '../requests/requests.repository';
import { MatchingRepository } from '../matching/matching.repository';
import { UsersRepository } from '../users/users.repository';
import { BotRepository } from '../bot/bot.repository';
import { promptRepository } from '../prompts/prompt.repository';
import { promptService } from '../prompts/prompt.service';
import { LLMRepository } from '../llm/llm.repository';
import { LLMService } from '../llm/llm.service';
import { WhatsAppRepository } from '../whatsapp/whatsapp.repository';
import { WhatsAppUsageService } from '../whatsapp/whatsapp.service';

const adminRepository = new AdminRepository();
const configRepository = new ConfigRepository();
const llmRepository = new LLMRepository();
const llmService = new LLMService(llmRepository);
const whatsAppRepository = new WhatsAppRepository();
const whatsAppUsageService = new WhatsAppUsageService(whatsAppRepository);
const adminService = new AdminService(adminRepository, configRepository, llmService, whatsAppUsageService);

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

  async getDemandInsights(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { geoNodeId } = req.query as { geoNodeId?: string };
      const data = await adminService.getDemandInsights(geoNodeId || undefined);
      res.status(200).json({ data });
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

  async listPrompts(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const prompts = await promptRepository.findAll();
      res.status(200).json({ data: prompts });
    } catch (err) {
      next(err);
    }
  }

  async updatePrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params as { key: string };
      const { content } = req.body as { content: string };
      const record = await promptRepository.findByKey(key);
      if (!record) {
        res.status(404).json({ error: 'Prompt not found' });
        return;
      }
      if (!record.isEditable) {
        res.status(403).json({ error: 'This prompt is not editable' });
        return;
      }
      await promptRepository.update(key, content);
      promptService.invalidate(key);
      res.status(200).json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }

  async resetPrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params as { key: string };
      await promptRepository.resetToDefault(key);
      promptService.invalidate(key);
      res.status(200).json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }

  invalidatePromptCache(req: Request, res: Response, next: NextFunction): void {
    try {
      const { key } = req.params as { key: string };
      promptService.invalidate(key);
      res.status(200).json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }

  async getLLMCosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const costs = await adminService.getLLMCosts(
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined,
      );
      res.status(200).json({ data: costs });
    } catch (err) {
      next(err);
    }
  }

  async getWhatsAppCosts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { from, to } = req.query as { from?: string; to?: string };
      const costs = await adminService.getWhatsAppCosts(
        from ? new Date(from) : undefined,
        to ? new Date(to) : undefined,
      );
      res.status(200).json({ data: costs });
    } catch (err) {
      next(err);
    }
  }

  async getWhatsAppTemplates(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates = await adminService.getWhatsAppTemplates();
      res.status(200).json({ data: templates });
    } catch (err) {
      next(err);
    }
  }

  async updateWhatsAppTemplate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.params as { name: string };
      const { category, costUsd } = req.body as { category?: string; costUsd?: number };
      await adminService.updateWhatsAppTemplate(name, { category, costUsd });
      res.status(200).json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
