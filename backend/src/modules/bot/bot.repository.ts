import prisma from '../../lib/prisma';
import { BotSession, BotRole, Prisma } from '@prisma/client';

export type UpsertSessionInput = {
  phone: string;
  role: BotRole;
  currentFlow?: string | null;
  currentStep?: string | null;
  tempData?: Prisma.InputJsonValue;
};

export class BotRepository {
  async findByPhoneAndRole(phone: string, role: BotRole): Promise<BotSession | null> {
    return prisma.botSession.findUnique({
      where: { phone_role: { phone, role } },
    });
  }

  async upsert(phone: string, data: Omit<UpsertSessionInput, 'phone'>): Promise<BotSession> {
    const createData: Prisma.BotSessionCreateInput = {
      phone,
      role: data.role,
      currentFlow: data.currentFlow,
      currentStep: data.currentStep,
      tempData: data.tempData,
    };

    const updateData: Prisma.BotSessionUpdateInput = {
      role: data.role,
      currentFlow: data.currentFlow,
      currentStep: data.currentStep,
      tempData: data.tempData,
    };

    return prisma.botSession.upsert({
      where: { phone_role: { phone, role: data.role } },
      create: createData,
      update: updateData,
    });
  }

  async updateLastInboundAt(phone: string, role: BotRole, at: Date): Promise<void> {
    await prisma.botSession.update({
      where: { phone_role: { phone, role } },
      data: { lastInboundAt: at },
    });
  }

  async isWithin24hWindow(phone: string, role: BotRole): Promise<boolean> {
    const session = await prisma.botSession.findUnique({
      where: { phone_role: { phone, role } },
    });
    if (!session?.lastInboundAt) return false;
    return Date.now() - session.lastInboundAt.getTime() < 24 * 60 * 60 * 1000;
  }

  async setReminderSent(phone: string, role: BotRole, at: Date): Promise<void> {
    await prisma.botSession.update({
      where: { phone_role: { phone, role } },
      data: { reminderSentAt: at },
    });
  }

  async clearReminderSent(phone: string, role: BotRole): Promise<void> {
    await prisma.botSession.update({
      where: { phone_role: { phone, role } },
      data: { reminderSentAt: null },
    });
  }

  async wasTemplateSentInLast24h(phone: string, role: BotRole): Promise<boolean> {
    const session = await prisma.botSession.findUnique({
      where: { phone_role: { phone, role } },
    });
    if (!session?.lastTemplateSentAt) return false;
    return Date.now() - session.lastTemplateSentAt.getTime() < 24 * 60 * 60 * 1000;
  }

  async setLastTemplateSentAt(phone: string, role: BotRole, at: Date): Promise<void> {
    await prisma.botSession.update({
      where: { phone_role: { phone, role } },
      data: { lastTemplateSentAt: at },
    });
  }

  async deleteByPhone(phone: string): Promise<void> {
    await prisma.botSession.deleteMany({ where: { phone } });
  }
}
