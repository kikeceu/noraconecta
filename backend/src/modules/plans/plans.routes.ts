import { Router } from 'express';
import { plansController } from './plans.controller';
import { requireAuth } from '../../middleware/require-auth';
import { requireSuperAdmin } from '../../middleware/require-super-admin';

const router = Router();

router.get('/', requireAuth, (req, res, next) => {
  void plansController.list(req, res, next);
});

router.post('/', requireSuperAdmin, (req, res, next) => {
  void plansController.create(req, res, next);
});

router.patch('/:id', requireSuperAdmin, (req, res, next) => {
  void plansController.update(req, res, next);
});

export default router;
