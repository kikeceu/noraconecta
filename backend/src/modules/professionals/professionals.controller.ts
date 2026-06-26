import { Request, Response, NextFunction } from 'express';
import { ProfessionalsService, VerificationStageTwoInput } from './professionals.service';
import { ProfessionalsRepository } from './professionals.repository';
import { ConfigRepository } from '../config/config.repository';
import { BotRepository } from '../bot/bot.repository';
import { MembershipsService } from '../memberships/memberships.service';
import { MembershipsRepository } from '../memberships/memberships.repository';
import { PlansRepository } from '../plans/plans.repository';
import { WhatsAppAdapter } from '../../lib/whatsapp-adapter';
import { R2Client } from '../../lib/r2-client';
import prisma from '../../lib/prisma';
import { LicenseStatus } from '@prisma/client';

const professionalsRepository = new ProfessionalsRepository();
const configRepository = new ConfigRepository();
const botRepository = new BotRepository();
const membershipsRepository = new MembershipsRepository();
const plansRepository = new PlansRepository();
const r2Client = new R2Client();
const whatsappAdapter = new WhatsAppAdapter(r2Client, botRepository);
const membershipsService = new MembershipsService(
  membershipsRepository,
  plansRepository,
  configRepository,
  botRepository,
  whatsappAdapter,
);
const professionalsService = new ProfessionalsService(
  professionalsRepository,
  whatsappAdapter,
  configRepository,
  botRepository,
  membershipsService,
);

export class ProfessionalsController {
  async register(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const body = req.body as { phone: string; name: string; categoryId: string };

      if (!body.phone) {
        res.status(400).json({ error: 'Phone is required', statusCode: 400 });
        return;
      }

      if (!body.name) {
        res.status(400).json({ error: 'Name is required', statusCode: 400 });
        return;
      }

      if (!body.categoryId) {
        res.status(400).json({ error: 'Category is required', statusCode: 400 });
        return;
      }

      const result = await professionalsService.register(
        body.phone,
        body.name,
        body.categoryId,
      );

      res.status(201).json({
        data: {
          professional: result.professional,
          verificationUrl: result.verificationUrl,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async getVerificationToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      if (!token) {
        res.status(400).json({ error: 'Verification token is required', statusCode: 400 });
        return;
      }

      const status = await professionalsService.getVerificationTokenStatus(token);
      res.status(200).json({ data: status });
    } catch (err) {
      next(err);
    }
  }

  async verify(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      if (!token) {
        res.status(400).json({ error: 'Verification token is required', statusCode: 400 });
        return;
      }

      const mode = req.query.mode as string | undefined;

      if (mode === 'license') {
        const { licenseUrl } = req.body as { licenseUrl: string };

        if (!licenseUrl) {
          res.status(400).json({ error: 'licenseUrl is required', statusCode: 400 });
          return;
        }

        await professionalsService.submitLicenseResubmission(token, licenseUrl);
        res.status(200).json({ data: { status: 'license_resubmitted' } });
        return;
      }

      const body = req.body as VerificationStageTwoInput;

      const professional = await professionalsService.submitVerification(token, body);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, status, categoryId, departmentId } = req.query as {
        page?: string;
        limit?: string;
        status?: string;
        categoryId?: string;
        departmentId?: string;
      };

      const result = await professionalsService.list(
        page ? parseInt(page, 10) : undefined,
        limit ? parseInt(limit, 10) : undefined,
        status,
        categoryId,
        departmentId,
      );

      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const result = await professionalsService.getByIdWithReputation(id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const professional = await professionalsService.approve(id);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const body = req.body as { reason?: string };
      const professional = await professionalsService.reject(id, body.reason);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async suspend(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const professional = await professionalsService.suspend(id);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async reactivate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const professional = await professionalsService.reactivate(id);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async setBadge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const body = req.body as { hasBadge: boolean };

      if (body.hasBadge === undefined || typeof body.hasBadge !== 'boolean') {
        res.status(400).json({
          error: 'hasBadge field is required and must be a boolean',
          statusCode: 400,
        });
        return;
      }

      const professional = await professionalsService.setBadge(id, body.hasBadge);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async generateSession(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const result = await professionalsService.generateSessionToken(id);
      res.status(200).json({
        data: {
          professional: result.professional,
          sessionToken: result.sessionToken,
          panelUrl: result.panelUrl,
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async getSessionByToken(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      if (!token) {
        res.status(400).json({ error: 'Session token is required', statusCode: 400 });
        return;
      }

      const professional = await professionalsService.getSessionByToken(token);
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async getPanelData(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      if (!token) {
        res.status(400).json({ error: 'Session token is required', statusCode: 400 });
        return;
      }

      const data = await professionalsService.getPanelData(token);
      res.status(200).json({ data });
    } catch (err) {
      next(err);
    }
  }

  async getPanelOrders(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };
      const { page, limit } = req.query as { page?: string; limit?: string };

      if (!token) {
        res.status(400).json({ error: 'Session token is required', statusCode: 400 });
        return;
      }

      const data = await professionalsService.getPanelOrders(
        token,
        page ? parseInt(page, 10) : undefined,
        limit ? parseInt(limit, 10) : undefined,
      );
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  async getPendingRequests(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      if (!token) {
        res.status(400).json({ error: 'Session token is required', statusCode: 400 });
        return;
      }

      const data = await professionalsService.getPendingRequests(token);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  async getActivityStats(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      if (!token) {
        res.status(400).json({ error: 'Session token is required', statusCode: 400 });
        return;
      }

      const days = parseInt(req.query.days as string) || 7;
      const validDays = [7, 30, 90].includes(days) ? days : 7;

      const data = await professionalsService.getActivityStats(token, validDays);
      res.status(200).json(data);
    } catch (err) {
      next(err);
    }
  }

  async getEarnings(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { sessionToken } = req.params as { sessionToken: string };
      const { days } = req.query as { days?: string };
      const parsedDays = days ? parseInt(days, 10) : 30;
      const result = await professionalsService.getEarnings(sessionToken, parsedDays);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async getMembershipDiscount(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { sessionToken } = req.params as { sessionToken: string };
      const result =
        await professionalsService.getMembershipDiscount(sessionToken);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }

  async listDepartments(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const departments = await prisma.geoNode.findMany({
        where: {
          level: { level: 2 },
          isActive: true,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      res.status(200).json({ data: departments });
    } catch (err) {
      next(err);
    }
  }

  async updateLicenseStatus(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as { status: string };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      if (!body.status || !['APPROVED', 'REJECTED'].includes(body.status)) {
        res.status(400).json({
          error: 'Status is required and must be APPROVED or REJECTED',
          statusCode: 400,
        });
        return;
      }

      const professional = await professionalsService.updateLicenseStatus(
        id,
        body.status as 'APPROVED' | 'REJECTED',
      );
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async adminCreate(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const body = req.body as {
        phone: string;
        name: string;
        categoryId: string;
        zoneIds: string[];
        availability?: string;
        availabilityStructured?: { slots: { day: number; from: string; to: string }[] };
      };

      if (!body.phone) {
        res.status(400).json({ error: 'Phone is required', statusCode: 400 });
        return;
      }

      if (!body.name) {
        res.status(400).json({ error: 'Name is required', statusCode: 400 });
        return;
      }

      if (!body.categoryId) {
        res.status(400).json({ error: 'Category is required', statusCode: 400 });
        return;
      }

      if (!body.zoneIds?.length) {
        res.status(400).json({ error: 'At least one zone is required', statusCode: 400 });
        return;
      }

      const professional = await professionalsService.adminCreate(body);
      res.status(201).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async adminUpdate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const body = req.body as {
        name?: string;
        categoryId?: string;
        zoneIds?: string[];
        availability?: string;
        availabilityStructured?: unknown;
        dniNumber?: string;
        cuil?: string;
        dniFrontUrl?: string;
        dniBackUrl?: string;
        criminalRecordUrl?: string;
        licenseUrl?: string;
        licenseStatus?: string;
        declaredHasLicense?: boolean;
        references?: string;
        presentationVideoUrl?: string;
      };

      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }

      const professional = await professionalsService.adminUpdate(id, {
        ...body,
        licenseStatus: body.licenseStatus as LicenseStatus | undefined,
      });
      res.status(200).json({ data: professional });
    } catch (err) {
      next(err);
    }
  }

  async getSessionDepartments(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };

      const professional = await professionalsService.getSessionByToken(token);
      if (!professional) {
        res.status(401).json({ error: 'Invalid session token', statusCode: 401 });
        return;
      }

      const departments = await prisma.geoNode.findMany({
        where: {
          level: { level: 2 },
          isActive: true,
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
      res.status(200).json({ data: departments });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { token } = req.params as { token: string };
      const body = req.body as {
        name?: string;
        zoneIds?: string[];
        availability?: string;
        availabilityStructured?: unknown;
        dniNumber?: string;
        cuil?: string;
        dniFrontUrl?: string;
        dniBackUrl?: string;
        criminalRecordUrl?: string;
        licenseUrl?: string;
        declaredHasLicense?: boolean;
        references?: string;
        presentationVideoUrl?: string;
      };

      const professional = await professionalsService.getSessionByToken(token);
      if (!professional) {
        res.status(401).json({ error: 'Invalid session token', statusCode: 401 });
        return;
      }

      const { zoneIds, availabilityStructured, ...rest } = body;

      const updated = await professionalsService.adminUpdate(professional.id, {
        ...rest,
        zoneIds,
        availabilityStructured,
        triggeredByProfessional: true,
      });

      res.status(200).json({ data: updated });
    } catch (err) {
      next(err);
    }
  }

  async cancelMembership(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      if (!id) {
        res.status(400).json({ error: 'Professional id is required', statusCode: 400 });
        return;
      }
      await membershipsService.cancelMembership(id);
      res.status(200).json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }

  async getCurrentPlan(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const membership = await professionalsService.getCurrentPlan(id);
      res.status(200).json({ data: membership });
    } catch (err) {
      next(err);
    }
  }

  async getPendingDataChanges(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const requests = await professionalsRepository.findPendingDataChangeRequests();
      res.status(200).json({ data: requests });
    } catch (err) {
      next(err);
    }
  }

  async countPendingDataChanges(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const count = await professionalsRepository.countPendingDataChangeRequests();
      res.status(200).json({ data: { count } });
    } catch (err) {
      next(err);
    }
  }

  async markDataChangeReviewed(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { requestId } = req.params as { requestId: string };

      if (!requestId) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      await professionalsRepository.markDataChangeRequestReviewed(requestId, 'admin');
      res.status(200).json({ data: { ok: true } });
    } catch (err) {
      next(err);
    }
  }
}

export const professionalsController = new ProfessionalsController();
