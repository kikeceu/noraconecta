import { Request, Response, NextFunction } from 'express';
import { EscalationsService } from './escalations.service';
import { EscalationsRepository } from './escalations.repository';
import { EscalationStatus } from '@prisma/client';

const escalationsRepository = new EscalationsRepository();
const escalationsService = new EscalationsService(escalationsRepository);

const VALID_STATUSES: EscalationStatus[] = ['OPEN', 'IN_REVIEW', 'RESOLVED'];

export class EscalationsController {
  async list(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit
        ? parseInt(req.query.limit as string, 10)
        : 20;
      const status = req.query.status as string | undefined;
      const professionalId = req.query.professionalId as string | undefined;

      if (status && !(VALID_STATUSES as readonly string[]).includes(status)) {
        res.status(400).json({
          error: 'Invalid status filter. Must be one of: OPEN, IN_REVIEW, RESOLVED',
          statusCode: 400,
        });
        return;
      }

      const result = await escalationsService.list(
        page,
        limit,
        status as EscalationStatus | undefined,
        professionalId,
      );

      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getById(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res
          .status(400)
          .json({ error: 'Escalation id is required', statusCode: 400 });
        return;
      }

      const escalation = await escalationsService.getById(id);
      res.status(200).json({ data: escalation });
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as { status: EscalationStatus };

      if (!id) {
        res
          .status(400)
          .json({ error: 'Escalation id is required', statusCode: 400 });
        return;
      }

      if (!body.status || !(VALID_STATUSES as readonly string[]).includes(body.status)) {
        res.status(400).json({
          error: 'Status is required and must be one of: OPEN, IN_REVIEW, RESOLVED',
          statusCode: 400,
        });
        return;
      }

      const escalation = await escalationsService.updateStatus(id, body.status);
      res.status(200).json({ data: escalation });
    } catch (err) {
      next(err);
    }
  }

  async resolve(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as { resolution: string };

      if (!id) {
        res
          .status(400)
          .json({ error: 'Escalation id is required', statusCode: 400 });
        return;
      }

      if (!body.resolution || !body.resolution.trim()) {
        res.status(400).json({
          error: 'Resolution text is required',
          statusCode: 400,
        });
        return;
      }

      const resolvedBy = req.admin?.adminId;

      const escalation = await escalationsService.resolve(
        id,
        body.resolution,
        resolvedBy,
      );

      res.status(200).json({ data: escalation });
    } catch (err) {
      next(err);
    }
  }
}

export const escalationsController = new EscalationsController();
