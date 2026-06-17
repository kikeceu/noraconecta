import { SecurityRepository } from './security.repository';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_MESSAGES = 10;
const SUSPICIOUS_THRESHOLD = 3;
const SUSPICIOUS_BLOCK_MINUTES = 60;

const INJECTION_PATTERNS: RegExp[] = [
  /ignora(r|d)?\s+(todas?\s+)?(las?\s+)?instrucciones/i,
  /olvida\s+(todo|las?\s+instrucciones)/i,
  /nuevo\s+sistema/i,
  /\[system\]/i,
  /\[inst\]/i,
  /act\s+as\s+/i,
  /jailbreak/i,
  /prompt\s+injection/i,
  /ignore\s+(all\s+)?(previous\s+)?instructions/i,
  /forget\s+(everything|your\s+instructions)/i,
  /you\s+are\s+now\s+/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /dan\s+mode/i,
];

export interface SecurityCheckResult {
  blocked: boolean;
  responseText?: string;
  reason?: 'rate_limit' | 'temporary_block' | 'injection';
}

export class SecurityService {
  private rateLimitCache = new Map<string, { count: number; windowStart: number }>();

  constructor(private readonly securityRepository: SecurityRepository) {}

  async check(phone: string, text?: string): Promise<SecurityCheckResult> {
    const rateLimitResult = this.checkRateLimit(phone);
    if (rateLimitResult.blocked) {
      this.securityRepository.upsertMessageCount(
        phone,
        new Date(rateLimitResult.windowStart!),
        rateLimitResult.count!,
      ).catch(err => console.error('[Security] Failed to log rate limit:', err));

      return {
        blocked: true,
        responseText: 'Por favor esperá unos segundos antes de enviar otro mensaje.',
        reason: 'rate_limit',
      };
    }

    const securityRecord = await this.securityRepository.findByPhone(phone);
    if (securityRecord?.blockedUntil && securityRecord.blockedUntil > new Date()) {
      return {
        blocked: true,
        responseText: 'Tu cuenta está temporalmente limitada. Podés volver a intentarlo más tarde.',
        reason: 'temporary_block',
      };
    }

    if (securityRecord?.blockedUntil && securityRecord.blockedUntil <= new Date()) {
      this.securityRepository.clearBlock(phone)
        .catch(err => console.error('[Security] Failed to clear block:', err));
    }

    if (text && this.detectInjection(text)) {
      console.warn('[Security] Possible prompt injection detected:', phone);

      const suspiciousCount = (securityRecord?.suspiciousCount ?? 0) + 1;

      this.securityRepository.incrementSuspiciousCount(phone)
        .catch(err => console.error('[Security] Failed to increment suspicious count:', err));

      if (suspiciousCount >= SUSPICIOUS_THRESHOLD) {
        const blockedUntil = new Date(Date.now() + SUSPICIOUS_BLOCK_MINUTES * 60_000);
        this.securityRepository.blockUntil(phone, blockedUntil)
          .catch(err => console.error('[Security] Failed to block phone:', err));
      }

      return {
        blocked: true,
        responseText: 'No entendí bien lo que necesitás. ¿Qué servicio estás buscando?',
        reason: 'injection',
      };
    }

    return { blocked: false };
  }

  private checkRateLimit(phone: string): { blocked: boolean; windowStart?: number; count?: number } {
    const now = Date.now();
    const cached = this.rateLimitCache.get(phone);

    if (!cached || now - cached.windowStart > RATE_LIMIT_WINDOW_MS) {
      this.rateLimitCache.set(phone, { count: 1, windowStart: now });
      return { blocked: false };
    }

    cached.count++;

    if (cached.count > RATE_LIMIT_MAX_MESSAGES) {
      return { blocked: true, windowStart: cached.windowStart, count: cached.count };
    }

    return { blocked: false };
  }

  private detectInjection(text: string): boolean {
    const normalized = text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return INJECTION_PATTERNS.some(pattern => pattern.test(normalized));
  }
}
