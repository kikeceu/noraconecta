import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { BotService } from './bot.service';
import { BotRepository } from './bot.repository';
import { UsersService } from '../users/users.service';
import { UsersRepository } from '../users/users.repository';
import { RequestsRepository } from '../requests/requests.repository';
import { ProfessionalsRepository } from '../professionals/professionals.repository';
import { WhatsAppAdapter } from '../../lib/whatsapp-adapter';
import { R2Client } from '../../lib/r2-client';

const botRepository = new BotRepository();
const usersRepository = new UsersRepository();
const usersService = new UsersService(usersRepository);
const requestsRepository = new RequestsRepository();
const professionalsRepository = new ProfessionalsRepository();
const botService = new BotService(botRepository, usersService, requestsRepository, professionalsRepository);

export class BotController {
  async message(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, text, imageUrls, audioUrl, location, role } = req.body as {
        phone: string;
        text?: string;
        imageUrls?: string[];
        audioUrl?: string;
        location?: { latitude: number; longitude: number };
        role?: 'USER' | 'PROFESSIONAL';
      };

      if (!phone) {
        res.status(400).json({ error: 'Phone is required', statusCode: 400 });
        return;
      }

      const result = await botService.processMessage({
        phone,
        text,
        imageUrls,
        audioUrl,
        location,
        role,
      });

      if (result.pendingNotification) {
        const { targetPhone, targetRole, message } = result.pendingNotification;
        const r2Client = new R2Client();
        const adapter = new WhatsAppAdapter(r2Client, botRepository);

        try {
          await adapter.sendText(targetPhone, message, targetRole);

          const targetSession = await botRepository.findByPhoneAndRole(targetPhone, targetRole);
          if (targetSession) {
            const targetTempData = (targetSession.tempData as Record<string, unknown>) || {};
            const { pendingMessage: _, ...cleanTempData } = targetTempData;

            await botRepository.upsert(targetPhone, {
              role: targetRole,
              currentFlow: targetSession.currentFlow,
              currentStep: targetSession.currentStep,
              tempData: cleanTempData as Prisma.InputJsonValue,
            });
          }
        } catch (err) {
          console.error('[BotController] Failed to send pending notification:', err);
        }
      }

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async resetSession(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone } = req.body as { phone: string };

      if (!phone) {
        res.status(400).json({ error: 'Phone is required', statusCode: 400 });
        return;
      }

      await botService.resetSession(phone);
      res.status(200).json({ message: 'Session reset' });
    } catch (err) {
      next(err);
    }
  }
}

export const botController = new BotController();
