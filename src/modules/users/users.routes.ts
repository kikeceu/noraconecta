import { Router } from 'express';
import { usersController } from './users.controller';
import { requireAuth } from '../../middleware/require-auth';
import { requireSuperAdmin } from '../../middleware/require-super-admin';

const router = Router();

router.get('/', requireAuth, (req, res, next) => {
  void usersController.list(req, res, next);
});

router.get('/:id', requireAuth, (req, res, next) => {
  void usersController.getById(req, res, next);
});

router.patch('/:id/block', requireSuperAdmin, (req, res, next) => {
  void usersController.block(req, res, next);
});

router.patch('/:id/unblock', requireSuperAdmin, (req, res, next) => {
  void usersController.unblock(req, res, next);
});

export default router;
