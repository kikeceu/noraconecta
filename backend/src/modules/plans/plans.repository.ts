import prisma from '../../lib/prisma';
import { Plan } from '@prisma/client';

export type CreatePlanInput = {
  name: string;
  monthlyPrice: number;
  annualDiscountPct?: number;
  features?: string[];
};

export type UpdatePlanInput = {
  name?: string;
  monthlyPrice?: number;
  annualDiscountPct?: number;
  isActive?: boolean;
  features?: string[];
};

export class PlansRepository {
  async findAll(): Promise<Plan[]> {
    return prisma.plan.findMany({ orderBy: { createdAt: 'asc' } });
  }

  async findById(id: string): Promise<Plan | null> {
    return prisma.plan.findUnique({ where: { id } });
  }

  async findByName(name: string): Promise<Plan | null> {
    return prisma.plan.findUnique({ where: { name } });
  }

  async create(data: CreatePlanInput): Promise<Plan> {
    return prisma.plan.create({
      data: {
        name: data.name,
        monthlyPrice: data.monthlyPrice,
        annualDiscountPct: data.annualDiscountPct ?? 0,
        features: data.features ?? [],
      },
    });
  }

  async update(id: string, data: UpdatePlanInput): Promise<Plan> {
    return prisma.plan.update({ where: { id }, data });
  }

  async deactivate(id: string): Promise<Plan> {
    return prisma.plan.update({ where: { id }, data: { isActive: false } });
  }
}
