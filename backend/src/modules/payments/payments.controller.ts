import { Request, Response, NextFunction } from 'express';
import { PaymentsService } from './payments.service';

export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  generateLink = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { professionalId, planId } = req.body as {
        professionalId?: string;
        planId?: string;
      };

      if (!professionalId || !planId) {
        res
          .status(400)
          .json({ error: 'professionalId and planId are required' });
        return;
      }

      const link = await this.paymentsService.generatePaymentLink(
        professionalId,
        planId,
      );

      res.status(200).json({ data: { url: link } });
    } catch (err) {
      console.error('[PaymentsController] generateLink error:', err);
      next(err);
    }
  };

  handleWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const signature = req.headers['x-signature'] as string | undefined;
      const requestId = (req.headers['x-request-id'] as string | undefined) ?? '';

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
        requestId,
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
