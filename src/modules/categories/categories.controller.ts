import { Request, Response, NextFunction } from 'express';
import { CategoriesService } from './categories.service';
import { CategoriesRepository } from './categories.repository';

const categoriesRepository = new CategoriesRepository();
const categoriesService = new CategoriesService(categoriesRepository);

export class CategoriesController {
  async list(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const categories = await categoriesService.getAll();
      res.status(200).json({ data: categories });
    } catch (err) {
      next(err);
    }
  }

  async listActive(
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const categories = await categoriesService.getActive();
      res.status(200).json({ data: categories });
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
        res.status(400).json({ error: 'Category id is required', statusCode: 400 });
        return;
      }

      const category = await categoriesService.getById(id);
      res.status(200).json({ data: category });
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
      const body = req.body as { name: string; description?: string };

      if (!body.name) {
        res.status(400).json({ error: 'Category name is required', statusCode: 400 });
        return;
      }

      const category = await categoriesService.create(body.name, body.description);
      res.status(201).json({ data: category });
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
      const body = req.body as { name?: string; description?: string };

      if (!id) {
        res.status(400).json({ error: 'Category id is required', statusCode: 400 });
        return;
      }

      if (body.name === undefined && body.description === undefined) {
        res.status(400).json({
          error: 'At least one field (name or description) is required',
          statusCode: 400,
        });
        return;
      }

      const category = await categoriesService.update(id, body.name, body.description);
      res.status(200).json({ data: category });
    } catch (err) {
      next(err);
    }
  }

  async toggle(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } = req.params as { id: string };

      if (!id) {
        res.status(400).json({ error: 'Category id is required', statusCode: 400 });
        return;
      }

      const result = await categoriesService.toggle(id);
      res.status(200).json({ data: result });
    } catch (err) {
      next(err);
    }
  }
}

export const categoriesController = new CategoriesController();
