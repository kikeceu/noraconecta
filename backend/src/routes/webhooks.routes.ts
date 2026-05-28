import { Router, Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { WhatsAppAdapter } from '../lib/whatsapp-adapter';
import { BotService } from '../modules/bot/bot.service';
import { BotRepository } from '../modules/bot/bot.repository';
import { UsersService } from '../modules/users/users.service';
import { UsersRepository } from '../modules/users/users.repository';
import { RequestsRepository } from '../modules/requests/requests.repository';
import { ProfessionalsRepository } from '../modules/professionals/professionals.repository';
import { R2Client } from '../lib/r2-client';

const botRepository = new BotRepository();
const usersRepository = new UsersRepository();
const usersService = new UsersService(usersRepository);
const requestsRepository = new RequestsRepository();
const professionalsRepository = new ProfessionalsRepository();
const botService = new BotService(botRepository, usersService, requestsRepository, professionalsRepository);

let r2Client: R2Client | null = null;
let whatsappAdapter: WhatsAppAdapter | null = null;

function getR2Client(): R2Client | null {
  if (r2Client) return r2Client;
  try {
    r2Client = new R2Client();
    return r2Client;
  } catch {
    return null;
  }
}

function getWhatsappAdapter(): WhatsAppAdapter | null {
  if (whatsappAdapter) return whatsappAdapter;
  const r2 = getR2Client();
  if (!r2) return null;
  whatsappAdapter = new WhatsAppAdapter(r2, botRepository);
  if (!whatsappAdapter.isConfigured()) {
    // eslint-disable-next-line no-console
    console.warn(
      '[webhooks] WhatsApp API not configured (missing WHATSAPP_API_TOKEN_USER, WHATSAPP_API_TOKEN_PROFESSIONAL, WHATSAPP_PHONE_NUMBER_ID_USER, or WHATSAPP_PHONE_NUMBER_ID_PROFESSIONAL). Webhook will respond 503.',
    );
    return null;
  }
  return whatsappAdapter;
}

function validateHmac(rawBody: Buffer, signatureHeader: string): boolean {
  const webhookSecret = process.env.WHATSAPP_APP_SECRET;
  if (!webhookSecret) return false;

  if (!signatureHeader?.startsWith('sha256=')) return false;

  const expectedSignature = signatureHeader.slice(7);
  const computedSignature = createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  try {
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const computedBuffer = Buffer.from(computedSignature, 'hex');
    return (
      expectedBuffer.length === computedBuffer.length &&
      timingSafeEqual(expectedBuffer, computedBuffer)
    );
  } catch {
    return false;
  }
}

const router = Router();

router.get('/whatsapp', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && challenge) {
    // eslint-disable-next-line no-console
    console.log('[webhooks] WhatsApp webhook verification received, verify_token:', token);
    res.status(200).send(String(challenge));
    return;
  }

  res.status(400).json({ error: 'Invalid verification request' });
});

router.post('/whatsapp', (req: Request, res: Response) => {
  const adapter = getWhatsappAdapter();
  if (!adapter) {
    res.status(503).json({
      error: 'WhatsApp API not configured',
      statusCode: 503,
    });
    return;
  }

  const rawBody = (req as unknown as { rawBody?: Buffer }).rawBody;
  if (!rawBody) {
    res.status(400).json({ error: 'Missing request body', statusCode: 400 });
    return;
  }

  const signatureHeader = req.headers['x-hub-signature-256'] as
    | string
    | undefined;

  if (!validateHmac(rawBody, signatureHeader || '')) {
    res.status(401).json({
      error: 'Invalid signature',
      statusCode: 401,
    });
    return;
  }

  const payload: unknown = req.body;

  res.status(200).json({ received: true });

  void processWebhookAsync(payload);
});

async function processWebhookAsync(payload: unknown): Promise<void> {
  try {
    const adapter = getWhatsappAdapter();
    if (!adapter) return;

    const parsed = await adapter.parseWebhook(payload);
    if (!parsed) return;

    // eslint-disable-next-line no-console
    console.log(
      `[webhooks] Processing WhatsApp message from ${parsed.message.phone} as ${parsed.role}`,
    );

    const result = await botService.processMessage({
      phone: parsed.message.phone,
      text: parsed.message.text,
      imageUrls: parsed.message.imageUrls,
      audioUrl: parsed.message.audioUrl,
      location: parsed.message.location,
      role: parsed.role,
    });

    let responseText = result.text;

    if (result.options?.length) {
      responseText += `\n\n${result.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`;
    }

    await adapter.sendText(parsed.message.phone, responseText, parsed.role);

    if (result.mediaUrls?.length) {
      for (const mediaUrl of result.mediaUrls) {
        try {
          await adapter.sendImage(parsed.message.phone, mediaUrl, parsed.role);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[Webhook] Failed to send media:', err);
        }
      }
    }

    if (result.audioUrl) {
      try {
        await adapter.sendAudio(parsed.message.phone, result.audioUrl, parsed.role);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[Webhook] Failed to send audio:', err);
      }
    }

    // Send pending notification immediately via WhatsApp and clear from session
    if (result.pendingNotification) {
      const { targetPhone, targetRole, message } = result.pendingNotification;

      try {
        await adapter.sendText(targetPhone, message, targetRole);

        // Clear pendingMessage from target session so it's not delivered again
        const targetSession = await botRepository.findByPhoneAndRole(targetPhone, targetRole);
        if (targetSession) {
          const targetTempData = (targetSession.tempData as Record<string, unknown>) || {};
          const { pendingMessage: _, ...cleanTempData } = targetTempData;

          await botRepository.upsert(targetPhone, {
            role: targetRole,
            currentFlow: targetSession.currentFlow,
            currentStep: targetSession.currentStep,
            tempData: cleanTempData as Prisma.InputJsonValue,
          });
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[webhooks] Failed to send pending notification:', err);
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[webhooks] Error processing WhatsApp message:', err);
  }
}

export default router;
