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
        monthlyPrice?: number;
        annualDiscountPct?: number;
      };

      if (!id) {
        res
          .status(400)
          .json({ error: 'Plan id is required', statusCode: 400 });
        return;
      }

      if (
        body.monthlyPrice === undefined &&
        body.annualDiscountPct === undefined
      ) {
        res.status(400).json({
          error:
            'At least one field (monthlyPrice or annualDiscountPct) is required',
          statusCode: 400,
        });
        return;
      }

      const plan = await plansService.update(id, {
        monthlyPrice: body.monthlyPrice,
        annualDiscountPct: body.annualDiscountPct,
      });

      res.status(200).json({ data: plan });
    } catch (err) {
      next(err);
    }
  }
}

export const plansController = new PlansController();
