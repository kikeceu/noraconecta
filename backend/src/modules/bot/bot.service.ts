import { BotRepository } from './bot.repository';
import { resolveFlowHandler, getFlowHandlerByName } from './flows/flow-handler.factory';
import { FlowContext, BotResponse } from './flows/types';
import { Prisma } from '@prisma/client';

export type ProcessMessageInput = {
  phone: string;
  text?: string;
  imageUrls?: string[];
  audioUrl?: string;
  role?: 'USER' | 'PROFESSIONAL';
};

export class BotService {
  constructor(private readonly botRepository: BotRepository) {}

  async processMessage(input: ProcessMessageInput): Promise<BotResponse & { flow?: string; step?: string }> {
    let session = await this.botRepository.findByPhone(input.phone);

    const role = input.role || (session?.role as 'USER' | 'PROFESSIONAL') || 'USER';

    if (!session) {
      const handler = resolveFlowHandler(role);

      session = await this.botRepository.upsert(input.phone, {
        role,
        currentFlow: handler.flowName,
        currentStep: handler.getInitialStep(),
        tempData: {} as Prisma.InputJsonValue,
      });
    }

    if (!session.currentFlow) {
      const handler = resolveFlowHandler(role);
      session.currentFlow = handler.flowName;
      session.currentStep = handler.getInitialStep();
    }

    const flowHandler = getFlowHandlerByName(session.currentFlow);
    if (!flowHandler) {
      return {
        text: 'Error interno: flujo no encontrado. Reinicia la conversacion con "hola".',
        flow: undefined,
        step: undefined,
      };
    }

    const context: FlowContext = {
      session,
      message: {
        phone: input.phone,
        text: input.text,
        imageUrls: input.imageUrls,
        audioUrl: input.audioUrl,
      },
    };

    const step = session.currentStep || flowHandler.getInitialStep();
    const result = await flowHandler.handleStep(step, context);

    const updatedSession = await this.botRepository.upsert(input.phone, {
      role,
      currentFlow: result.nextStep ? session.currentFlow : undefined,
      currentStep: result.nextStep || undefined,
      tempData: result.nextStep ? (result.tempData as Prisma.InputJsonValue) : ({} as Prisma.InputJsonValue),
    });

    return {
      text: result.response.text,
      mediaUrls: result.response.mediaUrls,
      options: result.response.options,
      flow: updatedSession.currentFlow || undefined,
      step: updatedSession.currentStep || undefined,
    };
  }

  async resetSession(phone: string): Promise<void> {
    await this.botRepository.deleteByPhone(phone);
  }
}
