import { Request, Response, NextFunction } from 'express';
import { LocationsService } from './locations.service';
import { LocationsRepository } from './locations.repository';

const locationsRepository = new LocationsRepository();
const locationsService = new LocationsService(locationsRepository);

export class LocationsController {
  async listCountries(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const countries = await locationsService.listCountries();
      res.status(200).json({ data: countries });
    } catch (err) {
      next(err);
    }
  }

  async getTree(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { countryId } = req.params as { countryId: string };

      if (!countryId) {
        res.status(400).json({ error: 'countryId is required', statusCode: 400 });
        return;
      }

      const tree = await locationsService.getTree(countryId);
      res.status(200).json({ data: tree });
    } catch (err) {
      next(err);
    }
  }

  async getLeafNodes(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const nodes = await locationsService.getLeafNodes();
      res.status(200).json({ data: nodes });
    } catch (err) {
      next(err);
    }
  }

  async createCountry(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const body = req.body as {
        name: string;
        levels: Array<{ level: number; name: string }>;
      };

      if (!body.name || !body.levels) {
        res.status(400).json({
          error: 'name and levels are required',
          statusCode: 400,
        });
        return;
      }

      const country = await locationsService.createCountry(body);
      res.status(201).json({ data: country });
    } catch (err) {
      next(err);
    }
  }

  async createNode(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const body = req.body as {
        name: string;
        levelId: string;
        parentId: string;
      };

      if (!body.name || !body.levelId || !body.parentId) {
        res.status(400).json({
          error: 'name, levelId and parentId are required',
          statusCode: 400,
        });
        return;
      }

      const node = await locationsService.createNode(body);
      res.status(201).json({ data: node });
    } catch (err) {
      next(err);
    }
  }

  async toggleNode(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Node id is required', statusCode: 400 });
        return;
      }

      const result = await locationsService.toggleNode(id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const locationsController = new LocationsController();
