import type { Task, Occurrence, TaskType, Period } from "@prisma/client";
import { weekRange } from "@/lib/dates";

// ── Types ──────────────────────────────────────────────────────

export interface TaskStatsRow {
  taskId: number;
  taskName: string;
  taskIcon: string;
  taskColor: string;
  taskType: TaskType;
  taskTargetCount: number | null;
  taskTargetPeriod: Period | null;
  totalCount: number;
  // For COUNTED tasks: fraction (0-1) of sub-periods that hit the target.
  // For CHECK tasks: null.
  targetHitRate: number | null;
}

export interface StreakRow {
  taskId: number;
  taskName: string;
  taskIcon: string;
  taskColor: string;
  currentStreak: number;
  longestStreak: number;
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  totalCount: number;
}

// ── colorBucket ────────────────────────────────────────────────

export function colorBucket(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count <= 3) return 1;
  if (count <= 7) return 2;
  if (count <= 15) return 3;
  return 4;
}

// ── helpers ────────────────────────────────────────────────────

function isInRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function addDays(key: string, days: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Enumerate all date keys in [start, end]
function enumerateDates(start: string, end: string): string[] {
  const result: string[] = [];
  let cur = start;
  while (cur <= end) {
    result.push(cur);
    cur = addDays(cur, 1);
  }
  return result;
}

// Bucket dates by period: for DAY → each date is its own key;
// for WEEK → map each date to its ISO Monday;
// for MONTH → map each date to YYYY-MM.
function periodKey(date: string, period: Period): string {
  if (period === "DAY") return date;
  if (period === "WEEK") return weekRange(date).start;
  // MONTH
  return date.slice(0, 7);
}

// ── computeTaskStats ──────────────────────────────────────────

export function computeTaskStats(
  tasks: Task[],
  occurrences: Occurrence[],
  rangeStart: string,
  rangeEnd: string,
  _period: "year" | "month" | "week"
): TaskStatsRow[] {
  // Index occurrences by taskId, within range
  const byTask = new Map<number, Occurrence[]>();
  for (const o of occurrences) {
    if (!isInRange(o.date, rangeStart, rangeEnd)) continue;
    const list = byTask.get(o.taskId) ?? [];
    list.push(o);
    byTask.set(o.taskId, list);
  }

  const allDates = enumerateDates(rangeStart, rangeEnd);

  return tasks.map((task) => {
    const occs = byTask.get(task.id) ?? [];
    const totalCount = occs.reduce((s, o) => s + o.count, 0);

    let targetHitRate: number | null = null;
    if (task.type === "COUNTED" && task.targetCount != null && task.targetPeriod != null) {
      // Group occurrences' counts by period bucket
      const sums = new Map<string, number>();
      for (const o of occs) {
        const k = periodKey(o.date, task.targetPeriod);
        sums.set(k, (sums.get(k) ?? 0) + o.count);
      }
      // Enumerate distinct periods in range
      const periodKeys = new Set<string>();
      for (const d of allDates) {
        periodKeys.add(periodKey(d, task.targetPeriod));
      }
      const totalPeriods = periodKeys.size;
      let hits = 0;
      for (const k of periodKeys) {
        if ((sums.get(k) ?? 0) >= task.targetCount) hits++;
      }
      targetHitRate = totalPeriods === 0 ? 0 : hits / totalPeriods;
    }

    return {
      taskId: task.id,
      taskName: task.name,
      taskIcon: task.icon,
      taskColor: task.color,
      taskType: task.type,
      taskTargetCount: task.targetCount,
      taskTargetPeriod: task.targetPeriod,
      totalCount,
      targetHitRate,
    };
  });
}

// ── computeStreaks ────────────────────────────────────────────

export function computeStreaks(
  tasks: Task[],
  occurrences: Occurrence[],
  todayKey: string
): StreakRow[] {
  const checkTasks = tasks.filter((t) => t.type === "CHECK");

  return checkTasks.map((task) => {
    // Get sorted unique dates this task was checked
    const dates = Array.from(
      new Set(occurrences.filter((o) => o.taskId === task.id).map((o) => o.date))
    ).sort();

    let longest = 0;
    let cur = 0;
    let prev: string | null = null;
    for (const d of dates) {
      if (prev !== null && addDays(prev, 1) === d) {
        cur++;
      } else {
        cur = 1;
      }
      if (cur > longest) longest = cur;
      prev = d;
    }

    // Current streak: count back from today
    const set = new Set(dates);
    let currentStreak = 0;
    let cursor = todayKey;
    while (set.has(cursor)) {
      currentStreak++;
      cursor = addDays(cursor, -1);
    }

    return {
      taskId: task.id,
      taskName: task.name,
      taskIcon: task.icon,
      taskColor: task.color,
      currentStreak,
      longestStreak: longest,
    };
  });
}

// ── computeHeatmap ────────────────────────────────────────────

export function computeHeatmap(
  occurrences: { date: string; count: number }[],
  rangeStart: string,
  rangeEnd: string
): HeatmapDay[] {
  const sums = new Map<string, number>();
  for (const o of occurrences) {
    if (!isInRange(o.date, rangeStart, rangeEnd)) continue;
    sums.set(o.date, (sums.get(o.date) ?? 0) + o.count);
  }
  return enumerateDates(rangeStart, rangeEnd).map((d) => ({
    date: d,
    totalCount: sums.get(d) ?? 0,
  }));
}
