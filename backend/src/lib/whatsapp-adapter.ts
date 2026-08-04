import { randomUUID } from 'crypto';
import { BotRole } from '@prisma/client';
import { IncomingMessage, LocationData } from '../modules/bot/flows/types';
import { shouldUseTemplate, canSendTemplate } from '../utils/whatsapp-utils';
import { BotRepository } from '../modules/bot/bot.repository';
import { R2Client } from './r2-client';
import { simulatorQueue } from './simulator-queue';

export type WhatsAppRole = 'USER' | 'PROFESSIONAL';

export interface ParsedIncoming {
  message: IncomingMessage;
  role: WhatsAppRole;
}

export interface WhatsAppTemplateUsageData {
  phone: string;
  role: string;
  templateName: string;
  category: string;
  costUsd: number;
  requestId?: string;
}

export interface WhatsAppServiceConversationData {
  phone: string;
  role: string;
  requestId?: string;
  costUsd: number;
}

type TemplateUsageHandler = (data: WhatsAppTemplateUsageData) => void;
type ServiceConversationHandler = (data: WhatsAppServiceConversationData) => void;

let _templateUsageHandler: TemplateUsageHandler | null = null;
let _serviceConversationHandler: ServiceConversationHandler | null = null;

export function registerTemplateUsageHandler(handler: TemplateUsageHandler): void {
  _templateUsageHandler = handler;
}

export function registerServiceConversationHandler(handler: ServiceConversationHandler): void {
  _serviceConversationHandler = handler;
}

interface WhatsAppMetadata {
  display_phone_number: string;
  phone_number_id: string;
}

interface WhatsAppTextMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'text';
  text: { body: string };
}

interface WhatsAppImageMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'image';
  image: { id: string; mime_type: string; sha256: string };
}

interface WhatsAppAudioMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'audio';
  audio: { id: string; mime_type: string };
}

interface WhatsAppLocationMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'location';
  location: { latitude: number; longitude: number };
}

interface WhatsAppInteractiveMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'interactive';
  interactive: {
    type: 'button_reply';
    button_reply: {
      id: string;
      title: string;
    };
  };
}

interface WhatsAppButtonMessage {
  from: string;
  id: string;
  timestamp: string;
  type: 'button';
  button: {
    payload: string;
    text: string;
  };
  context?: {
    from: string;
    id: string;
  };
}

type WhatsAppInboundMessage =
  | WhatsAppTextMessage
  | WhatsAppImageMessage
  | WhatsAppAudioMessage
  | WhatsAppLocationMessage
  | WhatsAppInteractiveMessage
  | WhatsAppButtonMessage;

interface WhatsAppWebhookValue {
  messaging_product: string;
  metadata: WhatsAppMetadata;
  contacts?: Array<{ profile: { name: string }; wa_id: string }>;
  messages?: WhatsAppInboundMessage[];
  statuses?: unknown[];
}

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: WhatsAppWebhookValue;
    field: string;
  }>;
}

interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

export class WhatsAppAdapter {
  private readonly apiVersion: string;
  private readonly tokenUser: string;
  private readonly tokenProfessional: string;
  private readonly baseUrl: string;
  private readonly phoneNumberIdUser: string;
  private readonly phoneNumberIdProfessional: string;
  private readonly r2Client: R2Client;
  private readonly botRepository: BotRepository;

  constructor(r2Client: R2Client, botRepository: BotRepository) {
    this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v19.0';
    this.tokenUser = process.env.WHATSAPP_API_TOKEN_USER || '';
    this.tokenProfessional = process.env.WHATSAPP_API_TOKEN_PROFESSIONAL || '';
    this.baseUrl = process.env.WHATSAPP_BASE_URL || 'https://graph.facebook.com';
    this.phoneNumberIdUser = process.env.WHATSAPP_PHONE_NUMBER_ID_USER || '';
    this.phoneNumberIdProfessional = process.env.WHATSAPP_PHONE_NUMBER_ID_PROFESSIONAL || '';
    this.r2Client = r2Client;
    this.botRepository = botRepository;
  }

  isConfigured(): boolean {
    return !!(
      this.tokenUser &&
      this.phoneNumberIdUser &&
      this.phoneNumberIdProfessional
    );
  }

  async parseWebhook(payload: unknown): Promise<ParsedIncoming | null> {
    const wp = payload as WhatsAppWebhookPayload;

    if (!wp.entry?.length) return null;
    const entry = wp.entry[0];
    if (!entry.changes?.length) return null;
    const change = entry.changes[0];
    const value = change.value;

    if (!value?.messages?.length) return null;

    const msg = value.messages[0];
    const phone = msg.from;
    const phoneNumberId = value.metadata?.phone_number_id;
    const role: WhatsAppRole =
      phoneNumberId === this.phoneNumberIdProfessional ? 'PROFESSIONAL' : 'USER';

    const message: IncomingMessage = { phone, messageId: msg.id };

    console.log('[adapter] msg raw completo:', JSON.stringify(msg));

    if (msg.type === 'text' && msg.text?.body) {
      message.text = msg.text.body;
    }

    if (msg.type === 'location' && msg.location) {
      message.location = {
        latitude: msg.location.latitude,
        longitude: msg.location.longitude,
      } satisfies LocationData;
    }

    if (msg.type === 'image' && msg.image?.id) {
      message.mediaId = msg.image.id;
      message.mediaType = 'image';
    }

    if (msg.type === 'audio' && msg.audio?.id) {
      message.mediaId = msg.audio.id;
      message.mediaType = 'audio';
    }

    console.log('[adapter] msg.type:', msg.type, 'msg raw:', JSON.stringify(msg));

    if (msg.type === 'interactive') {
      const interactiveMsg = msg as unknown as WhatsAppInteractiveMessage;
      if (interactiveMsg.interactive?.type === 'button_reply') {
        message.text = interactiveMsg.interactive.button_reply.id;
        message.buttonPayload = interactiveMsg.interactive.button_reply.id;
      }
    }

    if (msg.type === 'button') {
      const buttonMsg = msg as unknown as WhatsAppButtonMessage;
      message.text = buttonMsg.button?.payload;
      message.buttonPayload = buttonMsg.button?.payload;
    }

    return { message, role };
  }

  async sendText(
    phone: string,
    text: string,
    role: WhatsAppRole,
  ): Promise<void> {
    if (!this.isConfigured()) {
      // eslint-disable-next-line no-console
      console.log(`[SIMULATOR] → ${role} ${phone}: "${text}"`);
      simulatorQueue.enqueue({ phone, role, type: 'text', content: text });
      return;
    }

    const needsTemplate = await shouldUseTemplate(phone, role, this.botRepository);

    if (needsTemplate) {
      await this.sendTemplate(phone, 'nora_notification', [text], role);
      return;
    }

    const { token, phoneNumberId } = this.getCredentials(role);

    const res = await fetch(
      `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.normalizePhone(phone),
          type: 'text',
          text: {
            preview_url: false,
            body: text,
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      // eslint-disable-next-line no-console
      console.error(`[WhatsAppAdapter] sendText failed: ${res.status} ${body}`);
    } else if (_serviceConversationHandler) {
      _serviceConversationHandler({ phone, role, costUsd: 0 });
    }
  }

  async sendImage(
    phone: string,
    imageUrl: string,
    role: WhatsAppRole,
    caption?: string,
  ): Promise<void> {
    if (!this.isConfigured()) {
      // eslint-disable-next-line no-console
      console.log(`[SIMULATOR] IMAGE → ${role} ${phone}: ${imageUrl}${caption ? ` caption: "${caption}"` : ''}`);
      const content = caption ? `[Imagen] ${caption}` : `[Imagen] ${imageUrl}`;
      simulatorQueue.enqueue({ phone, role, type: 'image', content });
      return;
    }

    const { token, phoneNumberId } = this.getCredentials(role);

    const imagePayload: Record<string, unknown> = { link: imageUrl };
    if (caption) {
      imagePayload.caption = caption;
    }

    const res = await fetch(
      `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.normalizePhone(phone),
          type: 'image',
          image: imagePayload,
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      // eslint-disable-next-line no-console
      console.error(
        `[WhatsAppAdapter] sendImage failed: ${res.status} ${body}`,
      );
    }
  }

  async sendAudio(
    phone: string,
    audioUrl: string,
    role: WhatsAppRole,
  ): Promise<void> {
    if (!this.isConfigured()) {
      // eslint-disable-next-line no-console
      console.log(`[SIMULATOR] AUDIO → ${role} ${phone}: ${audioUrl}`);
      simulatorQueue.enqueue({ phone, role, type: 'audio', content: `[Audio] ${audioUrl}` });
      return;
    }

    const { token, phoneNumberId } = this.getCredentials(role);

    const res = await fetch(
      `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.normalizePhone(phone),
          type: 'audio',
          audio: { link: audioUrl },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      // eslint-disable-next-line no-console
      console.error(`[WhatsAppAdapter] sendAudio failed: ${res.status} ${body}`);
    }
  }

  async sendTemplate(
    phone: string,
    templateName: string,
    params: string[],
    role: WhatsAppRole,
  ): Promise<void> {
    if (!this.isConfigured()) {
      // eslint-disable-next-line no-console
      console.log(`[SIMULATOR] TEMPLATE → ${role} ${phone}: ${templateName} ${JSON.stringify(params)}`);
      const content = params.length > 0 ? `[${templateName}] ${params.join(' | ')}` : `[${templateName}]`;
      simulatorQueue.enqueue({ phone, role, type: 'template', content });
      return;
    }

    const allowed = await canSendTemplate(phone, role as BotRole, this.botRepository);
    if (!allowed) {
      console.warn(`[WhatsAppAdapter] Template blocked for ${phone} (${role}): template already sent in the last 24h`);
      return;
    }

    const { token, phoneNumberId } = this.getCredentials(role);

    const res = await fetch(
      `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.normalizePhone(phone),
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'es_AR' },
            components: [
              {
                type: 'body',
                parameters: params.map((p) => ({ type: 'text', text: p })),
              },
            ],
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      // eslint-disable-next-line no-console
      console.error(
        `[WhatsAppAdapter] sendTemplate failed: ${res.status} ${body}`,
      );
      return;
    }

    await this.botRepository.setLastTemplateSentAt(phone, role as BotRole, new Date());

    if (_templateUsageHandler) {
      _templateUsageHandler({ phone, role, templateName, category: 'utility', costUsd: 0 });
    }
  }

  async sendTemplateWithButton(
    phone: string,
    templateName: string,
    bodyParams: string[],
    buttonUrlSuffix: string,
    role: WhatsAppRole,
  ): Promise<void> {
    if (!this.isConfigured()) {
      // eslint-disable-next-line no-console
      console.log(`[SIMULATOR] TEMPLATE+URL → ${role} ${phone}: ${templateName} ${JSON.stringify(bodyParams)} url_suffix: ${buttonUrlSuffix}`);
      const content =
        bodyParams.length > 0
          ? `[${templateName}] ${bodyParams.join(' | ')} [url: ${buttonUrlSuffix}]`
          : `[${templateName}] [url: ${buttonUrlSuffix}]`;
      simulatorQueue.enqueue({ phone, role, type: 'template_url', content });
      return;
    }

    const allowed = await canSendTemplate(phone, role as BotRole, this.botRepository);
    if (!allowed) {
      console.warn(`[WhatsAppAdapter] Template blocked for ${phone} (${role}): template already sent in the last 24h`);
      return;
    }

    const { token, phoneNumberId } = this.getCredentials(role);

    const res = await fetch(
      `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.normalizePhone(phone),
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'es_AR' },
            components: [
              {
                type: 'body',
                parameters: bodyParams.map((p) => ({ type: 'text', text: p })),
              },
              {
                type: 'button',
                sub_type: 'url',
                index: 0,
                parameters: [
                  { type: 'text', text: buttonUrlSuffix },
                ],
              },
            ],
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      // eslint-disable-next-line no-console
      console.error(
        `[WhatsAppAdapter] sendTemplateWithButton failed: ${res.status} ${body}`,
      );
      return;
    }

    await this.botRepository.setLastTemplateSentAt(phone, role as BotRole, new Date());

    if (_templateUsageHandler) {
      _templateUsageHandler({ phone, role, templateName, category: 'utility', costUsd: 0 });
    }
  }

  async sendTemplateWithQuickReplies(
    phone: string,
    templateName: string,
    bodyParams: string[],
    buttons: Array<{ payload: string; text?: string }>,
    role: WhatsAppRole,
  ): Promise<void> {
    if (!this.isConfigured()) {
      const buttonLabels = buttons.map((b) => b.text || b.payload).join(' | ');
      // eslint-disable-next-line no-console
      console.log(`[SIMULATOR] TEMPLATE+BUTTONS → ${role} ${phone}: ${templateName} ${JSON.stringify(bodyParams)} buttons: [${buttonLabels}]`);
      const content =
        bodyParams.length > 0
          ? `[${templateName}] ${bodyParams.join(' | ')} [botones: ${buttonLabels}]`
          : `[${templateName}] [botones: ${buttonLabels}]`;
      simulatorQueue.enqueue({ phone, role, type: 'template_buttons', content });
      return;
    }

    const allowed = await canSendTemplate(phone, role as BotRole, this.botRepository);
    if (!allowed) {
      console.warn(`[WhatsAppAdapter] Template blocked for ${phone} (${role}): template already sent in the last 24h`);
      return;
    }

    const { token, phoneNumberId } = this.getCredentials(role);

    const buttonComponents = buttons.map((btn, index) => ({
      type: 'button',
      sub_type: 'quick_reply',
      index,
      parameters: [{ type: 'payload', payload: btn.payload }],
    }));

    const res = await fetch(
      `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          ...this.getAuthHeaders(token),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: this.normalizePhone(phone),
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'es_AR' },
            components: [
              {
                type: 'body',
                parameters: bodyParams.map((p) => ({ type: 'text', text: p })),
              },
              ...buttonComponents,
            ],
          },
        }),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      // eslint-disable-next-line no-console
      console.error(
        `[WhatsAppAdapter] sendTemplateWithQuickReplies failed: ${res.status} ${body}`,
      );
      return;
    }

    await this.botRepository.setLastTemplateSentAt(phone, role as BotRole, new Date());

    if (_templateUsageHandler) {
      _templateUsageHandler({ phone, role, templateName, category: 'utility', costUsd: 0 });
    }
  }
  async downloadAndUploadToR2(
    mediaId: string,
    folder: string,
    role: WhatsAppRole,
  ): Promise<string> {
    const { token, phoneNumberId } = this.getCredentials(role);
    const isKapso = this.baseUrl.includes('kapso.ai');

    let metaUrl = `${this.baseUrl}/${this.apiVersion}/${mediaId}`;
    if (isKapso) {
      metaUrl += `?phone_number_id=${phoneNumberId}`;
    }

    const mediaRes = await fetch(metaUrl, {
      headers: this.getAuthHeaders(token),
    });

    if (!mediaRes.ok) {
      throw new Error(`Failed to fetch media info from Meta: ${mediaRes.status}`);
    }

    const mediaData = (await mediaRes.json()) as {
      url: string;
      mime_type: string;
      download_url?: string;
    };

    if (!mediaData.url) {
      throw new Error('Media URL not found in Meta response');
    }

    const downloadUrl = isKapso && mediaData.download_url
      ? mediaData.download_url
      : mediaData.url;
    const downloadHeaders = isKapso && mediaData.download_url
      ? {}
      : { Authorization: `Bearer ${token}` };

    const fileRes = await fetch(downloadUrl, { headers: downloadHeaders });

    if (!fileRes.ok) {
      throw new Error(`Failed to download media file from Meta: ${fileRes.status}`);
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const ext = mediaData.mime_type.split('/')[1] || 'bin';
    const key = `${folder.replace(/^\/+|\/+$/g, '')}/${randomUUID()}.${ext}`;

    const result = await this.r2Client.uploadBuffer(key, buffer, mediaData.mime_type);
    return result.publicUrl;
  }

  private normalizePhone(phone: string): string {
    if (process.env.NORMALIZE_AR_PHONES === 'true' && phone.startsWith('549') && phone.length === 13) {
      return '54' + phone.slice(3);
    }
    return phone;
  }

  private getCredentials(role: WhatsAppRole): { token: string; phoneNumberId: string } {
    return role === 'PROFESSIONAL'
      ? {
          token: this.tokenProfessional || this.tokenUser,
          phoneNumberId: this.phoneNumberIdProfessional,
        }
      : {
          token: this.tokenUser,
          phoneNumberId: this.phoneNumberIdUser,
        };
  }

  private getAuthHeaders(token: string): Record<string, string> {
    const isKapso = this.baseUrl.includes('kapso.ai');

    return isKapso ? { 'X-API-Key': token } : { Authorization: `Bearer ${token}` };
  }
}
