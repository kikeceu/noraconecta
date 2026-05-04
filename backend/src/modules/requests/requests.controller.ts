import { Request, Response, NextFunction } from 'express';
import { RequestsService } from './requests.service';
import { RequestsRepository } from './requests.repository';
import { UsersRepository } from '../users/users.repository';

const requestsRepository = new RequestsRepository();
const usersRepository = new UsersRepository();
const requestsService = new RequestsService(requestsRepository, usersRepository);

export class RequestsController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { phone, categoryId, geoNodeId, description, photoUrls, audioUrl } =
        req.body as {
          phone?: string;
          categoryId?: string;
          geoNodeId?: string;
          description?: string;
          photoUrls?: string[];
          audioUrl?: string;
        };

      if (!phone) {
        res.status(400).json({ error: 'Phone is required', statusCode: 400 });
        return;
      }

      if (!categoryId) {
        res.status(400).json({ error: 'Category is required', statusCode: 400 });
        return;
      }

      if (!geoNodeId) {
        res.status(400).json({ error: 'Geo node is required', statusCode: 400 });
        return;
      }

      if (!description) {
        res.status(400).json({ error: 'Description is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.create({
        phone,
        categoryId,
        geoNodeId,
        description,
        photoUrls,
        audioUrl,
      });

      res.status(201).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async accept(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.accept(id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.reject(id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.cancel(id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async markCompleted(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.markCompleted(id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async confirmCompletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { fulfilled } = req.body as { fulfilled?: boolean };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      if (fulfilled === undefined) {
        res.status(400).json({ error: 'Fulfilled is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.confirmCompletion(id, fulfilled);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async reportNoncompliance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.reportNoncompliance(id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }

  async submitFeedback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const { workCompleted, wouldRecommend, comment } = req.body as {
        workCompleted?: boolean;
        wouldRecommend?: boolean;
        comment?: string;
      };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      if (workCompleted === undefined) {
        res.status(400).json({ error: 'workCompleted is required', statusCode: 400 });
        return;
      }

      if (wouldRecommend === undefined) {
        res.status(400).json({ error: 'wouldRecommend is required', statusCode: 400 });
        return;
      }

      const feedback = await requestsService.submitFeedback(
        id,
        workCompleted,
        wouldRecommend,
        comment,
      );

      res.status(201).json({ data: feedback });
    } catch (err) {
      next(err);
    }
  }

  async rateProfessional(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const {
        rating,
        punctualityRating,
        qualityRating,
        communicationRating,
        priceFairnessRating,
        wouldRecommend,
        userComment,
      } = req.body as {
        rating?: number;
        punctualityRating?: number;
        qualityRating?: number;
        communicationRating?: number;
        priceFairnessRating?: number;
        wouldRecommend?: boolean;
        userComment?: string;
      };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      if (rating === undefined) {
        res.status(400).json({ error: 'rating is required', statusCode: 400 });
        return;
      }

      if (punctualityRating === undefined) {
        res.status(400).json({ error: 'punctualityRating is required', statusCode: 400 });
        return;
      }

      if (qualityRating === undefined) {
        res.status(400).json({ error: 'qualityRating is required', statusCode: 400 });
        return;
      }

      if (communicationRating === undefined) {
        res.status(400).json({ error: 'communicationRating is required', statusCode: 400 });
        return;
      }

      if (priceFairnessRating === undefined) {
        res.status(400).json({ error: 'priceFairnessRating is required', statusCode: 400 });
        return;
      }

      if (wouldRecommend === undefined) {
        res.status(400).json({ error: 'wouldRecommend is required', statusCode: 400 });
        return;
      }

      const feedback = await requestsService.rateProfessional(id, {
        rating,
        punctualityRating,
        qualityRating,
        communicationRating,
        priceFairnessRating,
        wouldRecommend,
        userComment,
      });

      res.status(201).json({ data: feedback });
    } catch (err) {
      next(err);
    }
  }

  async rateUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params as { id: string };
      const {
        requestClarityRating,
        userAvailabilityRating,
        userTreatmentRating,
        wouldServeAgain,
        professionalComment,
      } = req.body as {
        requestClarityRating?: number;
        userAvailabilityRating?: number;
        userTreatmentRating?: number;
        wouldServeAgain?: boolean;
        professionalComment?: string;
      };

      if (!id) {
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      if (requestClarityRating === undefined) {
        res.status(400).json({ error: 'requestClarityRating is required', statusCode: 400 });
        return;
      }

      if (userAvailabilityRating === undefined) {
        res.status(400).json({ error: 'userAvailabilityRating is required', statusCode: 400 });
        return;
      }

      if (userTreatmentRating === undefined) {
        res.status(400).json({ error: 'userTreatmentRating is required', statusCode: 400 });
        return;
      }

      if (wouldServeAgain === undefined) {
        res.status(400).json({ error: 'wouldServeAgain is required', statusCode: 400 });
        return;
      }

      const feedback = await requestsService.rateUser(id, {
        requestClarityRating,
        userAvailabilityRating,
        userTreatmentRating,
        wouldServeAgain,
        professionalComment,
      });

      res.status(201).json({ data: feedback });
    } catch (err) {
      next(err);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit } = req.query as { page?: string; limit?: string };

      const result = await requestsService.list(
        page ? parseInt(page, 10) : undefined,
        limit ? parseInt(limit, 10) : undefined,
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
        res.status(400).json({ error: 'Request id is required', statusCode: 400 });
        return;
      }

      const request = await requestsService.getById(id);
      res.status(200).json({ data: request });
    } catch (err) {
      next(err);
    }
  }
}

export const requestsController = new RequestsController();
