import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayKey, monthRange } from "@/lib/dates";
import { scopeTasksWhere } from "@/lib/visibility";
import { MonthView } from "../../month-view";

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const viewer = await requireAuth();
  const { username } = await params;
  const { y, m } = await searchParams;

  // Look up target user
  const target = await prisma.user.findUnique({
    where: { username },
    select: { id: true, username: true, displayName: true, color: true },
  });

  if (!target) notFound();

  // If viewing self, redirect to main view
  if (target.id === viewer.id) {
    redirect("/");
  }

  // Parse year/month from search params
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
      redirect(`/u/${username}`);
    }
    year = parsedYear;
    month = parsedMonth;
  }

  const { start, end } = monthRange(year, month);

  // Fetch target's visible tasks (public only, since viewer !== target)
  const tasks = await prisma.task.findMany({
    where: {
      ...scopeTasksWhere(viewer.id, target.id),
      archivedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch target's occurrences in the month for visible tasks (non-private)
  const occurrences = await prisma.occurrence.findMany({
    where: {
      userId: target.id,
      date: { gte: start, lte: end },
      task: { isPrivate: false },
    },
    include: {
      task: {
        select: { id: true, name: true, icon: true, color: true, type: true },
      },
    },
  });

  // Aggregate occurrences by date
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

  // Fetch target's notes in the month (with images)
  const notes = await prisma.dailyNote.findMany({
    where: {
      userId: target.id,
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
      readonly={true}
      viewingUser={target}
    />
  );
}
