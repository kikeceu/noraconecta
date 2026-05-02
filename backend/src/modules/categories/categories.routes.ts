import { Router } from 'express';
import { categoriesController } from './categories.controller';
import { requireAuth } from '../../middleware/require-auth';
import { requireSuperAdmin } from '../../middleware/require-super-admin';

const router = Router();

router.get('/', requireAuth, (req, res, next) => {
  void categoriesController.list(req, res, next);
});

router.get('/active', requireAuth, (req, res, next) => {
  void categoriesController.listActive(req, res, next);
});

router.get('/:id', requireAuth, (req, res, next) => {
  void categoriesController.getById(req, res, next);
});

router.post('/', requireSuperAdmin, (req, res, next) => {
  void categoriesController.create(req, res, next);
});

router.patch('/:id', requireSuperAdmin, (req, res, next) => {
  void categoriesController.update(req, res, next);
});

router.patch('/:id/toggle', requireSuperAdmin, (req, res, next) => {
  void categoriesController.toggle(req, res, next);
});

export default router;
