import { Router } from 'express';
import { authController } from './auth.controller';

const router = Router();

router.post('/login', (req, res, next) => {
  void authController.login(req, res, next);
});

export default router;
