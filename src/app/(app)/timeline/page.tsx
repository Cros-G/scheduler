import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayKey, monthRange, weekRange, formatDateKey } from "@/lib/dates";
import { scopeOccurrencesWhere } from "@/lib/visibility";
import { TimelineView } from "../timeline-view";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ y?: string; m?: string; period?: string; d?: string }>;
}) {
  const viewer = await requireAuth();
  const { y, m, period: rawPeriod, d: rawD } = await searchParams;

  const now = new Date();
  const defaultTodayKey = formatDateKey(now);

  // ── Determine period ──────────────────────────────────────────────────────
  // Backward compat: if y/m present and no period, treat as month mode
  let period: "month" | "week" = "month";
  if (rawPeriod === "week") {
    period = "week";
  } else if (rawPeriod === "month" || rawPeriod === undefined) {
    period = "month";
  } else {
    // Unknown period value → redirect to clean URL
    redirect("/timeline");
  }

  // ── Determine anchor date ─────────────────────────────────────────────────
  let anchorKey: string; // YYYY-MM-DD

  if (period === "week") {
    // Week mode: use ?d= param or today
    if (rawD && /^\d{4}-\d{2}-\d{2}$/.test(rawD)) {
      anchorKey = rawD;
    } else if (rawD) {
      redirect("/timeline?period=week");
    } else {
      anchorKey = defaultTodayKey;
    }
  } else {
    // Month mode: backward-compat ?y=&m= OR ?d= (first day of that month)
    if (y !== undefined || m !== undefined) {
      // Legacy y/m params
      const parsedYear = parseInt(y ?? "", 10);
      const parsedMonth = parseInt(m ?? "", 10);
      const yearValid = !isNaN(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100;
      const monthValid = !isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12;
      if (!yearValid || !monthValid) {
        redirect("/timeline");
      }
      const mm = String(parsedMonth).padStart(2, "0");
      anchorKey = `${parsedYear}-${mm}-01`;
    } else if (rawD && /^\d{4}-\d{2}-\d{2}$/.test(rawD)) {
      // Normalize: use first day of that month
      const [dy, dm] = rawD.split("-").map(Number);
      const mm = String(dm).padStart(2, "0");
      anchorKey = `${dy}-${mm}-01`;
    } else if (rawD) {
      redirect("/timeline");
    } else {
      anchorKey = defaultTodayKey;
    }
  }

  // ── Compute range ─────────────────────────────────────────────────────────
  let rangeStart: string;
  let rangeEnd: string;

  if (period === "week") {
    const r = weekRange(anchorKey);
    rangeStart = r.start;
    rangeEnd = r.end;
  } else {
    const [ay, am] = anchorKey.split("-").map(Number);
    const r = monthRange(ay, am);
    rangeStart = r.start;
    rangeEnd = r.end;
  }

  // ── Fetch data ────────────────────────────────────────────────────────────
  const allUsers = await prisma.user.findMany({
    select: { id: true, username: true, displayName: true, color: true },
    orderBy: { displayName: "asc" },
  });

  const allUserIds = allUsers.map((u) => u.id);

  const tasks = await prisma.task.findMany({
    where: {
      OR: [
        { userId: viewer.id },
        { userId: { not: viewer.id }, isPrivate: false },
      ],
      archivedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  const occurrences = await prisma.occurrence.findMany({
    where: {
      ...scopeOccurrencesWhere(viewer.id, allUserIds),
      date: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      task: {
        select: { id: true, name: true, icon: true, color: true, type: true },
      },
    },
  });

  type AggEntry = {
    taskId: number;
    name: string;
    icon: string;
    color: string;
    type: string;
    totalCount: number;
    occurrenceIds: number[];
  };

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

  const notes = await prisma.dailyNote.findMany({
    where: {
      userId: { in: allUserIds },
      date: { gte: rangeStart, lte: rangeEnd },
    },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
    },
  });

  const notesByUserDate: Record<
    number,
    Record<
      string,
      {
        id: number;
        content: string;
        images: {
          id: number;
          sortOrder: number;
          originalName: string;
          mimeType: string;
          sizeBytes: number;
        }[];
      }
    >
  > = {};
  for (const note of notes) {
    const uid = note.userId;
    if (!notesByUserDate[uid]) notesByUserDate[uid] = {};
    notesByUserDate[uid][note.date] = note;
  }

  const currentTodayKey = todayKey();

  return (
    <TimelineView
      period={period}
      anchorKey={anchorKey}
      rangeStart={rangeStart}
      rangeEnd={rangeEnd}
      viewerId={viewer.id}
      allUsers={allUsers}
      tasks={tasks}
      occurrencesByUserDate={occurrencesByUserDate}
      notesByUserDate={notesByUserDate}
      todayKey={currentTodayKey}
    />
  );
}
