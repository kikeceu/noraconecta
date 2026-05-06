export function parseExactDate(input: string): Date | null {
  const trimmed = input.trim();
  console.log('[parseExactDate] input:', JSON.stringify(input), 'trimmed:', JSON.stringify(trimmed));

  const match = trimmed.match(/^(\d{2})\/(\d{2})\s+(\d{2}):(\d{2})$/);
  console.log('[parseExactDate] match:', match);

  if (!match) return null;

  const [, dd, mm, hh, min] = match;
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
  if (date < new Date()) return null;

  return date;
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
  const day = ar.getUTCDate().toString().padStart(2, '0');
  const month = (ar.getUTCMonth() + 1).toString().padStart(2, '0');
  const hours = ar.getUTCHours().toString().padStart(2, '0');
  const minutes = ar.getUTCMinutes().toString().padStart(2, '0');
  return `${day}/${month} ${hours}:${minutes}`;
}
