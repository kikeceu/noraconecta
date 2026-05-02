import { Request, Response, NextFunction } from 'express';
import { ConfigService } from './config.service';
import { ConfigRepository } from './config.repository';

const configRepository = new ConfigRepository();
const configService = new ConfigService(configRepository);

export class ConfigController {
  async getConfig(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const configs = await configService.getAll();
      res.status(200).json({ data: configs });
    } catch (err) {
      next(err);
    }
  }

  async updateConfig(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { key } = req.params as { key: string };
      const body = req.body as { value: string };

      if (!key) {
        res
          .status(400)
          .json({ error: 'Configuration key is required', statusCode: 400 });
        return;
      }

      if (body.value === undefined || body.value === null) {
        res.status(400).json({
          error: 'Configuration value is required',
          statusCode: 400,
        });
        return;
      }

      const config = await configService.update(key, body.value);
      res.status(200).json({ data: config });
    } catch (err) {
      next(err);
    }
  }
}

export const configController = new ConfigController();
