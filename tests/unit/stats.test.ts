import { describe, it, expect } from "vitest";
import type { Task, Occurrence } from "@prisma/client";
import {
  computeTaskStats,
  computeStreaks,
  computeHeatmap,
  colorBucket,
  type TaskStatsRow,
  type StreakRow,
  type HeatmapDay,
} from "@/lib/stats";

// ── test fixtures ──────────────────────────────────────────────
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 1,
    userId: 1,
    name: "吃苹果",
    icon: "🍎",
    color: "#E07A5F",
    type: "COUNTED",
    targetCount: 1,
    targetPeriod: "DAY",
    isPrivate: false,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Task;
}

function makeOccurrence(
  taskId: number,
  date: string,
  count = 1,
  userId = 1
): Occurrence {
  return {
    id: Math.floor(Math.random() * 100000),
    taskId,
    userId,
    date,
    count,
    createdAt: new Date(),
  } as Occurrence;
}

// ── colorBucket ──────────────────────────────────────────────
describe("colorBucket", () => {
  it("0 → 0", () => { expect(colorBucket(0)).toBe(0); });
  it("1 → 1", () => { expect(colorBucket(1)).toBe(1); });
  it("3 → 1", () => { expect(colorBucket(3)).toBe(1); });
  it("4 → 2", () => { expect(colorBucket(4)).toBe(2); });
  it("7 → 2", () => { expect(colorBucket(7)).toBe(2); });
  it("8 → 3", () => { expect(colorBucket(8)).toBe(3); });
  it("15 → 3", () => { expect(colorBucket(15)).toBe(3); });
  it("16 → 4", () => { expect(colorBucket(16)).toBe(4); });
  it("100 → 4", () => { expect(colorBucket(100)).toBe(4); });
});

// ── computeTaskStats ──────────────────────────────────────────
describe("computeTaskStats", () => {
  it("空数据 → 任务都 0", () => {
    const tasks = [makeTask({ id: 1 })];
    const out = computeTaskStats(tasks, [], "2026-05-01", "2026-05-31", "month");
    expect(out).toHaveLength(1);
    expect(out[0].totalCount).toBe(0);
  });

  it("COUNTED 任务统计总数", () => {
    const tasks = [makeTask({ id: 1, type: "COUNTED" })];
    const occs = [
      makeOccurrence(1, "2026-05-01", 2),
      makeOccurrence(1, "2026-05-02", 3),
      makeOccurrence(1, "2026-05-15", 1),
    ];
    const out = computeTaskStats(tasks, occs, "2026-05-01", "2026-05-31", "month");
    expect(out[0].totalCount).toBe(6);
  });

  it("CHECK 任务统计天数", () => {
    const tasks = [makeTask({ id: 1, type: "CHECK", targetCount: null, targetPeriod: null })];
    const occs = [
      makeOccurrence(1, "2026-05-01"),
      makeOccurrence(1, "2026-05-15"),
    ];
    const out = computeTaskStats(tasks, occs, "2026-05-01", "2026-05-31", "month");
    expect(out[0].totalCount).toBe(2);
    expect(out[0].targetHitRate).toBeNull(); // CHECK has no targetHitRate
  });

  it("超出 range 的 occurrences 不算入", () => {
    const tasks = [makeTask({ id: 1 })];
    const occs = [
      makeOccurrence(1, "2026-04-30", 1), // 之前
      makeOccurrence(1, "2026-05-15", 1), // 在内
      makeOccurrence(1, "2026-06-01", 1), // 之后
    ];
    const out = computeTaskStats(tasks, occs, "2026-05-01", "2026-05-31", "month");
    expect(out[0].totalCount).toBe(1);
  });

  it("COUNTED 日目标 — 5/31 天达成 = ~16%", () => {
    const tasks = [makeTask({ id: 1, targetCount: 1, targetPeriod: "DAY" })];
    const occs = [
      makeOccurrence(1, "2026-05-01"),
      makeOccurrence(1, "2026-05-02"),
      makeOccurrence(1, "2026-05-03"),
      makeOccurrence(1, "2026-05-04"),
      makeOccurrence(1, "2026-05-05"),
    ];
    const out = computeTaskStats(tasks, occs, "2026-05-01", "2026-05-31", "month");
    // 5 days hit out of 31
    expect(out[0].targetHitRate).toBeCloseTo(5 / 31, 3);
  });

  it("COUNTED 日目标 — 每天 ≥ target 才算达成", () => {
    const tasks = [makeTask({ id: 1, targetCount: 3, targetPeriod: "DAY" })];
    const occs = [
      makeOccurrence(1, "2026-05-01", 3), // 达成
      makeOccurrence(1, "2026-05-02", 2), // 未达成
      makeOccurrence(1, "2026-05-03", 5), // 超额（仍记 1 天达成）
    ];
    const out = computeTaskStats(tasks, occs, "2026-05-01", "2026-05-31", "month");
    // 2 days hit out of 31
    expect(out[0].targetHitRate).toBeCloseTo(2 / 31, 3);
  });

  it("COUNTED 周目标 — month range = 5 个 ISO 周 (some partial)", () => {
    const tasks = [makeTask({ id: 1, targetCount: 3, targetPeriod: "WEEK" })];
    // 2026-05 covers ISO weeks containing May 1-31. Mon-based weeks.
    // 2026-05-01 (Fri) → week is 2026-04-27 ~ 2026-05-03
    // 2026-05-04 ~ 2026-05-10 (full week in range)
    // ...
    // Add occurrences to make week 2026-05-04~10 hit target (3+ count)
    const occs = [
      makeOccurrence(1, "2026-05-04", 1),
      makeOccurrence(1, "2026-05-05", 1),
      makeOccurrence(1, "2026-05-06", 1),
      // = 3 in that week → 达成
      makeOccurrence(1, "2026-05-11", 1),
      makeOccurrence(1, "2026-05-12", 1),
      // = 2 in next week → 未达成
    ];
    const out = computeTaskStats(tasks, occs, "2026-05-01", "2026-05-31", "month");
    // Range 5/1-5/31 spans 5 ISO weeks (or 6 depending on boundaries)
    // 1 week (5/4~5/10) achieved target
    // hit rate = 1 / (number of weeks in range)
    expect(out[0].targetHitRate).toBeGreaterThan(0);
    expect(out[0].targetHitRate).toBeLessThanOrEqual(0.25);
  });

  it("COUNTED 月目标 — 全年 12 个月", () => {
    const tasks = [makeTask({ id: 1, targetCount: 10, targetPeriod: "MONTH" })];
    const occs: Occurrence[] = [];
    // Make Jan have 10+ events, others 0
    for (let i = 1; i <= 10; i++) {
      occs.push(makeOccurrence(1, `2026-01-${String(i).padStart(2, "0")}`));
    }
    const out = computeTaskStats(tasks, occs, "2026-01-01", "2026-12-31", "year");
    expect(out[0].totalCount).toBe(10);
    expect(out[0].targetHitRate).toBeCloseTo(1 / 12, 3);
  });

  it("多任务隔离", () => {
    const tasks = [
      makeTask({ id: 1, name: "苹果" }),
      makeTask({ id: 2, name: "跑步" }),
    ];
    const occs = [
      makeOccurrence(1, "2026-05-01", 3),
      makeOccurrence(2, "2026-05-01", 1),
      makeOccurrence(2, "2026-05-02", 1),
    ];
    const out = computeTaskStats(tasks, occs, "2026-05-01", "2026-05-31", "month");
    expect(out).toHaveLength(2);
    expect(out.find((r) => r.taskId === 1)!.totalCount).toBe(3);
    expect(out.find((r) => r.taskId === 2)!.totalCount).toBe(2);
  });

  it("结果包含 task 元数据", () => {
    const tasks = [makeTask({ id: 1, name: "苹果", icon: "🍎", color: "#E07A5F" })];
    const out = computeTaskStats(tasks, [], "2026-05-01", "2026-05-31", "month");
    expect(out[0]).toMatchObject({
      taskId: 1,
      taskName: "苹果",
      taskIcon: "🍎",
      taskColor: "#E07A5F",
      taskType: "COUNTED",
    });
  });
});

// ── computeStreaks ──────────────────────────────────────────
describe("computeStreaks", () => {
  it("空 → 全 0", () => {
    const tasks = [makeTask({ id: 1, type: "CHECK", targetCount: null, targetPeriod: null })];
    const out = computeStreaks(tasks, [], "2026-05-06");
    expect(out[0]).toMatchObject({ taskId: 1, currentStreak: 0, longestStreak: 0 });
  });

  it("今天有 → current = 1, longest = 1", () => {
    const tasks = [makeTask({ id: 1, type: "CHECK" })];
    const occs = [makeOccurrence(1, "2026-05-06")];
    const out = computeStreaks(tasks, occs, "2026-05-06");
    expect(out[0].currentStreak).toBe(1);
    expect(out[0].longestStreak).toBe(1);
  });

  it("连续 5 天到今天 → current=5, longest=5", () => {
    const tasks = [makeTask({ id: 1, type: "CHECK" })];
    const occs = [
      makeOccurrence(1, "2026-05-02"),
      makeOccurrence(1, "2026-05-03"),
      makeOccurrence(1, "2026-05-04"),
      makeOccurrence(1, "2026-05-05"),
      makeOccurrence(1, "2026-05-06"),
    ];
    const out = computeStreaks(tasks, occs, "2026-05-06");
    expect(out[0].currentStreak).toBe(5);
    expect(out[0].longestStreak).toBe(5);
  });

  it("连续 5 天结束在昨天 → current=0 (今天没打卡断了)", () => {
    const tasks = [makeTask({ id: 1, type: "CHECK" })];
    const occs = [
      makeOccurrence(1, "2026-05-01"),
      makeOccurrence(1, "2026-05-02"),
      makeOccurrence(1, "2026-05-03"),
      makeOccurrence(1, "2026-05-04"),
      makeOccurrence(1, "2026-05-05"),
    ];
    const out = computeStreaks(tasks, occs, "2026-05-06");
    expect(out[0].currentStreak).toBe(0);
    expect(out[0].longestStreak).toBe(5);
  });

  it("两段 streak，最长的胜出", () => {
    const tasks = [makeTask({ id: 1, type: "CHECK" })];
    const occs = [
      // 7 天 streak
      makeOccurrence(1, "2026-04-01"),
      makeOccurrence(1, "2026-04-02"),
      makeOccurrence(1, "2026-04-03"),
      makeOccurrence(1, "2026-04-04"),
      makeOccurrence(1, "2026-04-05"),
      makeOccurrence(1, "2026-04-06"),
      makeOccurrence(1, "2026-04-07"),
      // 3 天 streak 至今天
      makeOccurrence(1, "2026-05-04"),
      makeOccurrence(1, "2026-05-05"),
      makeOccurrence(1, "2026-05-06"),
    ];
    const out = computeStreaks(tasks, occs, "2026-05-06");
    expect(out[0].currentStreak).toBe(3);
    expect(out[0].longestStreak).toBe(7);
  });

  it("只算 CHECK 任务，忽略 COUNTED", () => {
    const tasks = [
      makeTask({ id: 1, type: "CHECK" }),
      makeTask({ id: 2, type: "COUNTED" }),
    ];
    const out = computeStreaks(tasks, [], "2026-05-06");
    expect(out).toHaveLength(1);
    expect(out[0].taskId).toBe(1);
  });

  it("含 task 元数据", () => {
    const tasks = [makeTask({ id: 1, type: "CHECK", name: "冥想", icon: "🧘", color: "#5DA399" })];
    const occs = [makeOccurrence(1, "2026-05-06")];
    const out = computeStreaks(tasks, occs, "2026-05-06");
    expect(out[0]).toMatchObject({
      taskId: 1,
      taskName: "冥想",
      taskIcon: "🧘",
      taskColor: "#5DA399",
    });
  });
});

// ── computeHeatmap ──────────────────────────────────────────
describe("computeHeatmap", () => {
  it("range 内每天一格，缺日子填 0", () => {
    const occs = [
      makeOccurrence(1, "2026-05-01", 2),
      makeOccurrence(1, "2026-05-03", 5),
    ];
    const out = computeHeatmap(occs, "2026-05-01", "2026-05-05");
    expect(out).toHaveLength(5);
    expect(out[0]).toEqual({ date: "2026-05-01", totalCount: 2 });
    expect(out[1]).toEqual({ date: "2026-05-02", totalCount: 0 });
    expect(out[2]).toEqual({ date: "2026-05-03", totalCount: 5 });
    expect(out[3]).toEqual({ date: "2026-05-04", totalCount: 0 });
    expect(out[4]).toEqual({ date: "2026-05-05", totalCount: 0 });
  });

  it("同日多事件汇总", () => {
    const occs = [
      makeOccurrence(1, "2026-05-01", 2),
      makeOccurrence(2, "2026-05-01", 3),
      makeOccurrence(1, "2026-05-01", 1),
    ];
    const out = computeHeatmap(occs, "2026-05-01", "2026-05-01");
    expect(out).toHaveLength(1);
    expect(out[0].totalCount).toBe(6);
  });

  it("range 外不算", () => {
    const occs = [
      makeOccurrence(1, "2026-04-30", 5),
      makeOccurrence(1, "2026-05-01", 1),
      makeOccurrence(1, "2026-05-02", 1),
      makeOccurrence(1, "2026-05-03", 5),
    ];
    const out = computeHeatmap(occs, "2026-05-01", "2026-05-02");
    expect(out).toHaveLength(2);
    expect(out.reduce((s, d) => s + d.totalCount, 0)).toBe(2);
  });

  it("空数据 → 全 0 填充", () => {
    const out = computeHeatmap([], "2026-05-01", "2026-05-03");
    expect(out).toEqual([
      { date: "2026-05-01", totalCount: 0 },
      { date: "2026-05-02", totalCount: 0 },
      { date: "2026-05-03", totalCount: 0 },
    ]);
  });

  it("整年 → 365/366 格", () => {
    const out = computeHeatmap([], "2026-01-01", "2026-12-31");
    expect(out).toHaveLength(365); // 2026 is not a leap year
    expect(out[0].date).toBe("2026-01-01");
    expect(out[out.length - 1].date).toBe("2026-12-31");
  });
});
