import { Request, Response, NextFunction } from 'express';
import { BotService } from './bot.service';
import { BotRepository } from './bot.repository';
import { UsersService } from '../users/users.service';
import { UsersRepository } from '../users/users.repository';

const botRepository = new BotRepository();
const usersRepository = new UsersRepository();
const usersService = new UsersService(usersRepository);
const botService = new BotService(botRepository, usersService);

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
