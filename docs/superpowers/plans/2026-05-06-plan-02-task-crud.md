# 日历记账 — Plan 2: 任务 CRUD（数据 + UI）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Plan 1 的基础上，加入 Task 数据模型 + 服务端 Actions + `/tasks` 管理页（列表 / 新建 / 编辑 / 归档 / 真删）。完成后用户能登录后访问 `/tasks` 完整管理自己的任务。事件记录与日历视图留到 Plan 3。

**Architecture:**
- Prisma 加 `Task` model 与两个枚举 (`TaskType`, `Period`)。**暂不**加 `Occurrence`（在 Plan 3 一起加，避免 Task 上的反向关系字段悬空 —— 我们在 Plan 2 的 Task 上不写 `occurrences Occurrence[]`，Plan 3 再补上）
- 服务端 Action 模式：`actions.ts` 是 `'use server'` 入口（读 auth context），同文件 export 一个可测的 `*Core(userId, args, prisma)` 纯函数
- UI 用 React Server Component 列页面 + 客户端组件做表单交互（drawer 形态，避免单独 `/tasks/new` 路由）
- 颜色用 12 色预设色板，emoji 用轻量 picker（自建 16x6 分类网格，不引外部包，自托管前提下可控）
- 私密任务：DB 字段 `isPrivate`，UI 只是 toggle，过滤逻辑等到 Plan 5

**Tech Stack:** 沿用 Plan 1（Next.js 15 / Prisma / Tailwind / Vitest / Playwright），新增最小依赖（如有需要才加 emoji picker；优先自建）

---

## ⚠ 实施前的关键坑点

1. **Server Action 单测**：直接 import 带 `'use server'` 的函数会被 Next 编译器特殊处理。必须把核心逻辑抽成 `*Core(userId, args, prisma)` 纯函数，测这个；薄 action 只在 E2E 里覆盖。
2. **路径重新生效（revalidation）**：每个 mutating action 完成后 `revalidatePath('/tasks')`，否则页面看到旧数据。
3. **类型不可变**：`updateTask` 必须拒绝 `type` 字段。前端表单 + 后端校验都要拦。
4. **真删除前置条件**：MVP 暂时还没有 Occurrence，所以"无事件才能删"的检查在 Plan 2 里相当于"永远可删"。但**接口实现就要写 occurrence 计数检查**（== 0 才允许）—— 提前接住，Plan 3 加上 Occurrence 后无需改代码。
5. **私密 toggle 默认 false**：如果表单不带 `isPrivate` 字段（HTML checkbox unchecked 不发字段），后端要默认 false。
6. **颜色字段**：DB 是 `String`，但后端要校验是预设色板里的值（防止 admin 客户端绕过）。色板要在一个共享常量文件里。
7. **archivedAt 不可改成"未来"或不一致状态**：`archiveTask` 设当前时间，`unarchiveTask` 置 null。中间状态不存在。
8. **Auth 边界**：每个 action 第一行就 `requireAuth()`，且操作 task 时要校验 `task.userId === user.id`，否则 throw。
9. **emoji 输入**：用 `<input type="text" maxLength=2>` 接收 emoji 字符，配自建 picker 一键填入；不强依赖 picker（也可手输）。**注意 emoji 占 2 个 UTF-16 码元**，maxLength=2 是必要的。
10. **表单 vs JSON**：用原生 `<form action={action}>` 提交，action 接 `FormData`。这样 JS off 也能用，进度增强。

---

## 文件结构（Plan 2 新增/修改）

```
prisma/
  schema.prisma                                # +Task, +TaskType, +Period
  migrations/<ts>_add_task_model/migration.sql # 新迁移
src/
  lib/
    task-validation.ts                         # 共享校验 + 色板/周期常量
    task-validation.test.ts → tests/unit/      # 单测
  app/
    (app)/
      tasks/
        page.tsx                                # 列表 RSC
        actions.ts                              # use-server actions
        actions-core.ts                         # 可测核心函数
        task-form.tsx                           # 'use client' 表单组件
        task-list.tsx                           # 'use client'（？）或 RSC
        emoji-picker.tsx                        # 'use client' 自建 picker
tests/
  unit/
    task-validation.test.ts                    # 校验函数单测
  integration/
    tasks-actions.test.ts                      # *Core 函数集成测（带 DB）
  e2e/
    tasks.spec.ts                              # 任务 CRUD E2E
```

---

### Task 1: Prisma schema 加 Task 模型 + 迁移

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_task_model/migration.sql` (生成)

- [ ] **Step 1.1: 修改 schema.prisma**

在 `User` model 加一行 `tasks Task[]`，并在文件末尾追加：

```prisma
enum TaskType {
  COUNTED
  CHECK
}

enum Period {
  DAY
  WEEK
  MONTH
}

model Task {
  id           Int       @id @default(autoincrement())
  userId       Int
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  icon         String
  color        String
  type         TaskType
  targetCount  Int?
  targetPeriod Period?
  isPrivate    Boolean   @default(false)
  archivedAt   DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([userId])
}
```

> 暂不加 `occurrences Occurrence[]` 反向关系 —— Plan 3 再补。

- [ ] **Step 1.2: 跑迁移**

```bash
pnpm exec prisma migrate dev --name add_task_model
```

> Plan 1 经验：用 `pnpm exec prisma ...` 而不是 `pnpm db:migrate -- --name ...`（pnpm 的 `--` 转发不可靠）。

Verify：
- `prisma/migrations/<ts>_add_task_model/migration.sql` 含 `CREATE TABLE "Task"` 及 idx
- SQLite 没有原生 enum，Prisma 用 `TEXT` + check constraint 模拟 —— 确认 SQL 里能看到约束（或至少 TEXT 列）

- [ ] **Step 1.3: smoke**

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const tasks = await p.task.findMany();
  console.log('Tasks:', tasks);
  await p.\$disconnect();
})();
"
```

Expected: `Tasks: []`.

- [ ] **Step 1.4: 提交**

```bash
git add prisma/
git commit -m "feat: add Task model with TaskType/Period enums"
```

---

### Task 2: 校验工具 + 共享常量（TDD）

**Files:**
- Test: `tests/unit/task-validation.test.ts`
- Create: `src/lib/task-validation.ts`

- [ ] **Step 2.1: 写失败测试**

```typescript
// tests/unit/task-validation.test.ts
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
```

- [ ] **Step 2.2: 跑测试，确认失败**

```bash
pnpm test task-validation
```

- [ ] **Step 2.3: 实现 `src/lib/task-validation.ts`**

```typescript
// 12 色精选色板：暖色 + 冷色 + 中性，覆盖常见任务场景
export const COLOR_PALETTE = [
  "#E07A5F", // 赤陶土
  "#F2A65A", // 橘黄
  "#F5D547", // 暖黄
  "#A8C256", // 鲜绿
  "#5DA399", // 青绿
  "#5089C6", // 海蓝
  "#7B68EE", // 紫
  "#C77DFF", // 粉紫
  "#EF6F95", // 玫红
  "#A0522D", // 棕
  "#778899", // 石板灰
  "#3A3A3A", // 墨黑
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
  if (!input.name || input.name.length === 0) {
    return { ok: false, error: "名称不能为空" };
  }
  if (input.name.length > TASK_NAME_MAX) {
    return { ok: false, error: `名称不能超过 ${TASK_NAME_MAX} 字` };
  }
  if (!input.icon || input.icon.length === 0) {
    return { ok: false, error: "图标不能为空" };
  }
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
    // CHECK
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
    if (tc !== null && tc !== "") {
      targetCount = Number(tc);
    }
    const tp = form.get("targetPeriod");
    if (tp !== null && tp !== "") {
      targetPeriod = String(tp) as PeriodInput;
    }
  }

  return { name, icon, color, type, targetCount, targetPeriod, isPrivate };
}
```

- [ ] **Step 2.4: 跑测试，确认通过**

```bash
pnpm test task-validation
```

Expected: 11 个测试 PASS。

- [ ] **Step 2.5: 提交**

```bash
git add src/lib/task-validation.ts tests/unit/task-validation.test.ts
git commit -m "feat: add task validation helpers and 12-color palette"
```

---

### Task 3: actions-core.ts 任务 CRUD 核心函数（TDD）

**Files:**
- Test: `tests/integration/tasks-actions.test.ts`
- Create: `src/app/(app)/tasks/actions-core.ts`

> Core 函数接 `userId + args + prisma`，无关 Next.js 上下文。`actions.ts` 在下一个 Task 写薄壳。

- [ ] **Step 3.1: 写失败测试**

```typescript
// tests/integration/tasks-actions.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import {
  createTaskCore,
  updateTaskCore,
  archiveTaskCore,
  unarchiveTaskCore,
  deleteTaskCore,
} from "@/app/(app)/tasks/actions-core";
import { COLOR_PALETTE } from "@/lib/task-validation";
import { hashPassword } from "@/lib/password";

const prisma = getTestPrisma();

beforeEach(async () => {
  await resetTestDb();
});
afterAll(async () => {
  await closeTestDb();
});

async function makeUser(username = "alice") {
  return prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword("x"),
      displayName: username,
      color: COLOR_PALETTE[0],
    },
  });
}

const validCounted = {
  name: "吃苹果",
  icon: "🍎",
  color: COLOR_PALETTE[0],
  type: "COUNTED" as const,
  targetCount: 1,
  targetPeriod: "DAY" as const,
  isPrivate: false,
};
const validCheck = {
  name: "冥想",
  icon: "🧘",
  color: COLOR_PALETTE[1],
  type: "CHECK" as const,
  isPrivate: false,
};

describe("createTaskCore", () => {
  it("创建 COUNTED 任务", async () => {
    const u = await makeUser();
    const out = await createTaskCore(u.id, validCounted, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.task.name).toBe("吃苹果");
      expect(out.task.userId).toBe(u.id);
      expect(out.task.type).toBe("COUNTED");
      expect(out.task.targetCount).toBe(1);
      expect(out.task.targetPeriod).toBe("DAY");
      expect(out.task.archivedAt).toBeNull();
    }
  });

  it("创建 CHECK 任务", async () => {
    const u = await makeUser();
    const out = await createTaskCore(u.id, validCheck, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.task.targetCount).toBeNull();
      expect(out.task.targetPeriod).toBeNull();
    }
  });

  it("校验失败（name 空）→ 返回 error", async () => {
    const u = await makeUser();
    const out = await createTaskCore(u.id, { ...validCounted, name: "" }, prisma);
    expect(out.ok).toBe(false);
  });
});

describe("updateTaskCore", () => {
  it("更新允许字段", async () => {
    const u = await makeUser();
    const created = await createTaskCore(u.id, validCounted, prisma);
    if (!created.ok) throw new Error("setup failed");
    const out = await updateTaskCore(
      u.id,
      created.task.id,
      { ...validCounted, name: "吃两个苹果", targetCount: 2 },
      prisma
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.task.name).toBe("吃两个苹果");
      expect(out.task.targetCount).toBe(2);
    }
  });

  it("尝试改 type → 返回 error", async () => {
    const u = await makeUser();
    const created = await createTaskCore(u.id, validCounted, prisma);
    if (!created.ok) throw new Error("setup failed");
    const out = await updateTaskCore(
      u.id,
      created.task.id,
      { ...validCounted, type: "CHECK" as const, targetCount: undefined, targetPeriod: undefined },
      prisma
    );
    expect(out.ok).toBe(false);
  });

  it("操作别人的任务 → 返回 error", async () => {
    const u1 = await makeUser("alice");
    const u2 = await makeUser("bob");
    const created = await createTaskCore(u1.id, validCounted, prisma);
    if (!created.ok) throw new Error("setup failed");
    const out = await updateTaskCore(u2.id, created.task.id, validCounted, prisma);
    expect(out.ok).toBe(false);
  });

  it("不存在的任务 → 返回 error", async () => {
    const u = await makeUser();
    const out = await updateTaskCore(u.id, 99999, validCounted, prisma);
    expect(out.ok).toBe(false);
  });
});

describe("archiveTaskCore / unarchiveTaskCore", () => {
  it("归档设置 archivedAt", async () => {
    const u = await makeUser();
    const c = await createTaskCore(u.id, validCounted, prisma);
    if (!c.ok) throw new Error("setup");
    const out = await archiveTaskCore(u.id, c.task.id, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.task.archivedAt).toBeInstanceOf(Date);
    }
  });

  it("反归档清空 archivedAt", async () => {
    const u = await makeUser();
    const c = await createTaskCore(u.id, validCounted, prisma);
    if (!c.ok) throw new Error("setup");
    await archiveTaskCore(u.id, c.task.id, prisma);
    const out = await unarchiveTaskCore(u.id, c.task.id, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.task.archivedAt).toBeNull();
    }
  });

  it("操作别人的任务 → 失败", async () => {
    const u1 = await makeUser("alice");
    const u2 = await makeUser("bob");
    const c = await createTaskCore(u1.id, validCounted, prisma);
    if (!c.ok) throw new Error("setup");
    const out = await archiveTaskCore(u2.id, c.task.id, prisma);
    expect(out.ok).toBe(false);
  });
});

describe("deleteTaskCore", () => {
  it("无事件的任务可以删除", async () => {
    const u = await makeUser();
    const c = await createTaskCore(u.id, validCounted, prisma);
    if (!c.ok) throw new Error("setup");
    const out = await deleteTaskCore(u.id, c.task.id, prisma);
    expect(out.ok).toBe(true);
    const remaining = await prisma.task.findUnique({ where: { id: c.task.id } });
    expect(remaining).toBeNull();
  });

  it("操作别人的任务 → 失败", async () => {
    const u1 = await makeUser("alice");
    const u2 = await makeUser("bob");
    const c = await createTaskCore(u1.id, validCounted, prisma);
    if (!c.ok) throw new Error("setup");
    const out = await deleteTaskCore(u2.id, c.task.id, prisma);
    expect(out.ok).toBe(false);
    const stillThere = await prisma.task.findUnique({ where: { id: c.task.id } });
    expect(stillThere).not.toBeNull();
  });

  // Plan 3 接上 Occurrence 之后会再补一个"有事件不能删"测试
});
```

- [ ] **Step 3.2: 跑失败**

```bash
pnpm test tasks-actions
```

- [ ] **Step 3.3: 实现 `src/app/(app)/tasks/actions-core.ts`**

```typescript
import type { PrismaClient, Task } from "@prisma/client";
import { validateTaskInput, type TaskInput } from "@/lib/task-validation";

export type ActionResult<T = void> =
  | { ok: true; task: T }
  | { ok: false; error: string };

export async function createTaskCore(
  userId: number,
  input: TaskInput,
  prisma: PrismaClient
): Promise<ActionResult<Task>> {
  const v = validateTaskInput(input);
  if (!v.ok) return v;

  const task = await prisma.task.create({
    data: {
      userId,
      name: input.name,
      icon: input.icon,
      color: input.color,
      type: input.type,
      targetCount: input.type === "COUNTED" ? input.targetCount! : null,
      targetPeriod: input.type === "COUNTED" ? input.targetPeriod! : null,
      isPrivate: input.isPrivate,
    },
  });
  return { ok: true, task };
}

export async function updateTaskCore(
  userId: number,
  taskId: number,
  input: TaskInput,
  prisma: PrismaClient
): Promise<ActionResult<Task>> {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { ok: false, error: "任务不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };
  if (existing.type !== input.type) {
    return { ok: false, error: "任务类型不可修改" };
  }
  const v = validateTaskInput(input);
  if (!v.ok) return v;

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      name: input.name,
      icon: input.icon,
      color: input.color,
      targetCount: input.type === "COUNTED" ? input.targetCount! : null,
      targetPeriod: input.type === "COUNTED" ? input.targetPeriod! : null,
      isPrivate: input.isPrivate,
    },
  });
  return { ok: true, task };
}

export async function archiveTaskCore(
  userId: number,
  taskId: number,
  prisma: PrismaClient
): Promise<ActionResult<Task>> {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { ok: false, error: "任务不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: new Date() },
  });
  return { ok: true, task };
}

export async function unarchiveTaskCore(
  userId: number,
  taskId: number,
  prisma: PrismaClient
): Promise<ActionResult<Task>> {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { ok: false, error: "任务不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { archivedAt: null },
  });
  return { ok: true, task };
}

export async function deleteTaskCore(
  userId: number,
  taskId: number,
  prisma: PrismaClient
): Promise<ActionResult<Task>> {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { ok: false, error: "任务不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };

  // Plan 3 加上 Occurrence 后，这里会改成：
  // const count = await prisma.occurrence.count({ where: { taskId } });
  // if (count > 0) return { ok: false, error: "任务已有记录，无法真删，请改为归档" };
  // 现在还没 Occurrence 表，跳过；但接口/返回结构与未来一致。

  const task = await prisma.task.delete({ where: { id: taskId } });
  return { ok: true, task };
}
```

- [ ] **Step 3.4: 跑通过**

```bash
pnpm test tasks-actions
```

Expected: 11 个测试 PASS（3 create + 4 update + 3 archive + 2 delete... actually 3 create + 4 update + 3 archive/unarchive + 2 delete = 12，重数一遍：

- createTaskCore: 3
- updateTaskCore: 4
- archive/unarchive: 3
- deleteTaskCore: 2

= 12 个测试。如果不止，确认实现匹配。

- [ ] **Step 3.5: 提交**

```bash
git add src/app/\(app\)/tasks/actions-core.ts tests/integration/tasks-actions.test.ts
git commit -m "feat: add task CRUD core functions with auth + ownership checks"
```

> 注意 zsh 下 `(app)` 要用反斜杠转义。如果失败，加引号：`git add 'src/app/(app)/tasks/actions-core.ts'`。

---

### Task 4: actions.ts 薄包装 + revalidatePath

**File:**
- Create: `src/app/(app)/tasks/actions.ts`

- [ ] **Step 4.1: 实现**

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseTaskFormData } from "@/lib/task-validation";
import {
  createTaskCore,
  updateTaskCore,
  archiveTaskCore,
  unarchiveTaskCore,
  deleteTaskCore,
} from "./actions-core";

const TASKS_PATH = "/tasks";

export async function createTaskAction(formData: FormData) {
  const user = await requireAuth();
  const input = parseTaskFormData(formData);
  const result = await createTaskCore(user.id, input, prisma);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath(TASKS_PATH);
  return { ok: true };
}

export async function updateTaskAction(taskId: number, formData: FormData) {
  const user = await requireAuth();
  const input = parseTaskFormData(formData);
  const result = await updateTaskCore(user.id, taskId, input, prisma);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }
  revalidatePath(TASKS_PATH);
  return { ok: true };
}

export async function archiveTaskAction(taskId: number) {
  const user = await requireAuth();
  const result = await archiveTaskCore(user.id, taskId, prisma);
  if (!result.ok) throw new Error(result.error);
  revalidatePath(TASKS_PATH);
}

export async function unarchiveTaskAction(taskId: number) {
  const user = await requireAuth();
  const result = await unarchiveTaskCore(user.id, taskId, prisma);
  if (!result.ok) throw new Error(result.error);
  revalidatePath(TASKS_PATH);
}

export async function deleteTaskAction(taskId: number) {
  const user = await requireAuth();
  const result = await deleteTaskCore(user.id, taskId, prisma);
  if (!result.ok) throw new Error(result.error);
  revalidatePath(TASKS_PATH);
}
```

> 设计取舍：create/update 返回 `{ok, error}` 让 client 显示行内错误；archive/unarchive/delete 直接 throw 让 Next 显示错误页（这些通常不应失败，失败本身是异常）。

- [ ] **Step 4.2: 提交**

```bash
git add 'src/app/(app)/tasks/actions.ts'
git commit -m "feat: add server action wrappers with revalidatePath"
```

---

### Task 5: `/tasks` 列表页 + UI 骨架（impeccable skill）

> ⚠ **必须先调用 impeccable skill (craft mode)**，让它给出页面整体设计语言后再写代码。沿用 Plan 1 登录页那种"温暖手作 / journal"的语境，避免 SaaS 化的 dashboard 套路。

**Files:**
- Create: `src/app/(app)/tasks/page.tsx` (RSC)
- Create: `src/app/(app)/tasks/task-list.tsx` ('use client' 或 RSC，根据交互需要)

下面给的是**功能契约**，视觉自由发挥。

#### 功能契约

页面路由：`/tasks`，在 `(app)` 路由组内（自动受 `requireAuth` 守护）。

主页面服务端组件，必做：
1. 顶部导航（沿用 layout 的 header，本页不重复加）
2. 页面标题 + 描述（"我的任务"等）
3. "新建任务"主按钮，触发表单（drawer 或 modal）
4. **Active 任务列表**（`archivedAt = null` 的，按 `createdAt desc` 排序）
   - 每张任务卡显示：图标、名称、类型徽章（次数/打卡）、目标摘要（"每周 3 次" / "每天打卡"）、私密图标（如果 isPrivate）
   - 卡片右侧操作：编辑、归档、（如果允许）删除
5. **Archived 任务可折叠区域**（默认折叠）
   - 显示归档任务，每行带"恢复"和"真删除"按钮
6. 空状态："还没有任务，点击右上角创建第一个吧"或类似温暖文案

数据查询：
```typescript
const user = await getCurrentUser();
const all = await prisma.task.findMany({
  where: { userId: user!.id },
  orderBy: { createdAt: "desc" },
});
const active = all.filter(t => !t.archivedAt);
const archived = all.filter(t => t.archivedAt);
```

(layout 已经 requireAuth，但这里直接 getCurrentUser 拿数据更直接。)

- [ ] **Step 5.1: 调用 impeccable craft，沟通整体设计**
- [ ] **Step 5.2: 写 `page.tsx`，先只渲染列表（new/edit form 留下个 placeholder ）**
- [ ] **Step 5.3: 验证未登录访问 `/tasks` → 跳 `/login`，登录后能看到空列表**
- [ ] **Step 5.4: 提交：`feat: add /tasks list page with active/archived sections`**

---

### Task 6: 任务表单组件（新建 + 编辑，'use client'）

**Files:**
- Create: `src/app/(app)/tasks/task-form.tsx`
- Create: `src/app/(app)/tasks/emoji-picker.tsx`

#### 功能契约

- 一份 form 复用新建/编辑（差异：编辑禁用 type、初始值用既有 task）
- 字段：
  - name（text，max 30）
  - icon（emoji 显示 + 点击调出 picker）
  - color（12 色色板，圆点点击选中）
  - type（radio：次数型 / 打卡型；编辑模式下 disabled）
  - targetCount（number，仅 COUNTED 显示）
  - targetPeriod（select：日/周/月，仅 COUNTED 显示）
  - isPrivate（toggle）
- 提交：调 `createTaskAction(formData)` 或 `updateTaskAction(taskId, formData)`
- 校验失败：显示 server 返回的 error（如"名称超长"），不关闭表单
- 成功：关闭表单 + 列表刷新

emoji picker：
- 简易 16xN 网格，emoji 字符直接 inline 列出（食物 / 运动 / 心情 / 自然 / 物品 五类，每类 16 个）
- 点击填入 form 的 icon 字段
- 也支持手输（如果用户喜欢自定义 emoji）

- [ ] **Step 6.1: 调 impeccable，让它处理表单 / picker 视觉**
- [ ] **Step 6.2: 写 emoji-picker.tsx**
- [ ] **Step 6.3: 写 task-form.tsx，集成 picker + color palette**
- [ ] **Step 6.4: 在 page.tsx 集成（drawer/modal 显示）**
- [ ] **Step 6.5: 手动测试**：
  - 新建 COUNTED 任务，目标周期切换日/周/月正常
  - 新建 CHECK 任务，目标字段不显示
  - 编辑现有任务，type 字段灰掉
  - 校验错误显示
  - 私密 toggle 工作
- [ ] **Step 6.6: 提交：`feat: add task create/edit form with emoji picker and color palette`**

---

### Task 7: 归档 / 反归档 / 删除 UI

**Modify:** `src/app/(app)/tasks/page.tsx` 或新增组件 `task-actions.tsx`

#### 功能契约

- Active 卡片：归档按钮 → 调 `archiveTaskAction(id)`
  - 危险按钮风格不要太强烈（归档不是删除）
  - 不需要二次确认
- Archived 行：恢复按钮 → `unarchiveTaskAction(id)`；真删除按钮 → 二次确认 → `deleteTaskAction(id)`
  - 真删除前要 `confirm("确定永久删除？此操作不可撤销")`
- 所有 mutation 后页面刷新（revalidatePath 已在 action 里）

- [ ] **Step 7.1: 实现归档/恢复按钮（用 `<form action={...}>` 包按钮即可，原生表单提交）**
- [ ] **Step 7.2: 实现真删除（要 client component 弹 confirm，再 action）**
- [ ] **Step 7.3: 手动测试：归档 → 进 archived 区；恢复 → 回 active；真删除 → 消失**
- [ ] **Step 7.4: 提交：`feat: add archive/unarchive/delete actions in tasks UI`**

---

### Task 8: E2E 任务 CRUD 流程

**File:**
- Create: `tests/e2e/tasks.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

const TEST_USERNAME = "e2e_tasks_user";
const TEST_PASSWORD = "test_pw_456";

test.beforeAll(() => {
  execSync(
    `pnpm seed:user --username ${TEST_USERNAME} --display "Tasks User" --password "${TEST_PASSWORD}" --color "#5089C6"`,
    { stdio: "inherit" }
  );
});

async function login(page) {
  await page.goto("/login");
  await page.fill('input[name="username"]', TEST_USERNAME);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("http://localhost:3000/");
}

test("创建 COUNTED 任务", async ({ page }) => {
  await login(page);
  await page.goto("/tasks");
  await page.click('text=新建任务');
  await page.fill('input[name="name"]', '吃苹果');
  await page.fill('input[name="icon"]', '🍎');
  // 选第一个 color (具体 selector 看实现)
  await page.click('[data-color-pick]:first-of-type');
  await page.click('input[name="type"][value="COUNTED"]');
  await page.fill('input[name="targetCount"]', '3');
  await page.selectOption('select[name="targetPeriod"]', 'WEEK');
  await page.click('button:has-text("保存")');
  await expect(page.locator('text=吃苹果')).toBeVisible();
});

test("创建 CHECK 任务", async ({ page }) => {
  await login(page);
  await page.goto("/tasks");
  await page.click('text=新建任务');
  await page.fill('input[name="name"]', '冥想');
  await page.fill('input[name="icon"]', '🧘');
  await page.click('[data-color-pick]:first-of-type');
  await page.click('input[name="type"][value="CHECK"]');
  await page.click('button:has-text("保存")');
  await expect(page.locator('text=冥想')).toBeVisible();
});

test("编辑任务", async ({ page }) => {
  await login(page);
  await page.goto("/tasks");
  // 先建一个再编辑
  // ...略，按上面模式
  // 假设已经存在 "吃苹果"
  await page.click('text=吃苹果').click(); // 或点击编辑按钮
  await page.fill('input[name="name"]', '吃两个苹果');
  await page.click('button:has-text("保存")');
  await expect(page.locator('text=吃两个苹果')).toBeVisible();
});

test("归档与恢复", async ({ page }) => {
  await login(page);
  await page.goto("/tasks");
  // 假设有任务
  await page.click('button:has-text("归档"):first-of-type');
  // 该任务从 active 消失
  await page.click('text=已归档').click(); // 展开归档区
  // 点恢复
  await page.click('button:has-text("恢复"):first-of-type');
});
```

> 上面 selector 是占位，按实际实现微调。可能需要用 `data-testid` 让 selector 更稳。

- [ ] **Step 8.1: 写 E2E（按实际 UI selectors 调整）**
- [ ] **Step 8.2: 跑 `pnpm test:e2e`**
- [ ] **Step 8.3: 修到全绿**
- [ ] **Step 8.4: 提交：`test: add E2E for task CRUD flow`**

---

### Task 9: 全量回归 + Plan 2 收官

- [ ] **Step 9.1: 跑全部 unit + integration 测试**

```bash
pnpm test
```

Expected：原 20 + 新增（11 task-validation + 12 tasks-actions = 23）= **43 个测试** 全 PASS。

- [ ] **Step 9.2: 跑 E2E**

```bash
pnpm test:e2e
```

Expected：原 3 + 新 4 = **7 个 E2E** 全 PASS。

- [ ] **Step 9.3: `pnpm build` 通过**

- [ ] **Step 9.4: 手动 smoke**：登录 → 进 /tasks → 创建一个 COUNTED + 一个 CHECK 任务 → 编辑 → 归档 → 恢复 → 真删除

- [ ] **Step 9.5: 更新 README** 加 `/tasks` 路由说明

- [ ] **Step 9.6: 最终 commit：`docs: update README for Plan 2 task CRUD`**

---

## Plan 2 验收清单

- [ ] `pnpm test` 全绿（≥ 43 测试）
- [ ] `pnpm test:e2e` 全绿（≥ 7 测试）
- [ ] `pnpm build` 编译无错
- [ ] /tasks 页面：能看到自己的任务，能新建（COUNTED 和 CHECK），能编辑（type 不可改），能归档/反归档，能真删除
- [ ] type 改不掉（前端 disabled + 后端拒绝）
- [ ] 颜色只能选预设 12 色（前端 picker + 后端校验）
- [ ] 别人的任务我看不到（这里只测了 ownership 校验；视图层过滤 Plan 5 再说）
- [ ] git log 在 Plan 1 末尾基础上 +9 ~ +10 个 commit

通过后进入 Plan 3（月视图 + 事件记录 + 日详情）。
