export interface StepOption {
  value: string;
  aliases: string[];
}

export const STEP_OPTIONS: Record<string, StepOption[]> = {
  AWAITING_ACCEPTANCE: [
    { value: 'ACCEPT', aliases: ['1', 'aceptar', 'acepto', 'si', 'sí', 'dale', 'ok'] },
    { value: 'REJECT', aliases: ['2', 'rechazar', 'rechazo', 'no'] },
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
    { value: 'YES', aliases: ['si', 'sí', 'dale', 'ok', 'okey', 'vale', 'claro', 'de acuerdo', '1'] },
    { value: 'NO', aliases: ['no', 'nop', 'nope', 'negativo', 'no puedo', '2'] },
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
