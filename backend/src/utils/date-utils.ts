import { callLLM } from '../lib/llm-client';

export type ParseDateTimeResult =
  | { success: true; date: Date }
  | { success: false; reason: 'ambiguous' | 'past' };

export function parseExactDate(input: string): Date | null {
  const trimmed = input.trim();
  console.log('[parseExactDate] input:', JSON.stringify(input), 'trimmed:', JSON.stringify(trimmed));

  const match = trimmed.match(/^(\d{2})\/(\d{2})\s+(\d{2})(?::(\d{2}))?$/);
  console.log('[parseExactDate] match:', match);

  if (!match) return null;

  const dd = match[1];
  const mm = match[2];
  const hh = match[3];
  const min = match[4] ?? '00';
  const day = parseInt(dd, 10);
  const month = parseInt(mm, 10);
  const hour = parseInt(hh, 10);
  const minute = parseInt(min, 10);

  if (day < 1 || day > 31) return null;
  if (month < 1 || month > 12) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;

  const year = new Date().getFullYear();
  const date = new Date(`${year}-${mm}-${dd}T${hh}:${min}:00-03:00`);

  if (isNaN(date.getTime())) return null;

  return date;
}

export async function parseDateTimeNatural(
  input: string,
  referenceDate: Date,
): Promise<ParseDateTimeResult> {
  const exact = parseExactDate(input);
  if (exact) {
    if (exact <= new Date()) {
      return { success: false, reason: 'past' };
    }
    return { success: true, date: exact };
  }

  const now = referenceDate.toLocaleString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  const todayArg = new Date(referenceDate.getTime() - 3 * 60 * 60 * 1000);
  const nextDays = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(todayArg);
    d.setUTCDate(d.getUTCDate() + i + 1);
    const dayName = dayNames[d.getUTCDay()];
    const day = d.getUTCDate().toString().padStart(2, '0');
    const month = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    return `${dayName} ${day}/${month}`;
  }).join(', ');

  const prompt = `Hoy es ${now}, zona horaria Argentina (UTC-3).
Los próximos 8 días son: ${nextDays}.
El usuario escribió: "${input}"
Interpretá la fecha y hora mencionada. Usá la lista de días para calcular correctamente cuándo es "el sábado", "el próximo viernes", etc. — nunca uses una fecha pasada.
Devolvé SOLO un JSON válido sin markdown:
{"date": "YYYY-MM-DDTHH:MM:00-03:00"}
Si es ambiguo o no se puede determinar, devolvé:
{"error": "ambiguo"}`;

console.log('[parseDateTimeNatural] now:', now);
console.log('[parseDateTimeNatural] nextDays:', nextDays);
console.log('[parseDateTimeNatural] input:', input);

  try {
    const response = await callLLM(prompt);
    console.log('[parseDateTimeNatural] response:', response);
    const parsed = JSON.parse(response.trim());
    if (parsed.error) return { success: false, reason: 'ambiguous' };
    if (parsed.date) {
      const date = new Date(parsed.date);
      if (date <= new Date()) return { success: false, reason: 'past' };
      return { success: true, date };
    }
    return { success: false, reason: 'ambiguous' };
  } catch (err) {
    console.error('[parseDateTimeNatural] LLM call failed:', err);
    return { success: false, reason: 'ambiguous' };
  }
}

const ARGENTINA_OFFSET_MS = 3 * 60 * 60 * 1000;

export function getDayArgentina(date: Date): number {
  const ar = new Date(date.getTime() - ARGENTINA_OFFSET_MS);
  return ar.getUTCDay();
}

export function getHoursArgentina(date: Date): number {
  return new Date(date.getTime() - ARGENTINA_OFFSET_MS).getUTCHours();
}

export function getMinutesArgentina(date: Date): number {
  return new Date(date.getTime() - ARGENTINA_OFFSET_MS).getUTCMinutes();
}

export function formatDateTimeArgentina(date: Date): string {
  const ar = new Date(date.getTime() - ARGENTINA_OFFSET_MS);
  const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  const dayName = dayNames[ar.getUTCDay()];
  const day = ar.getUTCDate();
  const monthName = monthNames[ar.getUTCMonth()];
  const hours = ar.getUTCHours().toString().padStart(2, '0');
  const minutes = ar.getUTCMinutes().toString().padStart(2, '0');

  return `${dayName} ${day} de ${monthName} a las ${hours}:${minutes}`;
}
