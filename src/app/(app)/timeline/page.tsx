import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayKey, monthRange } from "@/lib/dates";
import { scopeOccurrencesWhere } from "@/lib/visibility";
import { TimelineView } from "../timeline-view";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const viewer = await requireAuth();
  const { y, m } = await searchParams;

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
      redirect("/timeline");
    }
    year = parsedYear;
    month = parsedMonth;
  }

  const { start, end } = monthRange(year, month);

  // Fetch all users
  const allUsers = await prisma.user.findMany({
    select: { id: true, username: true, displayName: true, color: true },
    orderBy: { displayName: "asc" },
  });

  const allUserIds = allUsers.map((u) => u.id);

  // Fetch tasks visible to the viewer across all users
  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { userId: viewer.id }, // own (private + public)
        { userId: { not: viewer.id }, isPrivate: false }, // others' public only
      ],
      archivedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  // Fetch occurrences using scopeOccurrencesWhere — respects privacy
  const occurrences = await prisma.occurrence.findMany({
    where: {
      ...scopeOccurrencesWhere(viewer.id, allUserIds),
      date: { gte: start, lte: end },
    },
    include: {
      task: {
        select: { id: true, name: true, icon: true, color: true, type: true },
      },
    },
  });

  // Aggregate by (userId, date)
  type AggEntry = {
    taskId: number;
    name: string;
    icon: string;
    color: string;
    type: string;
    totalCount: number;
    occurrenceIds: number[];
  };
  // occurrencesByUserDate: userId -> dateKey -> AggEntry[]
  const occurrencesByUserDate: Record<number, Record<string, AggEntry[]>> = {};

  for (const occ of occurrences) {
    const uid = occ.userId;
    const dateKey = occ.date;
    if (!occurrencesByUserDate[uid]) occurrencesByUserDate[uid] = {};
    if (!occurrencesByUserDate[uid][dateKey]) occurrencesByUserDate[uid][dateKey] = [];
    const existing = occurrencesByUserDate[uid][dateKey].find((e) => e.taskId === occ.taskId);
    if (existing) {
      existing.totalCount += occ.count;
      existing.occurrenceIds.push(occ.id);
    } else {
      occurrencesByUserDate[uid][dateKey].push({
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

  // Fetch notes (all users, no privacy filter for MVP)
  const notes = await prisma.dailyNote.findMany({
    where: {
      userId: { in: allUserIds },
      date: { gte: start, lte: end },
    },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
    },
  });

  // notesByUserDate: userId -> dateKey -> NoteData
  const notesByUserDate: Record<number, Record<string, { id: number; content: string; images: { id: number; sortOrder: number; originalName: string; mimeType: string; sizeBytes: number }[] }>> = {};
  for (const note of notes) {
    const uid = note.userId;
    if (!notesByUserDate[uid]) notesByUserDate[uid] = {};
    notesByUserDate[uid][note.date] = note;
  }

  const currentTodayKey = todayKey();

  return (
    <TimelineView
      year={year}
      month={month}
      viewerId={viewer.id}
      allUsers={allUsers}
      tasks={tasks}
      occurrencesByUserDate={occurrencesByUserDate}
      notesByUserDate={notesByUserDate}
      todayKey={currentTodayKey}
    />
  );
}
