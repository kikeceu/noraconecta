import { FlowStepResult, FlowContext, PendingNotification } from './types';
import { RequestsService } from '../../requests/requests.service';
import { AbuseDetectionService } from '../abuse-detection.service';
import { NotificationService } from '../../notifications/notification.service';
import { resolveOption } from './option-resolver.helper';
import prisma from '../../../lib/prisma';

const CANCEL_KEYWORDS = [
  'cancelar',
  'cancela',
  'cancel',
  'quiero cancelar',
  'cancelar pedido',
  'no quiero más',
  'no quiero mas',
];

export function isCancellationIntent(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return CANCEL_KEYWORDS.some((kw) => normalized.includes(kw));
}

export async function handleCancelConfirmation(
  context: FlowContext,
  requestsService: RequestsService,
  notificationService?: NotificationService,
): Promise<FlowStepResult> {
  const { session, message } = context;
  const tempData = (session.tempData as Record<string, unknown>) || {};
  const inputText = message.text?.trim().toLowerCase();

  const requestId = tempData.requestId as string;
  const userId = tempData.userId as string | undefined;

  if (!requestId) {
    return {
      response: { text: 'No se encontró un pedido activo para cancelar.' },
      nextStep: null,
      tempData: {},
    };
  }

  const resolved = inputText ? resolveOption('CANCEL_CONFIRMATION', inputText) : null;

  if (resolved === 'YES') {
    try {
      const result = await requestsService.cancelByUser(requestId);

      let responseText = 'Tu pedido fue cancelado. Si necesitás algo más, escribime.';

      if (userId) {
        const abuseDetection = new AbuseDetectionService();
        const abuseLevel = await abuseDetection.checkUserAbuse(userId);

        if (abuseLevel === 'warn') {
          await prisma.user.update({
            where: { id: userId },
            data: { abuseWarningCount: { increment: 1 } },
          });
          responseText += '\n\n⚠️ Notamos que cancelaste varios pedidos recientemente. Por favor usá NORA solo cuando realmente necesités el servicio. Si esto continúa, tu cuenta podría ser suspendida.';
        }

        if (abuseLevel === 'suspend') {
          await prisma.user.update({
            where: { id: userId },
            data: { status: 'BLOCKED' },
          });
        }
      }

      const newTempData: Record<string, unknown> = {};

      if (result.shouldNotifyProfessional && result.professionalPhone && result.professionalMessage) {
        newTempData.pendingNotification = {
          targetPhone: result.professionalPhone,
          targetRole: 'PROFESSIONAL',
          message: result.professionalMessage,
          flow: null,
          step: null,
          tempData: {},
        } satisfies PendingNotification;
      }

      return {
        response: { text: responseText },
        nextStep: null,
        tempData: newTempData,
      };
    } catch (err) {
      return {
        response: { text: 'Tu pedido ya fue cancelado anteriormente. Si necesitás algo más, escribime.' },
        nextStep: null,
        tempData: {},
      };
    }
  }

  if (resolved === 'NO') {
    const prevStep = tempData._previousStep as string | null;

    const cleanTempData: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(tempData)) {
      if (!key.startsWith('_previous') && key !== '_cancellationPending') {
        cleanTempData[key] = value;
      }
    }

    return {
      response: { text: 'Entendido, tu pedido sigue activo.' },
      nextStep: prevStep || null,
      tempData: cleanTempData,
    };
  }

  if (notificationService && tempData.phone && tempData.categoryName) {
    await notificationService.notifyUserCancelConfirmation(
      tempData.phone as string,
      tempData.categoryName as string,
    );
    return {
      response: { text: '' },
      nextStep: 'CANCEL_CONFIRMATION',
      tempData,
    };
  }

  const categoryName = (tempData.categoryName as string) || 'el servicio';

  return {
    response: {
      text: `¿Confirmás que querés cancelar tu pedido de ${categoryName}?\n1. Sí, cancelar\n2. No, seguir con el pedido`,
    },
    nextStep: 'CANCEL_CONFIRMATION',
    tempData,
  };
}
