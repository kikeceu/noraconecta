import { Request, Response, NextFunction } from 'express';
import { MembershipsService } from './memberships.service';
import { MembershipsRepository } from './memberships.repository';
import { PlansRepository } from '../plans/plans.repository';
import { ConfigRepository } from '../config/config.repository';

const membershipsRepository = new MembershipsRepository();
const plansRepository = new PlansRepository();
const configRepository = new ConfigRepository();
const membershipsService = new MembershipsService(
  membershipsRepository,
  plansRepository,
  configRepository,
);

const VALID_TYPES = ['MONTHLY', 'ANNUAL'] as const;

export class MembershipsController {
  async activate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id: professionalId } = req.params as { id: string };
      const body = req.body as {
        planId: string;
        type: 'MONTHLY' | 'ANNUAL';
      };

      if (!professionalId) {
        res
          .status(400)
          .json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      if (!body.planId) {
        res
          .status(400)
          .json({ error: 'Plan id is required', statusCode: 400 });
        return;
      }

      if (!body.type || !(VALID_TYPES as readonly string[]).includes(body.type)) {
        res.status(400).json({
          error: 'Membership type is required and must be MONTHLY or ANNUAL',
          statusCode: 400,
        });
        return;
      }

      const activatedBy = req.admin?.adminId;

      const membership = await membershipsService.activateMembership(
        professionalId,
        body.planId,
        body.type,
        activatedBy,
      );

      res.status(201).json({ data: membership });
    } catch (err) {
      next(err);
    }
  }

  async getStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id: professionalId } = req.params as { id: string };

      if (!professionalId) {
        res
          .status(400)
          .json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const status = await membershipsService.getStatus(professionalId);
      res.status(200).json({ data: status });
    } catch (err) {
      next(err);
    }
  }
}

export const membershipsController = new MembershipsController();
