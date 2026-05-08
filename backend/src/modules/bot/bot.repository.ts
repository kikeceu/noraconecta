import prisma from '../../lib/prisma';
import { BotSession, Prisma } from '@prisma/client';

export type UpsertSessionInput = {
  phone: string;
  role?: 'USER' | 'PROFESSIONAL';
  currentFlow?: string | null;
  currentStep?: string | null;
  tempData?: Prisma.InputJsonValue;
};

export class BotRepository {
  async findByPhone(phone: string): Promise<BotSession | null> {
    return prisma.botSession.findUnique({ where: { phone } });
  }

  async upsert(phone: string, data: Omit<UpsertSessionInput, 'phone'>): Promise<BotSession> {
    const createData: Prisma.BotSessionCreateInput = {
      phone,
      role: data.role as Prisma.BotSessionCreateInput['role'],
      currentFlow: data.currentFlow,
      currentStep: data.currentStep,
      tempData: data.tempData,
    };

    const updateData: Prisma.BotSessionUpdateInput = {
      role: data.role as Prisma.BotSessionUpdateInput['role'],
      currentFlow: data.currentFlow,
      currentStep: data.currentStep,
      tempData: data.tempData,
    };

    return prisma.botSession.upsert({
      where: { phone },
      create: createData,
      update: updateData,
    });
  }

  async updateLastInboundAt(phone: string, at: Date): Promise<void> {
    await prisma.botSession.update({
      where: { phone },
      data: { lastInboundAt: at },
    });
  }

  async isWithin24hWindow(phone: string): Promise<boolean> {
    const session = await prisma.botSession.findUnique({ where: { phone } });
    if (!session?.lastInboundAt) return false;
    return Date.now() - session.lastInboundAt.getTime() < 24 * 60 * 60 * 1000;
  }

  async deleteByPhone(phone: string): Promise<void> {
    await prisma.botSession.deleteMany({ where: { phone } });
  }
}
