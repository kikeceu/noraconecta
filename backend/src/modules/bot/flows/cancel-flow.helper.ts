import { FlowStepResult, FlowContext, PendingNotification } from './types';
import { RequestsService } from '../../requests/requests.service';

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

function isAffirmative(text: string): boolean {
  const patterns = [
    'si', 'sí', 'dale', 'ok', 'okey', 'de acuerdo', 'bien', 'bueno',
    'perfecto', 'genial', 'joya', 'confirmado', 'me viene bien',
  ];
  const normalized = text.trim().toLowerCase();
  return patterns.some((p) => normalized.startsWith(p) || normalized === p);
}

function isNegative(text: string): boolean {
  const patterns = [
    'no', 'nop', 'nope', 'negativo', 'no puedo', 'no me viene bien',
    'no me sirve', 'no me queda', 'tampoco',
  ];
  const normalized = text.trim().toLowerCase();
  return patterns.some((p) => normalized.startsWith(p) || normalized === p);
}

export async function handleCancelConfirmation(
  context: FlowContext,
  requestsService: RequestsService,
): Promise<FlowStepResult> {
  const { session, message } = context;
  const tempData = (session.tempData as Record<string, unknown>) || {};
  const inputText = message.text?.trim().toLowerCase();

  const requestId = tempData.requestId as string;

  if (!requestId) {
    return {
      response: { text: 'No se encontró un pedido activo para cancelar.' },
      nextStep: null,
      tempData: {},
    };
  }

  if (isAffirmative(inputText || '')) {
    try {
      const result = await requestsService.cancelByUser(requestId);

      const responseText = 'Tu pedido fue cancelado. Si necesitás algo más, escribime.';

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
      const message = err instanceof Error ? err.message : 'Error al cancelar el pedido';

      return {
        response: { text: message },
        nextStep: null,
        tempData: {},
      };
    }
  }

  if (isNegative(inputText || '')) {
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

  return {
    response: {
      text: '¿Confirmás que querés cancelar tu pedido? Respondé Sí para confirmar o No para continuar.',
      options: ['Sí', 'No'],
    },
    nextStep: 'CANCEL_CONFIRMATION',
    tempData,
  };
}
