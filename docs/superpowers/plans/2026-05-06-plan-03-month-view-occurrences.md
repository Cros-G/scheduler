# 日历记账 — Plan 3: 月视图 + 事件记录 + 日详情

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 把首页 `/` 从占位换成功能完整的**月视图**：左侧任务面板（今日活动任务）、中间月历网格（每天显示用户已发生的图标 + 角标计数）、点击格子打开**日详情面板**（看 / 加 / 减事件）。Plan 3 完成后核心玩法跑通：用户能"点任务图标 → 点格子 → 把图标种到那一天上 / 减回来"。

**不在本 Plan 范围**（推到后续）：心声（Plan 4）、周视图、合并视图、私密过滤（Plan 5）、拖拽（先用"先点任务再点格子"代替 —— spec §4.3 已经把它列为合法备选）。

**Architecture:**
- Prisma 加 `Occurrence` 模型 + 在 `Task` 上加 `occurrences Occurrence[]` 反向关系（同一次迁移）
- `Occurrence`：`taskId / userId / date(YYYY-MM-DD 字符串) / count / createdAt`，每次发生一行（COUNTED 任务可一次写入 count > 1，CHECK 任务靠应用层保证 (taskId, date) 唯一且 count=1）
- 三个写动作（`actions-core` 风格 + 薄 server-action 包装）：
  - `addOccurrence(taskId, date, delta=1)` — COUNTED 用
  - `removeOccurrence(occurrenceId)` — 通用
  - `setCheck(taskId, date, on)` — CHECK 用，幂等
- `deleteTaskCore` 加 occurrence 计数检查（spec 要求：有事件 → 不允许真删）
- `src/lib/dates.ts` 提供日期工具：`todayKey()`, `monthDays(year, month)`, `firstDayOffset(...)`, `weekRange(date)`, `monthRange(...)`，都基于服务器时区（`TZ=Asia/Shanghai`）
- 月视图 `(app)/page.tsx` 取代 Plan 1 的占位主页：RSC 拉数据 + 客户端组件管"选中任务 → 点格子 → 调 action"交互
- 日详情：客户端组件，点击格子打开 sheet/dialog，列出当日事件，可加可减；CHECK 任务一键 toggle

**Tech Stack:** 沿用（Next 15 / Prisma / Tailwind / Vitest / Playwright）；新依赖：无（不引 dnd-kit，先用点击交互）

---

## ⚠ 实施前的关键坑点

1. **时区**：`new Date()` 拿到的是 UTC instant，但日期字符串要按服务器时区 `Asia/Shanghai` 算。用 `date.toLocaleDateString('sv-SE')`（sv-SE 出 YYYY-MM-DD）或 `Intl.DateTimeFormat` 显式指定时区，**不要**用 `toISOString().slice(0,10)`（那是 UTC 日期，跨午夜会偏一天）。
2. **CHECK 唯一约束**：DB 上没强制 (taskId, date) 唯一（schema 注释说"应用层保证"）。`setCheck(on=true)` 必须先查再 upsert，避免重复 row。优先用事务。
3. **deleteTask 现在要拒绝有事件的任务**：Plan 2 留了 TODO，本 Plan 必须接上 + 加测试。
4. **month grid 的 layout**：6 行 7 列 = 42 格，前面 N 个空白填充本月 1 号之前的占位，后面填本月 2~daysInMonth + trailing 空白。先按 ISO 周（周一起）。
5. **Server action 调用方式**：客户端组件里通过 `useTransition` + 异步调 action，避免阻塞 UI。失败 toast 一下。
6. **Occurrence.userId 冗余字段**：业务上 `task.userId` 即可，但加冗余是为了"按 user 查事件"时不用 join。**保证一致性**：写入时用 `task.userId`，不能让 client 传 userId（会被绕过）。
7. **事件按用户筛**：本 Plan 只显示当前用户自己的事件（不显示其他人）。其他人 + 私密过滤推到 Plan 5。
8. **icon 累加显示规则**（spec §4.3）：同一天 (taskId) 多次 → 一个图标 + count 角标（≥ 2 时显示）。多个不同 task → 多个图标并列。
9. **格子内图标过多**：spec §4.5 提"超阈值折叠为 +N"。MVP 阈值用 4，超过 4 显示 4 个 + "+N"。
10. **revalidatePath**：每个 mutation 后 `revalidatePath('/')`（月视图主页）。

---

## 文件结构（Plan 3 新增 / 修改）

```
prisma/
  schema.prisma                                       # +Occurrence, Task 上加 occurrences[]
  migrations/<ts>_add_occurrence_model/migration.sql
src/
  lib/
    dates.ts                                          # 时区/日期工具
  app/
    (app)/
      page.tsx                                        # 月视图（取代占位）
      month-view.tsx                                  # 'use client'（交互层）
      task-panel.tsx                                  # 'use client'（左侧任务面板）
      day-cell.tsx                                    # RSC 渲染单格
      day-detail-sheet.tsx                            # 'use client'（点格子打开）
      occurrences/
        actions.ts                                    # use-server 包装
        actions-core.ts                               # 可测核心
      tasks/
        actions-core.ts                               # 修改 deleteTaskCore（加 occurrence 检查）
tests/
  unit/
    dates.test.ts
  integration/
    occurrences-actions.test.ts
    tasks-actions.test.ts                             # 修改：加 occurrence guard 测试
  e2e/
    occurrences.spec.ts
```

---

### Task 1: Occurrence 模型 + 迁移

**Files:**
- Modify: `prisma/schema.prisma`
- New migration directory

#### Step 1.1: 修改 schema

在 `Task` model 内（`@@index([userId])` 之前）加：
```prisma
occurrences  Occurrence[]
```

文件末尾追加：

```prisma
model Occurrence {
  id        Int      @id @default(autoincrement())
  taskId    Int
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date      String
  count     Int      @default(1)
  createdAt DateTime @default(now())

  @@index([userId, date])
  @@index([taskId, date])
}
```

且要在 `User` model 加：
```prisma
occurrences Occurrence[]
```

#### Step 1.2: Migration

```bash
pnpm exec prisma migrate dev --name add_occurrence_model
```

#### Step 1.3: smoke

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  console.log('Occurrences:', await p.occurrence.findMany());
  await p.\$disconnect();
})();
"
```
Expected: `Occurrences: []`

#### Step 1.4: Tests still green

```bash
pnpm test
```
Expected: 46 PASS（schema 加字段不破坏既有测试）。

#### Step 1.5: 提交

```bash
git add prisma/
git commit -m "feat: add Occurrence model with task/user/date indexes"
```

---

### Task 2: 更新 deleteTaskCore，加 occurrence guard（TDD）

**Files:**
- Modify: `tests/integration/tasks-actions.test.ts` — 加新测试
- Modify: `src/app/(app)/tasks/actions-core.ts` — 加检查

#### Step 2.1: 加失败测试（追加到 `describe("deleteTaskCore", ...)`）

```typescript
it("有事件的任务不能真删（先归档或清空事件）", async () => {
  const u = await makeUser();
  const c = await createTaskCore(u.id, validCounted, prisma);
  if (!c.ok) throw new Error("setup");
  // 手动塞一个 occurrence
  await prisma.occurrence.create({
    data: {
      taskId: c.task.id,
      userId: u.id,
      date: "2026-05-06",
      count: 1,
    },
  });
  const out = await deleteTaskCore(u.id, c.task.id, prisma);
  expect(out.ok).toBe(false);
  // 任务还在
  const stillThere = await prisma.task.findUnique({ where: { id: c.task.id } });
  expect(stillThere).not.toBeNull();
});
```

> 也别忘了在 `tests/helpers/test-db.ts` 的 `resetTestDb` 里加一行清 occurrence —— 顺序：先 occurrence，再 session，再 task，再 user。**这个改动很关键**，否则后续 occurrence 测试 beforeEach 会失败。

修改 `tests/helpers/test-db.ts`：

```typescript
export async function resetTestDb() {
  const p = getTestPrisma();
  await p.occurrence.deleteMany();
  await p.session.deleteMany();
  await p.task.deleteMany();
  await p.user.deleteMany();
}
```

#### Step 2.2: 跑失败

```bash
pnpm test tasks-actions
```

新测试预期 FAIL（任务被删掉了）。

#### Step 2.3: 修改 `deleteTaskCore`

```typescript
export async function deleteTaskCore(
  userId: number,
  taskId: number,
  prisma: PrismaClient
): Promise<ActionResult<Task>> {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) return { ok: false, error: "任务不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };

  const occurrenceCount = await prisma.occurrence.count({ where: { taskId } });
  if (occurrenceCount > 0) {
    return { ok: false, error: "任务已有记录，无法真删，请改为归档" };
  }

  const task = await prisma.task.delete({ where: { id: taskId } });
  return { ok: true, task };
}
```

#### Step 2.4: 跑通过 + 全量

```bash
pnpm test
```
Expected: 47 tests PASS（46 原 + 1 新）。

#### Step 2.5: 提交

```bash
git add 'src/app/(app)/tasks/actions-core.ts' tests/integration/tasks-actions.test.ts tests/helpers/test-db.ts
git commit -m "feat: prevent task delete when occurrences exist"
```

---

### Task 3: occurrence-actions-core（TDD）

**Files:**
- Test: `tests/integration/occurrences-actions.test.ts`
- Create: `src/app/(app)/occurrences/actions-core.ts`

#### Step 3.1: 失败测试

```typescript
// tests/integration/occurrences-actions.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import {
  addOccurrenceCore,
  removeOccurrenceCore,
  setCheckCore,
} from "@/app/(app)/occurrences/actions-core";
import { createTaskCore } from "@/app/(app)/tasks/actions-core";
import { COLOR_PALETTE } from "@/lib/task-validation";
import { hashPassword } from "@/lib/password";

const prisma = getTestPrisma();

beforeEach(async () => { await resetTestDb(); });
afterAll(async () => { await closeTestDb(); });

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
  name: "吃苹果", icon: "🍎", color: COLOR_PALETTE[0],
  type: "COUNTED" as const, targetCount: 1, targetPeriod: "DAY" as const,
  isPrivate: false,
};
const validCheck = {
  name: "冥想", icon: "🧘", color: COLOR_PALETTE[1],
  type: "CHECK" as const, isPrivate: false,
};

describe("addOccurrenceCore", () => {
  it("COUNTED 任务加 1 次", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const out = await addOccurrenceCore(u.id, t.task.id, "2026-05-06", 1, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.occurrence.count).toBe(1);
      expect(out.occurrence.userId).toBe(u.id);
      expect(out.occurrence.date).toBe("2026-05-06");
    }
  });

  it("COUNTED 任务一次加 N 次", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const out = await addOccurrenceCore(u.id, t.task.id, "2026-05-06", 3, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.occurrence.count).toBe(3);
  });

  it("CHECK 任务不能用 addOccurrenceCore（应该用 setCheckCore）", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCheck, prisma);
    if (!t.ok) throw new Error();
    const out = await addOccurrenceCore(u.id, t.task.id, "2026-05-06", 1, prisma);
    expect(out.ok).toBe(false);
  });

  it("delta <= 0 → 失败", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const out = await addOccurrenceCore(u.id, t.task.id, "2026-05-06", 0, prisma);
    expect(out.ok).toBe(false);
  });

  it("date 格式不对 → 失败", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const out = await addOccurrenceCore(u.id, t.task.id, "5/6/2026", 1, prisma);
    expect(out.ok).toBe(false);
  });

  it("操作别人的任务 → 失败", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const t = await createTaskCore(a.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const out = await addOccurrenceCore(b.id, t.task.id, "2026-05-06", 1, prisma);
    expect(out.ok).toBe(false);
  });

  it("归档任务也允许加（不强制）", async () => {
    // 暂时不强制，行为：可加（如需禁，后续加）
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    await prisma.task.update({ where: { id: t.task.id }, data: { archivedAt: new Date() } });
    const out = await addOccurrenceCore(u.id, t.task.id, "2026-05-06", 1, prisma);
    expect(out.ok).toBe(true);
  });
});

describe("removeOccurrenceCore", () => {
  it("删除自己的事件", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const a = await addOccurrenceCore(u.id, t.task.id, "2026-05-06", 1, prisma);
    if (!a.ok) throw new Error();
    const out = await removeOccurrenceCore(u.id, a.occurrence.id, prisma);
    expect(out.ok).toBe(true);
    expect(await prisma.occurrence.findUnique({ where: { id: a.occurrence.id } })).toBeNull();
  });

  it("操作别人的事件 → 失败", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const t = await createTaskCore(a.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const ev = await addOccurrenceCore(a.id, t.task.id, "2026-05-06", 1, prisma);
    if (!ev.ok) throw new Error();
    const out = await removeOccurrenceCore(b.id, ev.occurrence.id, prisma);
    expect(out.ok).toBe(false);
  });

  it("不存在的事件 → 失败", async () => {
    const u = await makeUser();
    const out = await removeOccurrenceCore(u.id, 99999, prisma);
    expect(out.ok).toBe(false);
  });
});

describe("setCheckCore", () => {
  it("on=true 创建一行 count=1", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCheck, prisma);
    if (!t.ok) throw new Error();
    const out = await setCheckCore(u.id, t.task.id, "2026-05-06", true, prisma);
    expect(out.ok).toBe(true);
    const rows = await prisma.occurrence.findMany({ where: { taskId: t.task.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0].count).toBe(1);
  });

  it("on=true 重复调用 → 仍只 1 行（幂等）", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCheck, prisma);
    if (!t.ok) throw new Error();
    await setCheckCore(u.id, t.task.id, "2026-05-06", true, prisma);
    await setCheckCore(u.id, t.task.id, "2026-05-06", true, prisma);
    const rows = await prisma.occurrence.findMany({ where: { taskId: t.task.id } });
    expect(rows).toHaveLength(1);
  });

  it("on=false 删除当日所有事件", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCheck, prisma);
    if (!t.ok) throw new Error();
    await setCheckCore(u.id, t.task.id, "2026-05-06", true, prisma);
    await setCheckCore(u.id, t.task.id, "2026-05-06", false, prisma);
    const rows = await prisma.occurrence.findMany({ where: { taskId: t.task.id } });
    expect(rows).toHaveLength(0);
  });

  it("on=false 在没有事件时 → 不报错", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCheck, prisma);
    if (!t.ok) throw new Error();
    const out = await setCheckCore(u.id, t.task.id, "2026-05-06", false, prisma);
    expect(out.ok).toBe(true);
  });

  it("COUNTED 任务用 setCheck → 失败（应该用 add/remove）", async () => {
    const u = await makeUser();
    const t = await createTaskCore(u.id, validCounted, prisma);
    if (!t.ok) throw new Error();
    const out = await setCheckCore(u.id, t.task.id, "2026-05-06", true, prisma);
    expect(out.ok).toBe(false);
  });

  it("操作别人的任务 → 失败", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const t = await createTaskCore(a.id, validCheck, prisma);
    if (!t.ok) throw new Error();
    const out = await setCheckCore(b.id, t.task.id, "2026-05-06", true, prisma);
    expect(out.ok).toBe(false);
  });
});
```

#### Step 3.2: 跑失败

```bash
pnpm test occurrences-actions
```

#### Step 3.3: 实现 `src/app/(app)/occurrences/actions-core.ts`

```typescript
import type { PrismaClient, Occurrence } from "@prisma/client";

export type ActionResult<T = void> =
  | { ok: true; occurrence: T }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function addOccurrenceCore(
  userId: number,
  taskId: number,
  date: string,
  delta: number,
  prisma: PrismaClient
): Promise<ActionResult<Occurrence>> {
  if (!DATE_RE.test(date)) return { ok: false, error: "日期格式错误" };
  if (!Number.isInteger(delta) || delta <= 0) return { ok: false, error: "次数必须为正整数" };

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.userId !== userId) return { ok: false, error: "无权操作" };
  if (task.type !== "COUNTED") return { ok: false, error: "次数型任务才能用 addOccurrence" };

  const occurrence = await prisma.occurrence.create({
    data: { taskId, userId: task.userId, date, count: delta },
  });
  return { ok: true, occurrence };
}

export async function removeOccurrenceCore(
  userId: number,
  occurrenceId: number,
  prisma: PrismaClient
): Promise<ActionResult<Occurrence>> {
  const existing = await prisma.occurrence.findUnique({ where: { id: occurrenceId } });
  if (!existing) return { ok: false, error: "事件不存在" };
  if (existing.userId !== userId) return { ok: false, error: "无权操作" };
  const occurrence = await prisma.occurrence.delete({ where: { id: occurrenceId } });
  return { ok: true, occurrence };
}

export async function setCheckCore(
  userId: number,
  taskId: number,
  date: string,
  on: boolean,
  prisma: PrismaClient
): Promise<ActionResult<Occurrence | null>> {
  if (!DATE_RE.test(date)) return { ok: false, error: "日期格式错误" };

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { ok: false, error: "任务不存在" };
  if (task.userId !== userId) return { ok: false, error: "无权操作" };
  if (task.type !== "CHECK") return { ok: false, error: "打卡型任务才能用 setCheck" };

  return prisma.$transaction(async (tx) => {
    const existing = await tx.occurrence.findFirst({ where: { taskId, date } });
    if (on) {
      if (existing) return { ok: true as const, occurrence: existing };
      const created = await tx.occurrence.create({
        data: { taskId, userId: task.userId, date, count: 1 },
      });
      return { ok: true as const, occurrence: created };
    } else {
      // 删除当日所有 (理论上 CHECK 只 1 行，但兼容)
      await tx.occurrence.deleteMany({ where: { taskId, date } });
      return { ok: true as const, occurrence: null };
    }
  });
}
```

#### Step 3.4: 通过

```bash
pnpm test occurrences-actions
```
Expected: 16 个测试 PASS。

#### Step 3.5: 提交

```bash
git add 'src/app/(app)/occurrences/actions-core.ts' tests/integration/occurrences-actions.test.ts
git commit -m "feat: add occurrence CRUD core (add/remove/setCheck)"
```

---

### Task 4: server action 包装

**File:** Create `src/app/(app)/occurrences/actions.ts`

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  addOccurrenceCore,
  removeOccurrenceCore,
  setCheckCore,
} from "./actions-core";

export async function addOccurrenceAction(taskId: number, date: string, delta: number = 1) {
  const user = await requireAuth();
  const result = await addOccurrenceCore(user.id, taskId, date, delta, prisma);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/");
  return { ok: true };
}

export async function removeOccurrenceAction(occurrenceId: number) {
  const user = await requireAuth();
  const result = await removeOccurrenceCore(user.id, occurrenceId, prisma);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/");
  return { ok: true };
}

export async function setCheckAction(taskId: number, date: string, on: boolean) {
  const user = await requireAuth();
  const result = await setCheckCore(user.id, taskId, date, on, prisma);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/");
  return { ok: true };
}
```

提交：`feat: add occurrence server action wrappers`

---

### Task 5: 日期工具（TDD）

**Files:**
- Test: `tests/unit/dates.test.ts`
- Create: `src/lib/dates.ts`

#### 测试

```typescript
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
  it("formats Date to YYYY-MM-DD in TZ", () => {
    // 2026-05-06 12:00 UTC → Shanghai 时间是 20:00 同日
    expect(formatDateKey(new Date("2026-05-06T12:00:00Z"))).toBe("2026-05-06");
    // 2026-05-05 23:30 UTC → Shanghai 时间是 2026-05-06 07:30
    expect(formatDateKey(new Date("2026-05-05T23:30:00Z"))).toBe("2026-05-06");
  });
});

describe("todayKey", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("monthGrid", () => {
  it("2026-05 yields 6 weeks (42 cells)", () => {
    // 2026 年 5 月 1 日是周五，周一起 → 前 4 个空，5-1 在第 5 格
    const grid = monthGrid(2026, 5); // month is 1-indexed in our API
    expect(grid).toHaveLength(42);
    // 前 4 格为 null
    expect(grid.slice(0, 4)).toEqual([null, null, null, null]);
    // 第 5 格是 2026-05-01
    expect(grid[4]).toEqual({ key: "2026-05-01", day: 1, inMonth: true });
    // 5 月有 31 天，最后一天在 idx 4 + 31 - 1 = 34
    expect(grid[34]).toEqual({ key: "2026-05-31", day: 31, inMonth: true });
    // 35-41 应该是 null
    expect(grid.slice(35, 42)).toEqual([null, null, null, null, null, null, null]);
  });

  it("2026-02 (28 days, 2/1 is Sunday) yields the right offset", () => {
    const grid = monthGrid(2026, 2);
    // 2026-02-01 是周日，周一起则前 6 格空
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

describe("weekRange", () => {
  it("Monday-based: 2026-05-06 (Wed) → Mon 5-04 ~ Sun 5-10", () => {
    const r = weekRange("2026-05-06");
    expect(r.start).toBe("2026-05-04");
    expect(r.end).toBe("2026-05-10");
  });

  it("if input is Monday, returns same week", () => {
    const r = weekRange("2026-05-04");
    expect(r.start).toBe("2026-05-04");
    expect(r.end).toBe("2026-05-10");
  });

  it("if input is Sunday, returns the same week (Sun is end)", () => {
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
  it("matches", () => {
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
```

#### 实现 `src/lib/dates.ts`

```typescript
// All date math is in YYYY-MM-DD strings (server timezone).
// Server runs with TZ=Asia/Shanghai per .env.

export const CHINESE_MONTHS = [
  "一月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "十一月", "十二月",
] as const;

export const WEEKDAY_LABELS_CN = ["一", "二", "三", "四", "五", "六", "日"] as const;

export function formatDateKey(d: Date): string {
  // 'sv-SE' locale yields YYYY-MM-DD; respects TZ env on Node
  return d.toLocaleDateString("sv-SE");
}

export function todayKey(): string {
  return formatDateKey(new Date());
}

export interface DayCell { key: string; day: number; inMonth: true }

/**
 * Returns 42 cells for a 6-week month grid, Monday-first.
 * Out-of-month leading/trailing cells are null.
 * @param year 4-digit year
 * @param month 1-indexed (1=January)
 */
export function monthGrid(year: number, month: number): (DayCell | null)[] {
  const firstOfMonth = new Date(year, month - 1, 1);
  // JS getDay: 0=Sun..6=Sat; we want Mon=0..Sun=6
  const firstWeekdayMon = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (DayCell | null)[] = [];
  for (let i = 0; i < firstWeekdayMon; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push({ key: `${year}-${mm}-${dd}`, day: d, inMonth: true });
  }
  while (cells.length < 42) cells.push(null);
  return cells;
}

export function shiftMonth(year: number, month: number, delta: number) {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (total % 12) + 1 };
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  // Use local time constructor; treat keys as wall-clock dates in server TZ.
  return new Date(y, m - 1, d);
}

export function weekRange(key: string): { start: string; end: string } {
  const d = parseKey(key);
  const dowMon = (d.getDay() + 6) % 7;
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dowMon);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { start: formatDateKey(monday), end: formatDateKey(sunday) };
}

export function monthRange(year: number, month: number): { start: string; end: string } {
  const last = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, "0");
  return {
    start: `${year}-${mm}-01`,
    end: `${year}-${mm}-${String(last).padStart(2, "0")}`,
  };
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}
```

通过 + 提交：`feat: add date/period utilities for calendar views`

---

### Task 6: 月视图 + 任务面板 + 日详情（impeccable）

**⚠ 必须先调 impeccable skill (craft mode)**。沿用前面建立的"温暖手作 / journal"美学（OKLCH 色 + serif CJK 标题 + 纸张感纹理）。

#### 功能契约

`src/app/(app)/page.tsx`（替换 Plan 1 的占位）：
- RSC，`getCurrentUser()`
- 接 `searchParams`：`?y=2026&m=5`，缺省取当月
- 拉数据：
  - `tasks`: 当前用户活动任务（`archivedAt: null`）
  - `occurrences`: 当前用户当月所有事件（`date >= monthRange.start && date <= monthRange.end`），include task
- 渲染：
  - 顶部：月份切换器（`< 五月 2026 >`，今天按钮）
  - 左侧 / 上方任务面板：列出活动任务（图标 + 名称 + 颜色），点选后变成"选中"态
  - 月历网格：6 行 7 列，周一起；每格显示当天的图标聚合 + count 角标；当天高亮
  - 点格子：打开日详情面板

`src/app/(app)/month-view.tsx`（'use client'）：
- 接 RSC props（month, tasks, occurrencesByDate, todayKey）
- 维护 `selectedTaskId` state
- 点格子：
  - 若没选任务 → 直接打开日详情
  - 若选了 task：
    - COUNTED → 调 `addOccurrenceAction(taskId, dateKey, 1)`
    - CHECK → 调 `setCheckAction(taskId, dateKey, !alreadyChecked)`
- 提供"日详情"入口（可以是双击 / 长按 / 单独的 i 图标）

`src/app/(app)/day-detail-sheet.tsx`（'use client'）：
- 接 props：`date`, `occurrences`（当天）, `tasks`
- 列出当天事件（按 task 分组），每个有 + / - 按钮
- 心声编辑器留 placeholder（Plan 4 实现）

格子内图标聚合规则：
- 同一 (taskId) 多次 → 一个图标 + 总 count（≥ 2 时显示 "·N" 或角标）
- 多个不同 task → 多图标并列
- 超过 4 种 → 显示 4 个 + "+N"

#### 步骤

1. 调 impeccable craft，确认布局与视觉
2. 写 `dates.ts` 已经在 Task 5 完成
3. 写 `page.tsx` (RSC) — 数据查询 + 把数据传给客户端组件
4. 写 `month-view.tsx` — 网格布局 + 交互
5. 写 `task-panel.tsx` — 左侧任务列表
6. 写 `day-detail-sheet.tsx` — 点格子打开
7. 手动测：
   - 进 / → 看到本月日历，无事件时空空
   - 选一个 COUNTED 任务 → 点几个不同日子 → 图标出现
   - 选一个 CHECK 任务 → 点格子 → 打钩
   - 再点同 CHECK 同日 → 取消打钩
   - 点格子（不选任务）→ 看日详情 sheet
   - 月份切换正常
   - 今天按钮正常
8. `pnpm build` 通过
9. 提交（按合理粒度切分 commit）

---

### Task 7: E2E

**File:** `tests/e2e/occurrences.spec.ts`

至少覆盖：
1. 登录后 `/` 显示当月日历 + 任务面板
2. 选 COUNTED 任务 + 点今天 → 今天格里出现图标
3. 选 CHECK 任务 + 点今天 → 格内标记为已打卡
4. 月份切换前后正常
5. 点格子打开 day detail sheet，看到事件列表
6. 在 sheet 里 - 一次 → 事件减少
7. （可选）尝试删除有事件的 task → 失败（spec 要求）

提交：`test: add E2E for occurrence add/remove and month nav`

---

### Task 8: 全量回归 + Plan 3 收官

- `pnpm test` 全绿（46 + 1 deleteTask guard + 16 occurrence + ~10 dates = ~73）
- `pnpm test:e2e` 全绿（12 已有 + ~6 新 = ~18）
- `pnpm build` 通过
- 手动 smoke：登录 → /tasks 创任务 → / 用任务点格子 → 日详情验证 → 月份切换
- 更新 README（标记 Plan 3 完成；下一步 Plan 4 心声）
- 提交：`docs: update README for Plan 3 month view`

---

## Plan 3 验收清单

- [ ] `pnpm test` 全绿
- [ ] `pnpm test:e2e` 全绿
- [ ] `pnpm build` 通过
- [ ] / 显示月历，能在格子里"种"图标
- [ ] CHECK 任务幂等打卡，可取消
- [ ] COUNTED 任务可以累加，count 角标显示
- [ ] 月份左右切换正常，今天按钮回当月
- [ ] 日详情面板能看 / 加 / 减事件
- [ ] 有事件的任务无法在 /tasks 真删（前端 + 后端拦）

通过后进入 Plan 4。
