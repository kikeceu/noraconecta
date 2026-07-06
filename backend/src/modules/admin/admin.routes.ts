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

router.get('/membership-discount', requireSuperAdmin, (req, res, next) => {
  void adminController.getMembershipDiscount(req, res, next);
});

router.post('/membership-discount', requireSuperAdmin, (req, res, next) => {
  void adminController.setMembershipDiscount(req, res, next);
});

router.get('/prompts', requireSuperAdmin, (req, res, next) => {
  void adminController.listPrompts(req, res, next);
});

router.patch('/prompts/:key', requireSuperAdmin, (req, res, next) => {
  void adminController.updatePrompt(req, res, next);
});

router.post('/prompts/:key/reset', requireSuperAdmin, (req, res, next) => {
  void adminController.resetPrompt(req, res, next);
});

router.post('/prompts/:key/invalidate-cache', requireSuperAdmin, (req, res, next) => {
  adminController.invalidatePromptCache(req, res, next);
});

export default router;
