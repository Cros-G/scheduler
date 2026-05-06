import { describe, it, expect } from "vitest";
import {
  isTaskVisibleTo,
  scopeTasksWhere,
  scopeOccurrencesWhere,
} from "@/lib/visibility";

describe("isTaskVisibleTo", () => {
  it("自己看自己的私密任务 → 可见", () => {
    expect(isTaskVisibleTo({ viewerId: 1, ownerId: 1, isPrivate: true })).toBe(true);
  });
  it("自己看自己的公开任务 → 可见", () => {
    expect(isTaskVisibleTo({ viewerId: 1, ownerId: 1, isPrivate: false })).toBe(true);
  });
  it("别人看私密任务 → 不可见", () => {
    expect(isTaskVisibleTo({ viewerId: 2, ownerId: 1, isPrivate: true })).toBe(false);
  });
  it("别人看公开任务 → 可见", () => {
    expect(isTaskVisibleTo({ viewerId: 2, ownerId: 1, isPrivate: false })).toBe(true);
  });
});

describe("scopeTasksWhere", () => {
  it("viewer === owner → 不加 isPrivate 过滤", () => {
    expect(scopeTasksWhere(1, 1)).toEqual({ userId: 1 });
  });
  it("viewer !== owner → 加 isPrivate: false", () => {
    expect(scopeTasksWhere(2, 1)).toEqual({ userId: 1, isPrivate: false });
  });
});

describe("scopeOccurrencesWhere (timeline OR query)", () => {
  it("viewer 看自己 + 别人公开（OR 拼接）", () => {
    const out = scopeOccurrencesWhere(1, [1, 2, 3]);
    expect(out).toEqual({
      OR: [
        { userId: 1 },
        { userId: { in: [2, 3] }, task: { isPrivate: false } },
      ],
    });
  });
  it("viewer 单独（其他用户列表为空）", () => {
    expect(scopeOccurrencesWhere(1, [1])).toEqual({
      OR: [
        { userId: 1 },
        { userId: { in: [] }, task: { isPrivate: false } },
      ],
    });
  });
  it("viewer 不在 allUserIds 中（管理员场景）", () => {
    const out = scopeOccurrencesWhere(99, [1, 2]);
    expect(out).toEqual({
      OR: [
        { userId: 99 },
        { userId: { in: [1, 2] }, task: { isPrivate: false } },
      ],
    });
  });
});
