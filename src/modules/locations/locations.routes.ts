import { Router } from 'express';
import { locationsController } from './locations.controller';
import { requireAuth } from '../../middleware/require-auth';
import { requireSuperAdmin } from '../../middleware/require-super-admin';

const router = Router();

router.get('/countries', requireAuth, (req, res, next) => {
  void locationsController.listCountries(req, res, next);
});

router.get('/tree/:countryId', requireAuth, (req, res, next) => {
  void locationsController.getTree(req, res, next);
});

router.get('/leaf-nodes', requireAuth, (req, res, next) => {
  void locationsController.getLeafNodes(req, res, next);
});

router.post('/countries', requireSuperAdmin, (req, res, next) => {
  void locationsController.createCountry(req, res, next);
});

router.post('/nodes', requireSuperAdmin, (req, res, next) => {
  void locationsController.createNode(req, res, next);
});

router.patch('/nodes/:id/toggle', requireSuperAdmin, (req, res, next) => {
  void locationsController.toggleNode(req, res, next);
});

export default router;
