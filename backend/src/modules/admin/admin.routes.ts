import { Router } from 'express';
import { adminController } from './admin.controller';
import { requireAuth } from '../../middleware/require-auth';
import { requireSuperAdmin } from '../../middleware/require-super-admin';

const router = Router();

router.get('/metrics', requireAuth, (req, res, next) => {
  void adminController.getMetrics(req, res, next);
});

router.get('/geo-tree', requireAuth, (req, res, next) => {
  void adminController.getGeoTree(req, res, next);
});

router.post('/requests/auto-close', requireSuperAdmin, (req, res, next) => {
  void adminController.autoCloseRequests(req, res, next);
});

export default router;
