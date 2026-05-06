// All dates flow as YYYY-MM-DD strings ("date keys") in server local time
// (server runs with TZ=Asia/Shanghai per .env).

export const CHINESE_MONTHS = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
] as const;

export const WEEKDAY_LABELS_CN = ["一", "二", "三", "四", "五", "六", "日"] as const;

export function formatDateKey(d: Date): string {
  // 'sv-SE' locale yields YYYY-MM-DD. Honors TZ env on Node.
  return d.toLocaleDateString("sv-SE");
}

export function todayKey(): string {
  return formatDateKey(new Date());
}

export interface DayCell { key: string; day: number; inMonth: true }

/** 6×7 = 42 cells, Mon-first. Out-of-month slots are null. month is 1-indexed. */
export function monthGrid(year: number, month: number): (DayCell | null)[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  // JS getDay: Sun=0..Sat=6. We want Mon=0..Sun=6.
  const firstWeekdayMon = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < firstWeekdayMon; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ key: `${year}-${mm}-${dd}`, day: d, inMonth: true });
  }
  while (cells.length < 42) cells.push(null);
  return cells;
}

export function shiftMonth(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function weekRange(key: string): { start: string; end: string } {
  const d = parseKey(key);
  const dowMon = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dowMon);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { start: formatDateKey(monday), end: formatDateKey(sunday) };
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}
