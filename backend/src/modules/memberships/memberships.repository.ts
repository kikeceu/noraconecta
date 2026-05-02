import prisma from '../../lib/prisma';
import { Membership, Professional } from '@prisma/client';

export type CreateMembershipInput = {
  professionalId: string;
  planId: string;
  type: 'MONTHLY' | 'ANNUAL';
  startDate: Date;
  endDate: Date;
  activatedBy?: string;
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
      data,
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
}
