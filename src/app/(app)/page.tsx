import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  formatDateKey,
  todayKey,
  monthRange,
  CHINESE_MONTHS,
} from "@/lib/dates";
import { MonthView } from "./month-view";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const user = await requireAuth();
  const { y, m } = await searchParams;

  // Default to today's year/month
  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  let year = defaultYear;
  let month = defaultMonth;

  if (y !== undefined || m !== undefined) {
    const parsedYear = parseInt(y ?? "", 10);
    const parsedMonth = parseInt(m ?? "", 10);
    const yearValid = !isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100;
    const monthValid = !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12;
    if (!yearValid || !monthValid) {
      redirect("/");
    }
    year = parsedYear;
    month = parsedMonth;
  }

  // Fetch active tasks
  const tasks = await prisma.task.findMany({
    where: { userId: user.id, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });

  // Fetch occurrences in the current month
  const { start, end } = monthRange(year, month);
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

  // Aggregate: Record<DateKey, Array<{taskId, name, icon, color, type, totalCount, occurrenceIds}>>
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
    const dateKey = occ.date;
    if (!occurrencesByDate[dateKey]) {
      occurrencesByDate[dateKey] = [];
    }
    const existing = occurrencesByDate[dateKey].find((e) => e.taskId === occ.taskId);
    if (existing) {
      existing.totalCount += occ.count;
      existing.occurrenceIds.push(occ.id);
    } else {
      occurrencesByDate[dateKey].push({
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

  // Fetch notes for the current month
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
    <MonthView
      year={year}
      month={month}
      tasks={tasks}
      occurrencesByDate={occurrencesByDate}
      notesByDate={notesByDate}
      todayKey={currentTodayKey}
    />
  );
}
