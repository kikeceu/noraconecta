import { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service';

export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  handleWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signature = req.headers['x-signature'] as string | undefined;

      if (!signature) {
        res.status(400).json({ error: 'Missing x-signature header' });
        return;
      }

      const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;

      if (!rawBody) {
        res.status(400).json({ error: 'Missing raw body' });
        return;
      }

      const isValid = this.paymentsService.verifyWebhookSignature(
        rawBody,
        signature,
      );

      if (!isValid) {
        res.status(403).json({ error: 'Invalid signature' });
        return;
      }

      res.status(200).json({ received: true });

      const body = req.body as {
        action?: string;
        data?: { id?: string };
        type?: string;
      };

      if (body.type === 'payment' && body.data?.id) {
        void this.paymentsService.processPaymentWebhook(body.data.id);
      }
    } catch (err) {
      next(err);
    }
  };
}
