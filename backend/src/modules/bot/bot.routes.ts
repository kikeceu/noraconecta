import { Router } from 'express';
import { botController } from './bot.controller';

const router = Router();

router.post('/message', (req, res, next) => {
  void botController.message(req, res, next);
});

router.post('/session/reset', (req, res, next) => {
  void botController.resetSession(req, res, next);
});

export default router;
