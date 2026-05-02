import { ConfigRepository } from './config.repository';
import { AppError } from '../../middleware/error-handler';
import { SystemConfig } from '@prisma/client';

export class ConfigService {
  constructor(private readonly configRepository: ConfigRepository) {}

  async getAll(): Promise<SystemConfig[]> {
    return this.configRepository.findAll();
  }

  async getByKey(key: string): Promise<SystemConfig> {
    const config = await this.configRepository.findByKey(key);

    if (!config) {
      throw new AppError(`Configuration key '${key}' not found`, 404);
    }

    return config;
  }

  async update(key: string, value: string): Promise<SystemConfig> {
    const trimmedKey = key.trim();

    if (!trimmedKey) {
      throw new AppError('Configuration key is required', 400);
    }

    if (value === undefined || value === null) {
      throw new AppError('Configuration value is required', 400);
    }

    return this.configRepository.upsert(trimmedKey, value);
  }
}
