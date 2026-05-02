import { Router } from 'express';
import { membershipsController } from './memberships.controller';
import { requireAuth } from '../../middleware/require-auth';
import { requireSuperAdmin } from '../../middleware/require-super-admin';

const router = Router();

router.get('/:id/membership', requireAuth, (req, res, next) => {
  void membershipsController.getStatus(req, res, next);
});

router.post('/:id/membership', requireSuperAdmin, (req, res, next) => {
  void membershipsController.activate(req, res, next);
});

export default router;
