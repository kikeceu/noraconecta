import { Router } from 'express';
import { configController } from './config.controller';
import { requireSuperAdmin } from '../../middleware/require-super-admin';

const router = Router();

router.get('/', requireSuperAdmin, (req, res, next) => {
  void configController.getConfig(req, res, next);
});

router.patch('/:key', requireSuperAdmin, (req, res, next) => {
  void configController.updateConfig(req, res, next);
});

export default router;
