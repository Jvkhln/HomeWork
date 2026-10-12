/**
 * Timezone: Asia/Ulaanbaatar (UTC+8)
 */

export const WEEKDAYS = [
  { id: 1, name: 'Даваа', short: 'Дав' },
  { id: 2, name: 'Мягмар', short: 'Мяг' },
  { id: 3, name: 'Лхагва', short: 'Лха' },
  { id: 4, name: 'Пүрэв', short: 'Пүр' },
  { id: 5, name: 'Баасан', short: 'Баа' },
] as const;

export const ALL_WEEKDAYS_WITH_WEEKEND = [
  ...WEEKDAYS,
  { id: 6, name: 'Бямба', short: 'Бям' },
  { id: 7, name: 'Ням', short: 'Ням' },
] as const;

export function getTodayUlaanbaatar(): string {
  // Asia/Ulaanbaatar is UTC+8
  const now = new Date();
  const ulaanbaatarTime = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ulaanbaatar',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(now);
  return ulaanbaatarTime; // Format: YYYY-MM-DD
}

export function getCurrentWeekday(): number {
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday, 1 is Monday...
  return day === 0 ? 7 : day;
}

export function getFormattedDate(isoDateStr: string): string {
  if (!isoDateStr) return '-';
  try {
    const [year, month, day] = isoDateStr.split('-');
    return `${year}.${month}.${day}`;
  } catch {
    return isoDateStr;
  }
}

export function getWeekRange(): { start: string; end: string } {
  const todayStr = getTodayUlaanbaatar();
  const today = new Date(todayStr + 'T00:00:00');
  const dayOfWeek = today.getDay(); // 0 is Sun, 1 is Mon...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  
  const monday = new Date(today);
  monday.setDate(today.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: formatDateToIso(monday),
    end: formatDateToIso(sunday)
  };
}

export function getMonthRange(yearMonth?: string): { start: string; end: string } {
  const todayStr = getTodayUlaanbaatar();
  const ym = yearMonth || todayStr.substring(0, 7); // YYYY-MM
  const [y, m] = ym.split('-').map(Number);
  
  const start = `${ym}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${ym}-${String(lastDay).padStart(2, '0')}`;
  
  return { start, end };
}

export function formatDateToIso(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isPastDueDate(dueDate: string): boolean {
  const today = getTodayUlaanbaatar();
  return dueDate < today;
}
