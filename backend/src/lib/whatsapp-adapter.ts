import { randomUUID } from 'crypto';
import { IncomingMessage, LocationData } from '../modules/bot/flows/types';
import { shouldUseTemplate } from '../utils/whatsapp-utils';
import { BotRepository } from '../modules/bot/bot.repository';
import { R2Client } from './r2-client';

export type WhatsAppRole = 'USER' | 'PROFESSIONAL';

export interface ParsedIncoming {
  message: IncomingMessage;
  role: WhatsAppRole;
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

type WhatsAppInboundMessage =
  | WhatsAppTextMessage
  | WhatsAppImageMessage
  | WhatsAppAudioMessage
  | WhatsAppLocationMessage;

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
      this.tokenProfessional &&
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

    const message: IncomingMessage = { phone };

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
      message.imageUrls = [
        await this.downloadAndUploadToR2(msg.image.id, 'request-photos', role),
      ];
    }

    if (msg.type === 'audio' && msg.audio?.id) {
      message.audioUrl = await this.downloadAndUploadToR2(
        msg.audio.id,
        'request-audio',
        role,
      );
    }

    return { message, role };
  }

  async sendText(
    phone: string,
    text: string,
    role: WhatsAppRole,
  ): Promise<void> {
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
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
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
    }
  }

  async sendImage(
    phone: string,
    imageUrl: string,
    role: WhatsAppRole,
    caption?: string,
  ): Promise<void> {
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
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
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
    const { token, phoneNumberId } = this.getCredentials(role);

    const res = await fetch(
      `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
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
    const { token, phoneNumberId } = this.getCredentials(role);

    const res = await fetch(
      `${this.baseUrl}/${this.apiVersion}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
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
    }
  }

  async downloadAndUploadToR2(
    mediaId: string,
    folder: string,
    role: WhatsAppRole,
  ): Promise<string> {
    const { token } = this.getCredentials(role);

    const mediaRes = await fetch(
      `${this.baseUrl}/${this.apiVersion}/${mediaId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!mediaRes.ok) {
      throw new Error(
        `Failed to fetch media info from Meta: ${mediaRes.status}`,
      );
    }

    const mediaData = (await mediaRes.json()) as {
      url: string;
      mime_type: string;
    };

    if (!mediaData.url) {
      throw new Error('Media URL not found in Meta response');
    }

    const fileRes = await fetch(mediaData.url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!fileRes.ok) {
      throw new Error(
        `Failed to download media file from Meta: ${fileRes.status}`,
      );
    }

    const buffer = Buffer.from(await fileRes.arrayBuffer());
    const ext = mediaData.mime_type.split('/')[1] || 'bin';
    const key = `${folder.replace(/^\/+|\/+$/g, '')}/${randomUUID()}.${ext}`;

    const result = await this.r2Client.uploadBuffer(
      key,
      buffer,
      mediaData.mime_type,
    );

    return result.publicUrl;
  }

  private getCredentials(
    role: WhatsAppRole,
  ): { token: string; phoneNumberId: string } {
    return role === 'PROFESSIONAL'
      ? {
          token: this.tokenProfessional,
          phoneNumberId: this.phoneNumberIdProfessional,
        }
      : {
          token: this.tokenUser,
          phoneNumberId: this.phoneNumberIdUser,
        };
  }
}
