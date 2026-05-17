import { BotSession } from '@prisma/client';

export interface LocationData {
  latitude: number;
  longitude: number;
}

export interface IncomingMessage {
  phone: string;
  text?: string;
  imageUrls?: string[];
  audioUrl?: string;
  location?: LocationData;
}

export interface BotResponse {
  text: string;
  mediaUrls?: string[];
  audioUrl?: string;
  options?: string[];
  requestId?: string;
}

export interface FlowContext {
  session: BotSession;
  message: IncomingMessage;
}

export interface FlowStepResult {
  response: BotResponse;
  nextStep: string | null;
  tempData: Record<string, unknown>;
}

export interface FlowHandler {
  readonly flowName: string;
  handleStep(step: string, context: FlowContext): Promise<FlowStepResult>;
  getInitialStep(): string;
}

export interface NlpResult<T> {
  match: T | null;
  confidence: 'exact' | 'fuzzy' | 'none';
}

export interface PendingNotification {
  targetPhone: string;
  targetRole: 'USER' | 'PROFESSIONAL';
  message: string;
  flow: string | null;
  step: string | null;
  tempData: Record<string, unknown>;
}
