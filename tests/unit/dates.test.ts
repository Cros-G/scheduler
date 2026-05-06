import { describe, it, expect } from "vitest";
import {
  formatDateKey,
  todayKey,
  monthGrid,
  isSameMonth,
  weekRange,
  monthRange,
  shiftMonth,
  CHINESE_MONTHS,
  WEEKDAY_LABELS_CN,
} from "@/lib/dates";

describe("formatDateKey", () => {
  it("formats Date to YYYY-MM-DD in Shanghai TZ", () => {
    // 2026-05-06 12:00 UTC → Shanghai 20:00 同日
    expect(formatDateKey(new Date("2026-05-06T12:00:00Z"))).toBe("2026-05-06");
    // 2026-05-05 23:30 UTC → Shanghai 2026-05-06 07:30 (next day)
    expect(formatDateKey(new Date("2026-05-05T23:30:00Z"))).toBe("2026-05-06");
  });
});

describe("todayKey", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("monthGrid", () => {
  it("2026-05 yields 42 cells, 4 leading blanks (May 1 is Friday, Mon-first)", () => {
    const grid = monthGrid(2026, 5); // month is 1-indexed
    expect(grid).toHaveLength(42);
    expect(grid.slice(0, 4)).toEqual([null, null, null, null]);
    expect(grid[4]).toEqual({ key: "2026-05-01", day: 1, inMonth: true });
    expect(grid[34]).toEqual({ key: "2026-05-31", day: 31, inMonth: true });
    expect(grid.slice(35, 42)).toEqual([null, null, null, null, null, null, null]);
  });

  it("2026-02 (28 days, Feb 1 is Sunday, Mon-first → 6 leading blanks)", () => {
    const grid = monthGrid(2026, 2);
    expect(grid.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(grid[6]).toEqual({ key: "2026-02-01", day: 1, inMonth: true });
  });
});

describe("shiftMonth", () => {
  it("forward across year boundary", () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
  });
  it("backward across year boundary", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
  it("no-op delta=0", () => {
    expect(shiftMonth(2026, 5, 0)).toEqual({ year: 2026, month: 5 });
  });
});

describe("weekRange (Mon-Sun, ISO)", () => {
  it("Wednesday 2026-05-06 → Mon 2026-05-04 ~ Sun 2026-05-10", () => {
    const r = weekRange("2026-05-06");
    expect(r.start).toBe("2026-05-04");
    expect(r.end).toBe("2026-05-10");
  });
  it("Monday input returns same week", () => {
    const r = weekRange("2026-05-04");
    expect(r.start).toBe("2026-05-04");
    expect(r.end).toBe("2026-05-10");
  });
  it("Sunday input → Sun is end of same week", () => {
    const r = weekRange("2026-05-10");
    expect(r.start).toBe("2026-05-04");
    expect(r.end).toBe("2026-05-10");
  });
});

describe("monthRange", () => {
  it("2026-05 → 2026-05-01 ~ 2026-05-31", () => {
    expect(monthRange(2026, 5)).toEqual({ start: "2026-05-01", end: "2026-05-31" });
  });
  it("2026-02 (non-leap) → 28 days", () => {
    expect(monthRange(2026, 2)).toEqual({ start: "2026-02-01", end: "2026-02-28" });
  });
});

describe("isSameMonth", () => {
  it("matches by YYYY-MM prefix", () => {
    expect(isSameMonth("2026-05-01", "2026-05-31")).toBe(true);
    expect(isSameMonth("2026-05-01", "2026-06-01")).toBe(false);
  });
});

describe("CHINESE_MONTHS / WEEKDAY_LABELS_CN", () => {
  it("12 months", () => {
    expect(CHINESE_MONTHS).toHaveLength(12);
    expect(CHINESE_MONTHS[4]).toBe("五月");
  });
  it("Mon-first weekday labels", () => {
    expect(WEEKDAY_LABELS_CN).toEqual(["一", "二", "三", "四", "五", "六", "日"]);
  });
});
