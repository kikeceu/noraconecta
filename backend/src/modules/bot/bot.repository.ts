import prisma from '../../lib/prisma';
import { BotSession, BotRole, ProfessionalRequestSession, UserRequestSession, Prisma } from '@prisma/client';

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
    await prisma.botSession.upsert({
      where: { phone_role: { phone, role } },
      update: { lastInboundAt: at },
      create: { phone, role, lastInboundAt: at },
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
    await prisma.botSession.upsert({
      where: { phone_role: { phone, role } },
      update: { lastTemplateSentAt: at },
      create: { phone, role, lastTemplateSentAt: at },
    });
  }

  async deleteByPhone(phone: string): Promise<void> {
    await prisma.botSession.deleteMany({ where: { phone } });
  }

  async upsertRequestSession(
    phone: string,
    requestId: string,
    currentStep: string,
    tempData: Record<string, unknown>,
  ): Promise<void> {
    await prisma.professionalRequestSession.upsert({
      where: { requestId },
      create: { phone, requestId, currentStep, tempData: tempData as Prisma.InputJsonValue },
      update: { currentStep, tempData: tempData as Prisma.InputJsonValue },
    });
  }

  async findActiveRequestSessions(phone: string): Promise<ProfessionalRequestSession[]> {
    return prisma.professionalRequestSession.findMany({
      where: { phone },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findRequestSessionByRequestId(requestId: string): Promise<ProfessionalRequestSession | null> {
    return prisma.professionalRequestSession.findUnique({
      where: { requestId },
    });
  }

  async deleteRequestSession(requestId: string): Promise<void> {
    await prisma.professionalRequestSession.deleteMany({
      where: { requestId },
    });
  }

  async upsertUserRequestSession(
    phone: string,
    requestId: string,
    currentStep: string | null,
    tempData: Record<string, unknown>,
  ): Promise<void> {
    await prisma.userRequestSession.upsert({
      where: { requestId },
      create: { phone, requestId, currentStep, tempData: tempData as Prisma.InputJsonValue },
      update: { currentStep, tempData: tempData as Prisma.InputJsonValue },
    });
  }

  async findActiveUserRequestSessions(phone: string): Promise<UserRequestSession[]> {
    return prisma.userRequestSession.findMany({
      where: { phone },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findUserRequestSessionByRequestId(requestId: string): Promise<UserRequestSession | null> {
    return prisma.userRequestSession.findUnique({
      where: { requestId },
    });
  }

  async deleteUserRequestSession(requestId: string): Promise<void> {
    await prisma.userRequestSession.deleteMany({
      where: { requestId },
    });
  }
}
