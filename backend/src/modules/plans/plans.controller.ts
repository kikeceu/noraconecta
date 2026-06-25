import { Request, Response, NextFunction } from 'express';
import { PlansService } from './plans.service';
import { PlansRepository } from './plans.repository';

const plansRepository = new PlansRepository();
const plansService = new PlansService(plansRepository);

export class PlansController {
  async list(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const plans = await plansService.getAll();
      res.status(200).json({ data: plans });
    } catch (err) {
      next(err);
    }
  }

  async create(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const body = req.body as {
        name: string;
        monthlyPrice: number;
        annualDiscountPct?: number;
        features?: string[];
      };

      if (!body.name) {
        res
          .status(400)
          .json({ error: 'Plan name is required', statusCode: 400 });
        return;
      }

      if (body.monthlyPrice === undefined || body.monthlyPrice === null) {
        res
          .status(400)
          .json({ error: 'Monthly price is required', statusCode: 400 });
        return;
      }

      const plan = await plansService.create(
        body.name,
        body.monthlyPrice,
        body.annualDiscountPct,
        body.features,
      );

      res.status(201).json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  async update(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as {
        name?: string;
        monthlyPrice?: number;
        annualDiscountPct?: number;
        isActive?: boolean;
        features?: string[];
      };

      if (!id) {
        res
          .status(400)
          .json({ error: 'Plan id is required', statusCode: 400 });
        return;
      }

      if (
        body.name === undefined &&
        body.monthlyPrice === undefined &&
        body.annualDiscountPct === undefined &&
        body.isActive === undefined &&
        body.features === undefined
      ) {
        res.status(400).json({
          error: 'At least one field is required',
          statusCode: 400,
        });
        return;
      }

      const plan = await plansService.update(id, {
        name: body.name,
        monthlyPrice: body.monthlyPrice,
        annualDiscountPct: body.annualDiscountPct,
        isActive: body.isActive,
        features: body.features,
      });

      res.status(200).json({ data: plan });
    } catch (err) {
      next(err);
    }
  }

  async deactivate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const plan = await plansService.deactivate(id);
      res.status(200).json({ data: plan });
    } catch (err) {
      next(err);
    }
  }
}

export const plansController = new PlansController();
