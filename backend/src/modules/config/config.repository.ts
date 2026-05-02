import prisma from '../../lib/prisma';
import { SystemConfig } from '@prisma/client';

export class ConfigRepository {
  async findAll(): Promise<SystemConfig[]> {
    return prisma.systemConfig.findMany();
  }

  async findByKey(key: string): Promise<SystemConfig | null> {
    return prisma.systemConfig.findUnique({ where: { key } });
  }

  async upsert(key: string, value: string): Promise<SystemConfig> {
    return prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
