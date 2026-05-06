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
