import { Router } from 'express';
import { adminController } from './admin.controller';
import { requireAuth } from '../../middleware/require-auth';

const router = Router();

router.get('/metrics', requireAuth, (req, res, next) => {
  void adminController.getMetrics(req, res, next);
});

export default router;
