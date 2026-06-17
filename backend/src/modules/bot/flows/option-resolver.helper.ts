import { callLLM } from '../../../lib/llm-client';
import { BOT_PAYLOADS } from '../constants/bot-payloads';

export interface StepOption {
  value: string;
  label: string;
  aliases: string[];
}

export const STEP_OPTIONS: Record<string, StepOption[]> = {
  AWAITING_ACCEPTANCE: [
    { value: 'VER_DETALLES', label: 'Ver detalles', aliases: ['1', 'ver detalles', 'detalle', 'detalles', 'ver pedido', BOT_PAYLOADS.VER_DETALLES] },
    { value: 'REJECT', label: 'Rechazar', aliases: ['2', 'rechazar', 'rechazo', 'no', BOT_PAYLOADS.NO_PUEDO] },
    { value: 'ACCEPT', label: 'Aceptar', aliases: ['aceptar', 'acepto', 'si', 'sí', 'dale', 'ok', 'aceptar_pedido'] },
  ],
  AWAITING_CONFIRMATION: [
    {
      value: 'CONFIRM',
      label: 'Confirmar horario',
      aliases: [
        'si',
        'sí',
        'dale',
        'ok',
        'okey',
        'vale',
        'claro',
        'confirmado',
        'me viene bien',
        'de acuerdo',
        'bien',
        'bueno',
        'perfecto',
        'genial',
        'joya',
        '1',
      ],
    },
    {
      value: 'PROPOSE_ALTERNATIVE',
      label: 'Proponer otro horario',
      aliases: [
        '2',
        'proponer',
        'otro horario',
        'no puedo',
        'cambiar horario',
        'propongo otro',
      ],
    },
  ],
  CONFIRM_AVAILABILITY: [
    { value: 'YES', label: 'Sí', aliases: ['si', 'sí', 'dale', 'ok', 'confirmo', '1'] },
    { value: 'NO', label: 'No, corregir', aliases: ['no', 'nop', 'corregir', '2'] },
  ],
  CONFIRM_PRO_AVAILABILITY: [
    { value: 'YES', label: 'Sí', aliases: ['si', 'sí', 'dale', 'ok', 'confirmo', '1'] },
    { value: 'NO', label: 'No, corregir', aliases: ['no', 'nop', 'corregir', '2'] },
  ],
  AWAITING_USER_CONFIRMATION: [
    { value: 'YES', label: 'Sí, me viene bien', aliases: ['si', 'sí', 'dale', 'ok', 'okey', 'vale', 'claro', 'de acuerdo', '1', BOT_PAYLOADS.SI_ME_VIENE] },
    { value: 'NO', label: 'No, no me viene', aliases: ['no', 'nop', 'nope', 'negativo', 'no puedo', '2', BOT_PAYLOADS.NO_ME_VIENE] },
  ],
  AWAITING_VISIT_CONFIRMATION: [
    {
      value: 'CONFIRM',
      label: 'Confirmar visita',
      aliases: ['confirmo', 'si', 'sí', 'ok', 'dale', 'confirmar', 'confirmado', '1', BOT_PAYLOADS.CONFIRMO_VISITA],
    },
    {
      value: 'CANCEL',
      label: 'Cancelar visita',
      aliases: ['cancelar', 'cancelo', 'no puedo', 'no voy', '2', BOT_PAYLOADS.NO_PUEDO_IR],
    },
  ],
  CANCEL_CONFIRMATION: [
    { value: 'YES', label: 'Sí, cancelar', aliases: ['si', 'sí', 'dale', 'ok', '1', 'cancelar_pedido'] },
    { value: 'NO', label: 'No, seguir con el pedido', aliases: ['no', 'nop', '2', 'no_cancelar'] },
  ],
  CONFIRM: [
    { value: 'YES', label: 'Sí', aliases: ['si', 'sí', 'dale', 'ok', '1'] },
    { value: 'NO', label: 'No', aliases: ['no', 'nop', '2'] },
  ],
  WAITING_CONSENT: [
    { value: 'YES', label: 'Sí, avisame', aliases: ['si', 'sí', 'dale', 'ok', '1', BOT_PAYLOADS.NOTIFY_WHEN_AVAILABLE] },
    { value: 'NO', label: 'No, gracias', aliases: ['no', 'nop', '2', BOT_PAYLOADS.NO_NOTIFY] },
  ],
  AWAITING_WORK_COMPLETION: [
    { value: 'DONE', label: 'Sí, finalicé', aliases: ['1', 'finalice', 'finalicé', 'termine', 'terminé', 'listo', 'hecho', BOT_PAYLOADS.SI_FINALICE] },
    { value: 'PENDING', label: 'No, todavía no', aliases: ['2', 'pendiente', 'no', 'todavia no', 'todavía no', 'no pude completarlo', BOT_PAYLOADS.NO_PUDE] },
  ],
  FEEDBACK_SATISFACTION: [
    { value: 'SATISFIED', label: 'Conforme', aliases: ['conforme', 'todo bien', 'bien', 'ok', '1', BOT_PAYLOADS.CONFORME_BTN] },
    { value: 'PARTIAL', label: 'Con observaciones', aliases: ['con observaciones', 'observaciones', 'mas o menos', 'más o menos', '2', BOT_PAYLOADS.OBSERVACIONES_BTN] },
    { value: 'UNSATISFIED', label: 'No conforme', aliases: ['no conforme', 'mal', 'no', 'insatisfecho', '3', BOT_PAYLOADS.NO_CONFORME_BTN] },
  ],
  FEEDBACK_RECOMMEND: [
    { value: 'YES', label: 'Sí, lo recomendaría', aliases: ['si', 'sí', 'claro', 'por supuesto', '1', 'si_recomiendo'] },
    { value: 'NO', label: 'No lo recomendaría', aliases: ['no', '2', 'no_recomiendo'] },
  ],
  FEEDBACK_PRO_RECOMMEND: [
    { value: 'YES', label: 'Sí, volvería a atenderlo', aliases: ['si', 'sí', 'claro', 'por supuesto', '1', 'si_volveria'] },
    { value: 'NO', label: 'No volvería', aliases: ['no', '2', 'no_volveria'] },
  ],
  DESCRIPTION_MISMATCH: [
    { value: 'CHANGE_SERVICE', label: 'Cambiar servicio', aliases: ['1', 'cambiar', 'cambiar servicio', 'cambiar el servicio', BOT_PAYLOADS.CAMBIAR_SERVICIO] },
    { value: 'REFORMULATE', label: 'Reformular descripción', aliases: ['2', 'reformular', 'reformular descripcion', 'corregir', BOT_PAYLOADS.REFORMULAR_DESCRIPCION] },
    { value: 'SI_CORRECTO', label: 'Sí, es correcto', aliases: [BOT_PAYLOADS.SI_CORRECTO, 'si es correcto', 'sí es correcto', 'correcto'] },
  ],
  ASK_SAVED_LOCATION_SINGLE: [
    { value: 'YES', label: 'Sí', aliases: ['1', 'si', 'sí', 'dale', 'ok'] },
    { value: 'NO', label: 'No, es otra ubicación', aliases: ['2', 'no', 'nop', 'es otra', 'otra', 'otra ubicacion'] },
  ],
  POST_CANCEL: [
    { value: 'NEW_REQUEST', label: 'Iniciar un nuevo pedido', aliases: ['1', 'iniciar', 'nuevo pedido', 'si', 'sí', 'quiero otro'] },
    { value: 'NO', label: 'Por ahora no, gracias', aliases: ['2', 'no', 'por ahora no', 'gracias', 'no gracias'] },
  ],
};

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

export function resolveOption(step: string, input: string): string | null {
  const options = STEP_OPTIONS[step];
  if (!options) return null;

  const normalized = input.trim().toLowerCase();
  for (const option of options) {
    if (option.aliases.includes(normalized)) {
      return option.value;
    }
  }

  return null;
}

export async function resolveOptionWithFallback(
  step: string,
  input: string,
): Promise<string | null> {
  const exact = resolveOption(step, input);
  if (exact !== null) return exact;

  const options = STEP_OPTIONS[step];
  if (!options) return null;

  const normalizedInput = normalizeText(input);
  for (const option of options) {
    const normalizedLabel = normalizeText(option.label);
    if (normalizedInput === normalizedLabel || normalizedLabel === normalizedInput) {
      return option.value;
    }
  }

  const optionsList = options
    .map(o => `- ${o.value}: "${o.label}" (también acepta: ${o.aliases.filter(a => !['1','2','3','4','5','6','7','8','9'].includes(a)).slice(0, 3).join(', ')})`)
    .join('\n');

  const prompt = `Sos NORA, asistente de WhatsApp en Argentina. El usuario está respondiendo a una pregunta con opciones.

El usuario escribió: "${input}"

Opciones disponibles:
${optionsList}

¿A cuál opción se refiere el usuario? Respondé SOLO con el valor exacto (ej: YES, NO, ACCEPT, CONFIRM, etc.) o "null" si genuinamente no está claro.`;

  try {
    const response = await callLLM(prompt);
    const trimmed = response.trim().toUpperCase();
    const validValues = options.map(o => o.value);
    if (validValues.includes(trimmed)) return trimmed;
    return null;
  } catch {
    return null;
  }
}

export async function generateOffTopicResponse(
  input: string,
  stepContext: string,
): Promise<string | null> {
  const prompt = `Sos NORA, un asistente de WhatsApp que conecta usuarios con profesionales del hogar en Argentina.

El usuario escribió: "${input}"

Contexto actual: ${stepContext}

Determiná si el mensaje es:
1. OFF_TOPIC: un saludo, pregunta sobre vos, comentario casual, o algo no relacionado con el pedido
2. ON_TOPIC: un intento de responder al contexto actual aunque mal escrito

Si es OFF_TOPIC, generá una respuesta corta y cordial en español rioplatense que:
- Responda brevemente al comentario (ej: si saluda, saludar de vuelta)
- Recuerde el contexto actual
- No supere 2 líneas

Si es ON_TOPIC, respondé exactamente: ON_TOPIC

Respondé SOLO con la respuesta cordial o "ON_TOPIC".`;

  try {
    const response = await callLLM(prompt);
    const trimmed = response.trim();
    return trimmed === 'ON_TOPIC' ? null : trimmed;
  } catch {
    return null;
  }
}
