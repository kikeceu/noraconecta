const ACK_KEYWORDS = [
  // Ok y variantes
  'ok', 'oka', 'okas', 'okay', 'okey', 'okk', 'okei', 'oki', 'okis',
  // Gracias y variantes
  'gracias', 'gracia', 'gracais', 'garcias', 'grcias',
  // Dale y variantes
  'dale', 'dali', 'dal',
  // Perfecto y variantes
  'perfecto', 'perecto', 'prfecto', 'perfcto',
  // Bueno/bien
  'bien', 'bein', 'bie', 'bueno',
  // Sí
  'si', 'sí', 'sis', 'yes', 'yep', 'yap', 'ya',
  // Jerga argentina
  'joya', 'joyita', 'copado', 'copada', 'copao', 'piola',
  'genial', 'bárbaro', 'barbaro', 'de una', 'deuna',
  'buenísimo', 'buenisimo', 'excelente', 're bien',
  're copado', 're piola', 'de nada',
  // Entendido y variantes
  'entendido', 'entendio', 'entendi', 'enterado', 'enterao',
  'listo', 'lisot',
  // Otros
  'ta bien', 'tá bien', 'ta bn', 'tbn', 'ok gracias',
  'okey gracias', 'dale gracias', 'jajaja', 'jaja', 'ja',
  // Emojis
  '👍', '👍👍', '🙌', '✅', '💪', '🤙', '❤️', '😊', '🙏',
];

// Steps where Nora only notifies — she asks no questions and presents no options.
// Safe default: any step NOT listed here IS CONSIDERED to expect user input.
// Only add steps where Nora confirms something without asking anything in return.
const INFORMATIONAL_STEPS: Record<string, 'USER' | 'PROFESSIONAL' | 'BOTH'> = {
  'AWAITING_VISIT': 'BOTH',      // visit coordinated — Nora informs, asks nothing
  'AWAITING_ACCEPTANCE': 'PROFESSIONAL', // professional is waiting for acceptance — Nora only informs the pro
};

export function stepIsInformational(
  step: string | null | undefined,
  role: 'USER' | 'PROFESSIONAL',
): boolean {
  if (!step) return true; // no active step = no conversational context = silence ack
  const entry = INFORMATIONAL_STEPS[step];
  if (!entry) return false;
  return entry === 'BOTH' || entry === role;
}

export function isAckMessage(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/!+$/, '')
    .replace(/(.)\1+/g, '$1'); // collapse repeated letters: "daale" → "dale", "okk" → "ok"
  return ACK_KEYWORDS.some((kw) => normalized === kw);
}
