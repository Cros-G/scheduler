import { describe, it, expect } from "vitest";
import {
  COLOR_PALETTE,
  validateTaskInput,
  parseTaskFormData,
  TASK_NAME_MAX,
} from "@/lib/task-validation";

describe("COLOR_PALETTE", () => {
  it("有 12 个预设颜色", () => {
    expect(COLOR_PALETTE).toHaveLength(12);
    for (const c of COLOR_PALETTE) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe("validateTaskInput", () => {
  const base = {
    name: "吃苹果",
    icon: "🍎",
    color: COLOR_PALETTE[0],
    type: "COUNTED" as const,
    targetCount: 1,
    targetPeriod: "DAY" as const,
    isPrivate: false,
  };

  it("最小有效 COUNTED 任务通过", () => {
    expect(validateTaskInput(base)).toEqual({ ok: true });
  });

  it("最小有效 CHECK 任务（无 target）通过", () => {
    expect(
      validateTaskInput({ ...base, type: "CHECK", targetCount: undefined, targetPeriod: undefined })
    ).toEqual({ ok: true });
  });

  it("name 空 → 失败", () => {
    expect(validateTaskInput({ ...base, name: "" }).ok).toBe(false);
  });

  it(`name 超过 ${TASK_NAME_MAX} 字 → 失败`, () => {
    expect(validateTaskInput({ ...base, name: "a".repeat(TASK_NAME_MAX + 1) }).ok).toBe(false);
  });

  it("icon 空 → 失败", () => {
    expect(validateTaskInput({ ...base, icon: "" }).ok).toBe(false);
  });

  it("color 不在色板 → 失败", () => {
    expect(validateTaskInput({ ...base, color: "#000000" }).ok).toBe(false);
  });

  it("COUNTED 缺 targetCount → 失败", () => {
    expect(validateTaskInput({ ...base, targetCount: undefined }).ok).toBe(false);
  });

  it("COUNTED 缺 targetPeriod → 失败", () => {
    expect(validateTaskInput({ ...base, targetPeriod: undefined }).ok).toBe(false);
  });

  it("targetCount <= 0 → 失败", () => {
    expect(validateTaskInput({ ...base, targetCount: 0 }).ok).toBe(false);
  });

  it("CHECK 带了 target → 失败（不应该有）", () => {
    expect(validateTaskInput({ ...base, type: "CHECK", targetCount: 1, targetPeriod: "DAY" }).ok).toBe(false);
  });
});

describe("parseTaskFormData", () => {
  function fd(obj: Record<string, string>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(obj)) f.append(k, v);
    return f;
  }

  it("解析 COUNTED 任务", () => {
    const out = parseTaskFormData(
      fd({
        name: "跑步",
        icon: "🏃",
        color: COLOR_PALETTE[1],
        type: "COUNTED",
        targetCount: "3",
        targetPeriod: "WEEK",
        isPrivate: "on",
      })
    );
    expect(out).toEqual({
      name: "跑步",
      icon: "🏃",
      color: COLOR_PALETTE[1],
      type: "COUNTED",
      targetCount: 3,
      targetPeriod: "WEEK",
      isPrivate: true,
    });
  });

  it("没勾 isPrivate → false", () => {
    const out = parseTaskFormData(
      fd({
        name: "冥想",
        icon: "🧘",
        color: COLOR_PALETTE[0],
        type: "CHECK",
      })
    );
    expect(out.isPrivate).toBe(false);
  });

  it("CHECK 类型不带 target 字段 → undefined", () => {
    const out = parseTaskFormData(
      fd({ name: "冥想", icon: "🧘", color: COLOR_PALETTE[0], type: "CHECK" })
    );
    expect(out.targetCount).toBeUndefined();
    expect(out.targetPeriod).toBeUndefined();
  });
});
