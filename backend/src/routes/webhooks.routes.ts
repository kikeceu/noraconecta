import { Router, Request, Response } from 'express';
import { createHmac, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import { WhatsAppAdapter, WhatsAppRole, ParsedIncoming } from '../lib/whatsapp-adapter';
import { BotService } from '../modules/bot/bot.service';
import { BotRepository } from '../modules/bot/bot.repository';
import { SecurityRepository } from '../modules/bot/security.repository';
import { SecurityService } from '../modules/bot/security.service';
import { UsersService } from '../modules/users/users.service';
import { UsersRepository } from '../modules/users/users.repository';
import { RequestsRepository } from '../modules/requests/requests.repository';
import { ProfessionalsRepository } from '../modules/professionals/professionals.repository';
import { R2Client } from '../lib/r2-client';

const botRepository = new BotRepository();
const securityRepository = new SecurityRepository();
const securityService = new SecurityService(securityRepository);
const usersRepository = new UsersRepository();
const usersService = new UsersService(usersRepository);
const requestsRepository = new RequestsRepository();
const professionalsRepository = new ProfessionalsRepository();
const botService = new BotService(botRepository, usersService, requestsRepository, professionalsRepository, securityService);

interface PhotoAccumulator {
  phone: string;
  role: WhatsAppRole;
  imageUrls: string[];
  timer: ReturnType<typeof setTimeout>;
  originalParsed: ParsedIncoming;
}

const photoAccumulators = new Map<string, PhotoAccumulator>();
const PHOTO_DEBOUNCE_MS = 3000;

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

function getAppSecret(parsedBody: unknown): string | undefined {
  const secretUser = process.env.WHATSAPP_APP_SECRET_USER;
  const secretPro = process.env.WHATSAPP_APP_SECRET_PROFESSIONAL;

  if (secretUser && secretPro) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const phoneNumberId = (parsedBody as any)
      ?.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    const proNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID_PROFESSIONAL;
    return phoneNumberId === proNumberId ? secretPro : secretUser;
  }

  return process.env.WHATSAPP_APP_SECRET;
}

function validateHmac(rawBody: Buffer, req: Request, parsedBody: unknown): boolean {
  const kapsoSignature = req.headers['x-webhook-signature'] as
    | string
    | undefined;
  const metaSignature = req.headers['x-hub-signature-256'] as
    | string
    | undefined;

  if (kapsoSignature) {
    const webhookSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
    if (!webhookSecret) return false;

    const computedSignature = createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    try {
      const expectedBuffer = Buffer.from(kapsoSignature, 'hex');
      const computedBuffer = Buffer.from(computedSignature, 'hex');
      return timingSafeEqual(expectedBuffer, computedBuffer);
    } catch {
      return false;
    }
  }

  if (metaSignature) {
    const appSecret = getAppSecret(parsedBody);
    if (!appSecret) return false;
    if (!metaSignature.startsWith('sha256=')) return false;

    const expectedSignature = metaSignature.slice(7);
    const computedSignature = createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

    try {
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const computedBuffer = Buffer.from(computedSignature, 'hex');
      return timingSafeEqual(expectedBuffer, computedBuffer);
    } catch {
      return false;
    }
  }

  return false;
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

  if (!validateHmac(rawBody, req, req.body)) {
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

    // Photo debounce: accumulate images when the user is in ASK_PHOTOS step
    if (parsed.message.imageUrls?.length) {
      const session = await botRepository.findByPhoneAndRole(
        parsed.message.phone,
        parsed.role,
      );
      const isPhotoStep = session?.currentStep === 'ASK_PHOTOS';

      if (isPhotoStep) {
        const key = `${parsed.message.phone}:${parsed.role}`;

        const existing = photoAccumulators.get(key);
        if (existing) {
          clearTimeout(existing.timer);
          existing.imageUrls.push(...(parsed.message.imageUrls || []));
        } else {
          photoAccumulators.set(key, {
            phone: parsed.message.phone,
            role: parsed.role,
            imageUrls: [...(parsed.message.imageUrls || [])],
            timer: null as unknown as ReturnType<typeof setTimeout>,
            originalParsed: parsed,
          });
        }

        const accumulator = photoAccumulators.get(key)!;
        accumulator.timer = setTimeout(() => {
          photoAccumulators.delete(key);
          void processWithAccumulatedPhotos(accumulator);
        }, PHOTO_DEBOUNCE_MS);

        return;
      }
    }

    const result = await botService.processMessage({
      phone: parsed.message.phone,
      text: parsed.message.text,
      imageUrls: parsed.message.imageUrls,
      audioUrl: parsed.message.audioUrl,
      location: parsed.message.location,
      role: parsed.role,
    });

    await sendResponse(adapter, parsed.message.phone, parsed.role, result);

    if (result.pendingNotification) {
      await handlePendingNotification(adapter, result.pendingNotification);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[webhooks] Error processing WhatsApp message:', err);
  }
}

async function sendResponse(
  adapter: WhatsAppAdapter,
  phone: string,
  role: WhatsAppRole,
  result: Awaited<ReturnType<typeof botService.processMessage>>,
): Promise<void> {
  let responseText = result.text;

  if (result.options?.length) {
    responseText += `\n\n${result.options.map((o, i) => `${i + 1}. ${o}`).join('\n')}`;
  }

  if (result.mediaFirst) {
    // Send media first (photos → audio → text) for "Ver detalles"
    if (result.mediaUrls?.length) {
      for (const mediaUrl of result.mediaUrls) {
        try {
          await adapter.sendImage(phone, mediaUrl, role);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[webhooks] Failed to send media:', err);
        }
      }
    }

    if (result.audioUrl) {
      try {
        await adapter.sendAudio(phone, result.audioUrl, role);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[webhooks] Failed to send audio:', err);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
    await adapter.sendText(phone, responseText, role);
  } else {
    await adapter.sendText(phone, responseText, role);

    if (result.mediaUrls?.length) {
      for (const mediaUrl of result.mediaUrls) {
        try {
          await adapter.sendImage(phone, mediaUrl, role);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('[webhooks] Failed to send media:', err);
        }
      }
    }

    if (result.audioUrl) {
      try {
        await adapter.sendAudio(phone, result.audioUrl, role);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[webhooks] Failed to send audio:', err);
      }
    }
  }
}

async function handlePendingNotification(
  adapter: WhatsAppAdapter,
  pendingNotification: Awaited<ReturnType<typeof botService.processMessage>>['pendingNotification'],
): Promise<void> {
  if (!pendingNotification) return;

  const { targetPhone, targetRole, message } = pendingNotification;

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

async function processWithAccumulatedPhotos(
  accumulator: PhotoAccumulator,
): Promise<void> {
  try {
    const adapter = getWhatsappAdapter();
    if (!adapter) return;

    // eslint-disable-next-line no-console
    console.log(
      `[webhooks] Processing accumulated photos from ${accumulator.phone} as ${accumulator.role} (${accumulator.imageUrls.length} photos)`,
    );

    const result = await botService.processMessage({
      phone: accumulator.phone,
      imageUrls: accumulator.imageUrls,
      role: accumulator.role,
    });

    await sendResponse(adapter, accumulator.phone, accumulator.role, result);

    if (result.pendingNotification) {
      await handlePendingNotification(adapter, result.pendingNotification);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[webhooks] Error processing accumulated photos:', err);
  }
}

export default router;
