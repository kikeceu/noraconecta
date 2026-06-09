import { Router, Request, Response } from 'express';
import { simulatorQueue } from '../lib/simulator-queue';

const router = Router();

function isSimulatorMode(): boolean {
  return !(
    process.env.WHATSAPP_API_TOKEN_USER &&
    process.env.WHATSAPP_PHONE_NUMBER_ID_USER &&
    process.env.WHATSAPP_PHONE_NUMBER_ID_PROFESSIONAL
  );
}

router.get('/messages', (req: Request, res: Response): void => {
  // Only available in simulator mode (WhatsApp tokens not configured)
  if (!isSimulatorMode()) {
    res.json({ messages: [] });
    return;
  }

  const { phone, role } = req.query;

  if (!phone || !role || (role !== 'USER' && role !== 'PROFESSIONAL')) {
    res.status(400).json({ error: 'phone and role (USER|PROFESSIONAL) required' });
    return;
  }

  const messages = simulatorQueue.dequeue(phone as string, role as 'USER' | 'PROFESSIONAL');
  res.json({ messages });
});

export default router;
