import { Router } from 'express';
import { escalationsController } from './escalations.controller';
import { requireAuth } from '../../middleware/require-auth';

const router = Router();

router.get('/', requireAuth, (req, res, next) => {
  void escalationsController.list(req, res, next);
});

router.get('/:id', requireAuth, (req, res, next) => {
  void escalationsController.getById(req, res, next);
});

router.patch('/:id/status', requireAuth, (req, res, next) => {
  void escalationsController.updateStatus(req, res, next);
});

router.patch('/:id/resolve', requireAuth, (req, res, next) => {
  void escalationsController.resolve(req, res, next);
});

export default router;
