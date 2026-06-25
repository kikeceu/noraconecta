import { Router } from 'express';
import { plansController } from './plans.controller';
import { requireSuperAdmin } from '../../middleware/require-super-admin';

const router = Router();

router.get('/', (req, res, next) => {
  void plansController.list(req, res, next);
});

router.post('/', requireSuperAdmin, (req, res, next) => {
  void plansController.create(req, res, next);
});

router.patch('/:id', requireSuperAdmin, (req, res, next) => {
  void plansController.update(req, res, next);
});

router.delete('/:id', requireSuperAdmin, (req, res, next) => {
  void plansController.deactivate(req, res, next);
});

export default router;
