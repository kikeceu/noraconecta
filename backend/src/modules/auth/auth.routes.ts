import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from '../../middleware/require-auth';

const router = Router();

router.post('/login', (req, res, next) => {
  void authController.login(req, res, next);
});

router.post('/logout', (req, res, next) => {
  void authController.logout(req, res, next);
});

router.get('/me', requireAuth, (req, res, next) => {
  void authController.me(req, res, next);
});

export default router;
