// 12 色精选色板：暖色 + 冷色 + 中性
export const COLOR_PALETTE = [
  "#E07A5F", "#F2A65A", "#F5D547", "#A8C256",
  "#5DA399", "#5089C6", "#7B68EE", "#C77DFF",
  "#EF6F95", "#A0522D", "#778899", "#3A3A3A",
] as const;

export const TASK_NAME_MAX = 30;
export const TASK_TYPES = ["COUNTED", "CHECK"] as const;
export const PERIODS = ["DAY", "WEEK", "MONTH"] as const;

export type TaskTypeInput = (typeof TASK_TYPES)[number];
export type PeriodInput = (typeof PERIODS)[number];

export interface TaskInput {
  name: string;
  icon: string;
  color: string;
  type: TaskTypeInput;
  targetCount?: number;
  targetPeriod?: PeriodInput;
  isPrivate: boolean;
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateTaskInput(input: TaskInput): ValidationResult {
  if (!input.name || input.name.length === 0) return { ok: false, error: "名称不能为空" };
  if (input.name.length > TASK_NAME_MAX) return { ok: false, error: `名称不能超过 ${TASK_NAME_MAX} 字` };
  if (!input.icon || input.icon.length === 0) return { ok: false, error: "图标不能为空" };
  if (!(COLOR_PALETTE as readonly string[]).includes(input.color)) {
    return { ok: false, error: "颜色必须从预设色板选择" };
  }
  if (!(TASK_TYPES as readonly string[]).includes(input.type)) {
    return { ok: false, error: "任务类型无效" };
  }

  if (input.type === "COUNTED") {
    if (input.targetCount === undefined || input.targetCount === null) {
      return { ok: false, error: "次数型任务必须设置目标次数" };
    }
    if (!Number.isInteger(input.targetCount) || input.targetCount <= 0) {
      return { ok: false, error: "目标次数必须是正整数" };
    }
    if (!input.targetPeriod || !(PERIODS as readonly string[]).includes(input.targetPeriod)) {
      return { ok: false, error: "次数型任务必须设置目标周期" };
    }
  } else {
    if (input.targetCount !== undefined || input.targetPeriod !== undefined) {
      return { ok: false, error: "打卡型任务不应设置目标" };
    }
  }
  return { ok: true };
}

export function parseTaskFormData(form: FormData): TaskInput {
  const name = String(form.get("name") ?? "").trim();
  const icon = String(form.get("icon") ?? "");
  const color = String(form.get("color") ?? "");
  const type = String(form.get("type") ?? "") as TaskTypeInput;
  const isPrivate = form.get("isPrivate") === "on" || form.get("isPrivate") === "true";

  let targetCount: number | undefined;
  let targetPeriod: PeriodInput | undefined;

  if (type === "COUNTED") {
    const tc = form.get("targetCount");
    if (tc !== null && tc !== "") targetCount = Number(tc);
    const tp = form.get("targetPeriod");
    if (tp !== null && tp !== "") targetPeriod = String(tp) as PeriodInput;
  }

  return { name, icon, color, type, targetCount, targetPeriod, isPrivate };
}
