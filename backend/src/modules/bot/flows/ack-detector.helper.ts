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

export function isAckMessage(text: string): boolean {
  const normalized = text
    .trim()
    .toLowerCase()
    .replace(/!+$/, '')
    .replace(/(.)\1+/g, '$1'); // colapsa letras repetidas: "daale" → "dale", "okk" → "ok"
  return ACK_KEYWORDS.some((kw) => normalized === kw);
}
