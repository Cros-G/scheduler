import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  todayKey,
  weekRange,
  monthRange,
  formatDateKey,
} from "@/lib/dates";
import {
  computeTaskStats,
  computeStreaks,
  computeHeatmap,
} from "@/lib/stats";
import { StatsView } from "./stats-view";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    d?: string;
    y?: string;
    m?: string;
  }>;
}) {
  const user = await requireAuth();
  const { period: rawPeriod, d: rawD, y: rawY, m: rawM } = await searchParams;

  // ── Determine period ──────────────────────────────────────────────────────
  let period: "year" | "month" | "week" = "month";
  if (rawPeriod === "year") period = "year";
  else if (rawPeriod === "week") period = "week";
  else period = "month";

  // ── Determine anchor date ─────────────────────────────────────────────────
  const now = new Date();
  const defaultAnchor = formatDateKey(now);

  let anchorKey: string = defaultAnchor;

  if (period === "year") {
    if (rawD && /^\d{4}-\d{2}-\d{2}$/.test(rawD)) {
      anchorKey = rawD;
    } else if (rawY) {
      const y = parseInt(rawY, 10);
      if (!isNaN(y) && y >= 2000 && y <= 2100) {
        anchorKey = `${y}-01-01`;
      }
    }
  } else if (period === "month") {
    if (rawD && /^\d{4}-\d{2}-\d{2}$/.test(rawD)) {
      anchorKey = rawD;
    } else if (rawY || rawM) {
      const y = parseInt(rawY ?? String(now.getFullYear()), 10);
      const m = parseInt(rawM ?? String(now.getMonth() + 1), 10);
      if (!isNaN(y) && !isNaN(m) && y >= 2000 && y <= 2100 && m >= 1 && m <= 12) {
        anchorKey = `${y}-${String(m).padStart(2, "0")}-01`;
      }
    }
  } else {
    // week
    if (rawD && /^\d{4}-\d{2}-\d{2}$/.test(rawD)) {
      anchorKey = rawD;
    }
  }

  // ── Compute range ─────────────────────────────────────────────────────────
  let rangeStart: string;
  let rangeEnd: string;

  if (period === "year") {
    const year = parseInt(anchorKey.slice(0, 4), 10);
    rangeStart = `${year}-01-01`;
    rangeEnd = `${year}-12-31`;
  } else if (period === "month") {
    const [ay, am] = anchorKey.split("-").map(Number);
    const r = monthRange(ay, am);
    rangeStart = r.start;
    rangeEnd = r.end;
  } else {
    const r = weekRange(anchorKey);
    rangeStart = r.start;
    rangeEnd = r.end;
  }

  // ── Fetch data ────────────────────────────────────────────────────────────
  // Tasks: ALL (including archived) so historical stats work
  const tasks = await prisma.task.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  // Ranged occurrences: for taskStats + heatmap
  const rangedOccurrences = await prisma.occurrence.findMany({
    where: {
      userId: user.id,
      date: { gte: rangeStart, lte: rangeEnd },
    },
  });

  // All occurrences: for streak calculation (global, not period-scoped)
  const allOccurrences = await prisma.occurrence.findMany({
    where: { userId: user.id },
  });

  // ── Compute stats ─────────────────────────────────────────────────────────
  const currentTodayKey = todayKey();

  const taskStats = computeTaskStats(
    tasks,
    rangedOccurrences,
    rangeStart,
    rangeEnd,
    period
  );

  const streaks = computeStreaks(tasks, allOccurrences, currentTodayKey);

  const heatmap = computeHeatmap(rangedOccurrences, rangeStart, rangeEnd);

  // Minimal occurrence shape for client-side heatmap filtering
  const occurrencesForClient = rangedOccurrences.map((o) => ({
    id: o.id,
    taskId: o.taskId,
    date: o.date,
    count: o.count,
  }));

  // Minimal task shape for the filter dropdown
  const tasksForClient = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    icon: t.icon,
  }));

  return (
    <StatsView
      period={period}
      anchorKey={anchorKey}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      taskStats={taskStats}
      streaks={streaks}
      heatmap={heatmap}
      todayKey={currentTodayKey}
      occurrences={occurrencesForClient}
      tasks={tasksForClient}
    />
  );
}
