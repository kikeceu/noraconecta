export interface StepOption {
  value: string;
  aliases: string[];
}

export const STEP_OPTIONS: Record<string, StepOption[]> = {
  AWAITING_ACCEPTANCE: [
    { value: 'ACCEPT', aliases: ['1', 'aceptar', 'acepto', 'si', 'sí', 'dale', 'ok'] },
    { value: 'REJECT', aliases: ['2', 'rechazar', 'rechazo', 'no', 'no_puedo'] },
  ],
  AWAITING_CONFIRMATION: [
    {
      value: 'CONFIRM',
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
  ],
  AWAITING_USER_CONFIRMATION: [
    { value: 'YES', aliases: ['si', 'sí', 'dale', 'ok', 'okey', 'vale', 'claro', 'de acuerdo', '1', 'si_me_viene'] },
    { value: 'NO', aliases: ['no', 'nop', 'nope', 'negativo', 'no puedo', '2', 'no_me_viene'] },
  ],
  AWAITING_VISIT_CONFIRMATION: [
    {
      value: 'CONFIRM',
      aliases: ['confirmo', 'si', 'sí', 'ok', 'dale', 'confirmar', 'confirmado', '1', 'confirmo_visita'],
    },
    {
      value: 'CANCEL',
      aliases: ['cancelar', 'cancelo', 'no puedo', 'no voy', '2', 'no_puedo_ir'],
    },
  ],
  CANCEL_CONFIRMATION: [
    { value: 'YES', aliases: ['si', 'sí', 'dale', 'ok', '1'] },
    { value: 'NO', aliases: ['no', 'nop', '2'] },
  ],
  CONFIRM: [
    { value: 'YES', aliases: ['si', 'sí', 'dale', 'ok', '1'] },
    { value: 'NO', aliases: ['no', 'nop', '2'] },
  ],
  WAITING_CONSENT: [
    { value: 'YES', aliases: ['si', 'sí', 'dale', 'ok', '1'] },
    { value: 'NO', aliases: ['no', 'nop', '2'] },
  ],
  AWAITING_WORK_COMPLETION: [
    { value: 'DONE', aliases: ['1', 'finalice', 'finalicé', 'termine', 'terminé', 'listo', 'hecho', 'si_finalice'] },
    { value: 'PENDING', aliases: ['2', 'pendiente', 'no', 'todavia no', 'todavía no', 'no pude completarlo', 'no_pude'] },
  ],
  FEEDBACK_SATISFACTION: [
    { value: 'SATISFIED', aliases: ['conforme', 'todo bien', 'bien', 'ok', '1', 'conforme_btn'] },
    { value: 'PARTIAL', aliases: ['con observaciones', 'observaciones', 'mas o menos', 'más o menos', '2', 'observaciones_btn'] },
    { value: 'UNSATISFIED', aliases: ['no conforme', 'mal', 'no', 'insatisfecho', '3', 'no_conforme_btn'] },
  ],
  FEEDBACK_RECOMMEND: [
    { value: 'YES', aliases: ['si', 'sí', 'claro', 'por supuesto', '1', 'si_recomiendo'] },
    { value: 'NO', aliases: ['no', '2', 'no_recomiendo'] },
  ],
  FEEDBACK_PRO_RECOMMEND: [
    { value: 'YES', aliases: ['si', 'sí', 'claro', 'por supuesto', '1', 'si_volveria'] },
    { value: 'NO', aliases: ['no', '2', 'no_volveria'] },
  ],
};

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
