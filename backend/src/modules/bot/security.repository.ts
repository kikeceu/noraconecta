import prisma from '../../lib/prisma';
import { BotSecurity } from '@prisma/client';

export class SecurityRepository {
  async findByPhone(phone: string): Promise<BotSecurity | null> {
    return prisma.botSecurity.findUnique({ where: { phone } });
  }

  async upsertMessageCount(phone: string, windowStart: Date, count: number): Promise<void> {
    await prisma.botSecurity.upsert({
      where: { phone },
      create: { phone, messageCount: count, windowStart },
      update: { messageCount: count, windowStart },
    });
  }

  async incrementSuspiciousCount(phone: string): Promise<void> {
    await prisma.botSecurity.upsert({
      where: { phone },
      create: { phone, suspiciousCount: 1 },
      update: { suspiciousCount: { increment: 1 } },
    });
  }

  async blockUntil(phone: string, until: Date): Promise<void> {
    await prisma.botSecurity.upsert({
      where: { phone },
      create: { phone, blockedUntil: until },
      update: { blockedUntil: until },
    });
  }

  async clearBlock(phone: string): Promise<void> {
    await prisma.botSecurity.update({
      where: { phone },
      data: { blockedUntil: null, suspiciousCount: 0 },
    });
  }
}
