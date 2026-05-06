import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateKey, todayKey, weekRange, monthRange } from "@/lib/dates";
import { WeekView } from "../week-view";

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const user = await requireAuth();
  const { d } = await searchParams;

  // Default to today if no param
  const defaultKey = todayKey();

  let dateKey = defaultKey;
  if (d !== undefined) {
    // Validate YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      redirect("/week");
    }
    const parsed = new Date(d + "T00:00:00");
    if (isNaN(parsed.getTime())) {
      redirect("/week");
    }
    // Re-format to ensure canonical form
    dateKey = formatDateKey(parsed);
    if (dateKey !== d) {
      redirect("/week");
    }
  }

  const { start, end } = weekRange(dateKey);

  // Fetch active tasks
  const tasks = await prisma.task.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });

  // Fetch occurrences in this week
  const occurrences = await prisma.occurrence.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lte: end },
    },
    include: {
      task: {
        select: { id: true, name: true, icon: true, color: true, type: true },
      },
    },
  });

  // Aggregate: Record<DateKey, AggEntry[]>
  type AggEntry = {
    taskId: number;
    name: string;
    icon: string;
    color: string;
    type: string;
    totalCount: number;
    occurrenceIds: number[];
  };
  const occurrencesByDate: Record<string, AggEntry[]> = {};

  for (const occ of occurrences) {
    const key = occ.date;
    if (!occurrencesByDate[key]) {
      occurrencesByDate[key] = [];
    }
    const existing = occurrencesByDate[key].find((e) => e.taskId === occ.taskId);
    if (existing) {
      existing.totalCount += occ.count;
      existing.occurrenceIds.push(occ.id);
    } else {
      occurrencesByDate[key].push({
        taskId: occ.taskId,
        name: occ.task.name,
        icon: occ.task.icon,
        color: occ.task.color,
        type: occ.task.type,
        totalCount: occ.count,
        occurrenceIds: [occ.id],
      });
    }
  }

  // ── Progress aggregations for COUNTED tasks (always based on TODAY's periods) ──
  const todayK = todayKey();
  const todayWeekR = weekRange(todayK);
  const now2 = new Date();
  const todayYear = now2.getFullYear();
  const todayMonth = now2.getMonth() + 1;
  const monthR = monthRange(todayYear, todayMonth);

  const [dayAgg, weekAgg, monthAgg] = await Promise.all([
    prisma.occurrence.groupBy({
      by: ["taskId"],
      where: { userId: user.id, date: { equals: todayK } },
      _sum: { count: true },
    }),
    prisma.occurrence.groupBy({
      by: ["taskId"],
      where: { userId: user.id, date: { gte: todayWeekR.start, lte: todayWeekR.end } },
      _sum: { count: true },
    }),
    prisma.occurrence.groupBy({
      by: ["taskId"],
      where: { userId: user.id, date: { gte: monthR.start, lte: monthR.end } },
      _sum: { count: true },
    }),
  ]);

  const progressByTaskId: Record<number, { day: number; week: number; month: number }> = {};
  for (const row of dayAgg) {
    if (!progressByTaskId[row.taskId]) progressByTaskId[row.taskId] = { day: 0, week: 0, month: 0 };
    progressByTaskId[row.taskId].day = row._sum.count ?? 0;
  }
  for (const row of weekAgg) {
    if (!progressByTaskId[row.taskId]) progressByTaskId[row.taskId] = { day: 0, week: 0, month: 0 };
    progressByTaskId[row.taskId].week = row._sum.count ?? 0;
  }
  for (const row of monthAgg) {
    if (!progressByTaskId[row.taskId]) progressByTaskId[row.taskId] = { day: 0, week: 0, month: 0 };
    progressByTaskId[row.taskId].month = row._sum.count ?? 0;
  }

  // Fetch notes for this week
  const notes = await prisma.dailyNote.findMany({
    where: {
      userId: user.id,
      date: { gte: start, lte: end },
    },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
    },
  });
  const notesByDate = Object.fromEntries(notes.map((n) => [n.date, n]));

  const currentTodayKey = todayKey();

  return (
    <WeekView
      weekStart={start}
      weekEnd={end}
      dKey={dateKey}
      tasks={tasks}
      occurrencesByDate={occurrencesByDate}
      notesByDate={notesByDate}
      todayKey={currentTodayKey}
      progressByTaskId={progressByTaskId}
    />
  );
}
