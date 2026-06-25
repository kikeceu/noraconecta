import { PlansRepository } from './plans.repository';
import { AppError } from '../../middleware/error-handler';
import { Plan } from '@prisma/client';

export class PlansService {
  constructor(private readonly plansRepository: PlansRepository) {}

  async getAll(): Promise<Plan[]> {
    return this.plansRepository.findAll();
  }

  async getById(id: string): Promise<Plan> {
    const plan = await this.plansRepository.findById(id);

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    return plan;
  }

  async create(
    name: string,
    monthlyPrice: number,
    annualDiscountPct?: number,
    features?: string[],
  ): Promise<Plan> {
    const trimmedName = name.trim();

    if (!trimmedName) {
      throw new AppError('Plan name is required', 400);
    }

    if (monthlyPrice < 0) {
      throw new AppError('Monthly price must be a non-negative number', 400);
    }

    if (
      annualDiscountPct !== undefined &&
      (annualDiscountPct < 0 || annualDiscountPct > 100)
    ) {
      throw new AppError(
        'Annual discount percentage must be between 0 and 100',
        400,
      );
    }

    const existing = await this.plansRepository.findByName(trimmedName);

    if (existing) {
      throw new AppError('A plan with this name already exists', 409);
    }

    return this.plansRepository.create({
      name: trimmedName,
      monthlyPrice,
      annualDiscountPct,
      features,
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      monthlyPrice?: number;
      annualDiscountPct?: number;
      isActive?: boolean;
      features?: string[];
    },
  ): Promise<Plan> {
    const plan = await this.plansRepository.findById(id);

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    const updates: {
      name?: string;
      monthlyPrice?: number;
      annualDiscountPct?: number;
      isActive?: boolean;
      features?: string[];
    } = {};

    if (data.name !== undefined) {
      const trimmedName = data.name.trim();
      if (!trimmedName) {
        throw new AppError('Plan name cannot be empty', 400);
      }
      if (trimmedName !== plan.name) {
        const existing = await this.plansRepository.findByName(trimmedName);
        if (existing) {
          throw new AppError('A plan with this name already exists', 409);
        }
      }
      updates.name = trimmedName;
    }

    if (data.monthlyPrice !== undefined) {
      if (data.monthlyPrice < 0) {
        throw new AppError('Monthly price must be a non-negative number', 400);
      }
      updates.monthlyPrice = data.monthlyPrice;
    }

    if (data.annualDiscountPct !== undefined) {
      if (data.annualDiscountPct < 0 || data.annualDiscountPct > 100) {
        throw new AppError(
          'Annual discount percentage must be between 0 and 100',
          400,
        );
      }
      updates.annualDiscountPct = data.annualDiscountPct;
    }

    if (data.isActive !== undefined) {
      updates.isActive = data.isActive;
    }

    if (data.features !== undefined) {
      updates.features = data.features;
    }

    return this.plansRepository.update(id, updates);
  }

  async deactivate(id: string): Promise<Plan> {
    const plan = await this.plansRepository.findById(id);

    if (!plan) {
      throw new AppError('Plan not found', 404);
    }

    return this.plansRepository.deactivate(id);
  }
}
