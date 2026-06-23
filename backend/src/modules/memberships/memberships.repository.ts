import prisma from '../../lib/prisma';
import { Membership, Professional } from '@prisma/client';

export type CreateMembershipInput = {
  professionalId: string;
  planId: string;
  type: 'MONTHLY' | 'ANNUAL';
  status?: 'ACTIVE' | 'INACTIVE' | 'EXPIRED';
  startDate: Date;
  endDate: Date;
  activatedBy?: string;
  paymentRef?: string;
};

export class MembershipsRepository {
  async findActiveByProfessionalId(
    professionalId: string,
  ): Promise<Membership | null> {
    return prisma.membership.findFirst({
      where: { professionalId, status: 'ACTIVE' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAllByProfessionalId(
    professionalId: string,
  ): Promise<Membership[]> {
    return prisma.membership.findMany({
      where: { professionalId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findProfessionalById(
    professionalId: string,
  ): Promise<Pick<Professional, 'id' | 'name' | 'trialRequestsUsed'> | null> {
    return prisma.professional.findUnique({
      where: { id: professionalId },
      select: {
        id: true,
        name: true,
        trialRequestsUsed: true,
      },
    });
  }

  async create(data: CreateMembershipInput): Promise<Membership> {
    return prisma.membership.create({
      data: {
        professionalId: data.professionalId,
        planId: data.planId,
        type: data.type,
        status: data.status ?? 'ACTIVE',
        startDate: data.startDate,
        endDate: data.endDate,
        activatedBy: data.activatedBy,
        paymentRef: data.paymentRef,
      },
      include: { plan: true },
    });
  }

  async updateStatus(
    id: string,
    status: 'ACTIVE' | 'INACTIVE' | 'EXPIRED',
  ): Promise<Membership> {
    return prisma.membership.update({
      where: { id },
      data: { status },
      include: { plan: true },
    });
  }

  async updatePaymentRef(
    id: string,
    paymentRef: string,
  ): Promise<Membership> {
    return prisma.membership.update({
      where: { id },
      data: { paymentRef },
      include: { plan: true },
    });
  }

  async findExpiringMemberships(daysAhead: number): Promise<
    (Membership & {
      professional: { id: string; name: string; phone: string };
      plan: { name: string };
    })[]
  > {
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysAhead);

    return prisma.membership.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: now,
          lte: threshold,
        },
        renewalReminderSentAt: null,
      },
      include: {
        professional: {
          select: { id: true, name: true, phone: true },
        },
        plan: {
          select: { name: true },
        },
      },
    });
  }

  async markReminderSent(membershipId: string): Promise<void> {
    await prisma.membership.update({
      where: { id: membershipId },
      data: { renewalReminderSentAt: new Date() },
    });
  }

  async clearExpiredReminderFlags(): Promise<void> {
    await prisma.membership.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: { lt: new Date() },
        renewalReminderSentAt: { not: null },
      },
      data: { renewalReminderSentAt: null },
    });
  }
}
