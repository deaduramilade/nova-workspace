const STORAGE_KEY = 'nova_working_hours';

export interface DayHours {
  date: string;
  seconds: number;
}

export interface LocalHoursLedger {
  [date: string]: number;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatHoursMinutes(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

export function formatHoursDecimal(totalSeconds: number): string {
  return `${(totalSeconds / 3600).toFixed(1)}h`;
}

export function getLocalHours(): LocalHoursLedger {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalHours(ledger: LocalHoursLedger) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger));
}

export function tickLocalHours(seconds = 1): number {
  const ledger = getLocalHours();
  const today = todayKey();
  ledger[today] = (ledger[today] ?? 0) + seconds;
  saveLocalHours(ledger);
  return ledger[today];
}

export function getTodayLocalSeconds(): number {
  return getLocalHours()[todayKey()] ?? 0;
}

export function getWeekLocalSeconds(): number {
  const ledger = getLocalHours();
  return Object.values(ledger).reduce((a, b) => a + b, 0);
}