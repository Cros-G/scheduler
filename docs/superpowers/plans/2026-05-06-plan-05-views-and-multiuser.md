# 日历记账 — Plan 5: 周视图 + 多人视图 + 私密过滤 + 设置 + 顶部导航

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 把视图层补齐到 spec 描述的完整状态：
- 顶部导航（链到首页 / 周视图 / 合并时间轴 / 任务管理 / 设置 / 切换看谁的）
- `/week` 周视图
- `/u/[username]` 看某人（只读）
- `/timeline` 多人合并时间轴
- `/settings` 自己改昵称 / 颜色
- 任务私密过滤：`isPrivate=true` 任务及其事件在他人视角不出现
- 次数型任务进度徽章（日 / 周 / 月目标，根据 task.targetPeriod）

**Architecture:**
- 在 `(app)/layout.tsx` 加导航条 + 视图切换 dropdown（列出圈内所有用户 + "合并视图" + "我的"）
- 新建 `src/lib/visibility.ts`：纯函数 `isTaskVisibleTo(viewer, task)`、`scopeTasksWhere(viewerId, ownerId)` 等查询条件构造器（TDD）
- `/week` 用一个 `WeekView` 客户端组件（架构与 `MonthView` 类似，但 7 列 × 1 行 / 每天竖向更高）
- `/u/[username]` 复用 `MonthView` 但 `viewMode="readonly"` —— 不能加事件、不能写心声、过滤私密任务
- `/timeline` 是新组件：每行一个用户（含当前用户，按字母排序），列是日期；每格摞图标 + 心声预览 / 截断
- `/settings` 简单表单，`updateProfileAction(displayName, color)`；用 `revalidatePath` 刷新 layout 中的欢迎语
- 进度徽章：在 `task-panel.tsx` 中，对 COUNTED 任务计算 `当周期 SUM(count)`，渲染 `n/target`

**Tech Stack:** 沿用，无新依赖。

---

## ⚠ 实施前的关键坑点

### 私密 / 权限

1. **私密过滤范围**：spec §4.7 — Task.isPrivate=true 时其他用户**完全看不到该任务及其事件**。
   - 影响 `/u/[username]`、`/timeline`：必须 `where: { isPrivate: false }` （当 viewer ≠ owner 时）
   - 影响 month/week 当 viewer 是别人时
   - 影响 timeline 数据查询（每个用户的 task 都要按 viewer 过滤）

2. **心声暂不过滤**（spec §4.7：MVP 全圈内可见）。但**显示心声预览的 UI** 在 timeline 中仍要展示。

3. **viewer 身份**：路由参数 + getCurrentUser 共同决定。`/` 是 viewer = owner = self；`/u/[username]` viewer = self, owner = ?username 用户；`/timeline` viewer = self, owner = 多用户。

4. **私密视图和"自己看自己"差异**：自己看自己时无论 isPrivate 都显示。`scopeTasksWhere(viewerId, ownerId)` 函数：
   ```ts
   viewerId === ownerId 
     ? { userId: ownerId } 
     : { userId: ownerId, isPrivate: false }
   ```

5. **跨用户查询**：合并时间轴一次查所有用户当月的任务和事件。**注意**：必须在查询里用 `OR` 把 viewer 自己（私密 + 公开都看）和其他人（仅公开）合并：
   ```ts
   prisma.task.findMany({
     where: {
       OR: [
         { userId: viewerId }, // 自己的所有
         { userId: { not: viewerId }, isPrivate: false }, // 别人的公开
       ],
       archivedAt: null,
     },
   });
   ```

### 视图 / 路由

6. **`/u/[username]` 找不到用户 → 404**：用 `notFound()` from `next/navigation`。

7. **`/u/[username]` 看自己 → 跳到 `/`**：UX 一致性（自己看自己应该用主视图）。或允许显示但模式改成 view-only？方便：直接 redirect 到 `/`。

8. **新视图与 month-view 共用代码**：把 month grid + day cell 抽成纯组件 `MonthGrid`，接受 `mode: "interactive" | "readonly"`。Interactive 时点格子能加事件；readonly 时点格子只能打开 day-detail-sheet 看（且 sheet 中的 + - 按钮隐藏；编辑器只读）。

9. **DayDetailSheet 也要支持 readonly**：当 owner ≠ viewer 时，加事件按钮隐藏、心声 textarea readOnly、删图按钮隐藏。

10. **timeline 的密度**：每行一个用户 × 30 天 = 多列。如果用户多（≥ 4），网格会很挤。MVP 接受，列宽自适应；超过 8 用户先不考虑（本来就是小圈子）。

11. **week view layout**：spec §4.5 描述"7 列纵向更高，能塞更多图标 + 心声预览"。每天竖向 box，比 month grid 单元高得多。心声预览先放第一行（截断 60 字）。

### 进度徽章

12. **进度计算时区**：`weekRange(todayKey)` 给周一到周日；`monthRange(year, month)` 给当月。事件数=SUM(count) 在 [start, end] 内。

13. **进度数据**：每个 COUNTED 任务在 task-panel 旁显示当 period 进度。
    - 日目标：今天 SUM(count) / target
    - 周目标：本周 SUM(count) / target  
    - 月目标：本月 SUM(count) / target
    - **数据源**：currentMonth 数据集中的 occurrences 已经包含本月所有；本周也在内（如果跨月就只算当月部分？错——"本周"可能跨两个月）。**需要单独查"本周/本月"的事件**或在月查询里前后多带几天。
    - **简化**：viewer 自己的 task panel 里，额外查询当周 + 当月的 occurrences 聚合。后端做 GROUP BY 或拉数后前端聚合。

### 设置

14. **修改 username 不允许**（spec：管理员分配，普通用户不能改）。settings 页只允许改 displayName + color。

15. **改完 color 要重新 revalidate**：layout 显示 displayName 用着 color 染色。`revalidatePath("/", "layout")` 或更精细的 tag 刷新。

### 导航

16. **当前 layout 没有导航**：要加横向 nav links，活跃路由用 accent color 高亮。

17. **视图切换 dropdown**：列出圈内用户。需要在 layout 拉所有用户（少量数据，每次请求都拉 OK）。或者只在切换组件被打开时拉。MVP：layout 拉一次（用户数少）。

### 测试

18. **私密过滤的单元测试**：visibility.ts 纯函数 → unit test 直接覆盖各种 (viewer, owner, isPrivate) 组合。

19. **/u/[username] integration test**：拿两个用户，A 创建 1 个公开任务 + 1 个私密任务，B 访问 /u/A 应只看到公开。

20. **E2E**：补一组场景，登录 alice → 访问 /u/bob → 看到 bob 的公开任务和心声、看不到私密任务。

### 易遗漏

21. **/tasks 页归档区里的任务也属于"自己看自己"**：私密标记的归档任务对自己仍可见，对别人完全不可见（因为是别人的归档任务，本来在 /u/[username] 就不应该出现归档区 — 别人视角不需要看到归档操作面板）。

22. **timeline 里"今天"高亮**：用 todayKey 标记当列。

23. **week view 月份归属**：跨月的周（比如 5 月最后一周到 6 月第一周）在哪个月份显示？跟着今天的位置走，不刻意切。简单：URL 用 `/week?d=2026-05-06`，从这个 d 派生 weekRange。

24. **/settings 的 color picker**：复用 `COLOR_PALETTE`。

---

## 文件结构

```
src/
  lib/
    visibility.ts                                   # 私密过滤 helpers + 单测
  app/
    (app)/
      layout.tsx                                    # 加 nav + view switcher
      week/
        page.tsx                                    # /week
      week-view.tsx                                 # 客户端组件
      timeline/
        page.tsx                                    # /timeline
      timeline-view.tsx
      u/
        [username]/
          page.tsx                                  # /u/<name>
      settings/
        page.tsx
        actions.ts                                  # updateProfileAction
        actions-core.ts
      month-grid.tsx                                # 抽出共享组件（如需）
    
tests/
  unit/
    visibility.test.ts
  integration/
    settings-actions.test.ts
  e2e/
    multiuser.spec.ts                               # /u/<name> + /timeline + 私密
    week.spec.ts                                    # /week 基本流程
    settings.spec.ts                                # 改昵称/颜色
```

---

### Task 1: visibility.ts + 单测（TDD）

**Files:**
- Test: `tests/unit/visibility.test.ts`
- Create: `src/lib/visibility.ts`

#### 测试

```typescript
import { describe, it, expect } from "vitest";
import { isTaskVisibleTo, scopeTasksWhere, scopeOccurrencesWhere } from "@/lib/visibility";

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
        { userId: 1 }, // 自己
        { userId: { in: [2, 3] }, task: { isPrivate: false } }, // 别人公开
      ],
    });
  });
  it("viewer 单独看自己（其他用户列表为空）", () => {
    expect(scopeOccurrencesWhere(1, [1])).toEqual({
      OR: [{ userId: 1 }, { userId: { in: [] }, task: { isPrivate: false } }],
    });
  });
});
```

#### 实现

```typescript
// src/lib/visibility.ts

export function isTaskVisibleTo(args: {
  viewerId: number;
  ownerId: number;
  isPrivate: boolean;
}): boolean {
  if (args.viewerId === args.ownerId) return true;
  return !args.isPrivate;
}

export function scopeTasksWhere(viewerId: number, ownerId: number) {
  if (viewerId === ownerId) return { userId: ownerId };
  return { userId: ownerId, isPrivate: false };
}

export function scopeOccurrencesWhere(viewerId: number, allUserIds: number[]) {
  const others = allUserIds.filter((id) => id !== viewerId);
  return {
    OR: [
      { userId: viewerId },
      { userId: { in: others }, task: { isPrivate: false } },
    ],
  };
}
```

> 注意：Prisma 支持嵌套 relation filter（`task: { isPrivate: false }`），效率上会 join。可接受。

提交：`feat: add visibility helpers for private task filtering`

---

### Task 2: 顶部导航 + 视图切换器

**File:** `src/app/(app)/layout.tsx`

加：
- 导航 nav（左 logo + 横向菜单：日历 / 周 / 合并 / 任务 / 设置）
- 视图切换 dropdown：标题 "看：xxx"（默认"我自己"），点开列出"我自己"、所有圈内成员、"合并时间轴"
- 活跃路由高亮（用 `usePathname()` 在客户端组件中）

实现细节：
- layout 是 RSC（要 fetch 用户列表）→ 内含一个客户端 `<NavBar />` 组件接收 user 列表 props
- 当前 user 自己单独传一个 prop 显示头部欢迎语 + 颜色

调 impeccable（保持手作 / journal 风格）。

提交：`feat: add app navigation bar with view switcher`

---

### Task 3: /settings 页面 + actions（TDD core）

**Files:**
- Create: `src/app/(app)/settings/actions-core.ts`
- Test: `tests/integration/settings-actions.test.ts`
- Create: `src/app/(app)/settings/actions.ts`
- Create: `src/app/(app)/settings/page.tsx` (impeccable UI)

#### actions-core

```typescript
import type { PrismaClient, User } from "@prisma/client";
import { COLOR_PALETTE } from "@/lib/task-validation";

export type Result<T> = { ok: true; user: T } | { ok: false; error: string };

const NAME_MAX = 30;

export async function updateProfileCore(
  userId: number,
  input: { displayName: string; color: string },
  prisma: PrismaClient
): Promise<Result<User>> {
  const name = (input.displayName ?? "").trim();
  if (name.length === 0) return { ok: false, error: "昵称不能为空" };
  if (name.length > NAME_MAX) return { ok: false, error: `昵称不能超过 ${NAME_MAX} 字` };
  if (!(COLOR_PALETTE as readonly string[]).includes(input.color)) {
    return { ok: false, error: "颜色必须从预设色板选择" };
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: { displayName: name, color: input.color },
  });
  return { ok: true, user };
}
```

#### tests

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import { updateProfileCore } from "@/app/(app)/settings/actions-core";
import { COLOR_PALETTE } from "@/lib/task-validation";
import { hashPassword } from "@/lib/password";

const prisma = getTestPrisma();
beforeEach(async () => { await resetTestDb(); });
afterAll(async () => { await closeTestDb(); });

async function makeUser() {
  return prisma.user.create({
    data: { username: "alice", passwordHash: await hashPassword("x"), displayName: "Alice", color: COLOR_PALETTE[0] },
  });
}

describe("updateProfileCore", () => {
  it("更新昵称 + 颜色", async () => {
    const u = await makeUser();
    const out = await updateProfileCore(u.id, { displayName: "Alicia", color: COLOR_PALETTE[5] }, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) { expect(out.user.displayName).toBe("Alicia"); expect(out.user.color).toBe(COLOR_PALETTE[5]); }
  });
  it("空昵称 → 失败", async () => {
    const u = await makeUser();
    expect((await updateProfileCore(u.id, { displayName: "  ", color: COLOR_PALETTE[0] }, prisma)).ok).toBe(false);
  });
  it("超长昵称 → 失败", async () => {
    const u = await makeUser();
    expect((await updateProfileCore(u.id, { displayName: "a".repeat(31), color: COLOR_PALETTE[0] }, prisma)).ok).toBe(false);
  });
  it("非白名单颜色 → 失败", async () => {
    const u = await makeUser();
    expect((await updateProfileCore(u.id, { displayName: "X", color: "#000000" }, prisma)).ok).toBe(false);
  });
});
```

#### actions.ts

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { updateProfileCore } from "./actions-core";

export async function updateProfileAction(formData: FormData) {
  const user = await requireAuth();
  const result = await updateProfileCore(
    user.id,
    {
      displayName: String(formData.get("displayName") ?? ""),
      color: String(formData.get("color") ?? ""),
    },
    prisma
  );
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/", "layout"); // 刷新 layout 中的欢迎语
  return { ok: true };
}
```

#### page.tsx

简单表单：username 只读 / displayName input / color picker / 保存按钮 / 登出。impeccable 风格。

提交：`feat: add settings page (display name + color edit)`

---

### Task 4: /week 周视图

**Files:**
- Create: `src/app/(app)/week/page.tsx`
- Create: `src/app/(app)/week-view.tsx`

UX：
- searchParams `?d=2026-05-06`（默认 todayKey）
- 用 `weekRange(d)` 算出周一到周日 7 天
- 顶部：上周/下周/本周 切换器，显示"5 月 4 日 - 5 月 10 日"
- 主区：左侧 task panel（同 month-view），右侧 7 列网格，每列竖向更高（包含图标聚合 + 心声预览前 30 字）
- 点格子打开 day-detail-sheet（同 month-view 行为）
- 选 task + 点格子 = 加事件（同 month-view）

数据：拉本周的 occurrences + notes。复用 occurrencesByDate / notesByDate 的 record 结构。

调 impeccable（继承 month-view 视觉但密度不同）。

提交：`feat: add /week view`

---

### Task 5: /u/[username] 看某人（只读）

**Files:**
- Create: `src/app/(app)/u/[username]/page.tsx`

实现：
- `await ctx.params` 拿 username
- 查目标用户：`prisma.user.findUnique({ where: { username } })`，找不到 → `notFound()`
- 如果 viewer === target → `redirect("/")`
- 数据：用 `scopeTasksWhere(viewerId, ownerId)` 过滤 tasks（只公开 + 不归档）
- 复用 month-view 组件，加 prop `mode: "readonly"`，进 readonly 模式：
  - 任务面板不可点选（不能加事件）
  - 点格子只能打开 day-detail-sheet
  - sheet 内 + - 按钮 / 心声编辑器 textarea 全 disabled

修改 month-view + day-detail-sheet + note-editor 接受 readonly prop。

提交：
- `feat: support readonly mode in month-view + day-detail-sheet`
- `feat: add /u/[username] view for browsing a circle member`

---

### Task 6: /timeline 合并时间轴

**Files:**
- Create: `src/app/(app)/timeline/page.tsx`
- Create: `src/app/(app)/timeline-view.tsx`

UX：
- searchParams `?y=&m=&period=month|week`（默认本月）
- 顶部：月 / 周切换 + 上一段 / 下一段 / 现在
- 主区：表格状，行=用户（按字母 or createdAt 排序），列=日期
- 每格：图标聚合 + 心声预览（hover 完整文本）
- 点格 → 打开 day-detail-sheet（如果是自己的格子可编辑，别人的只读）
- 私密任务的事件不显示（在 query 层过滤）
- 自己用 task.color 染色，别人用 user.color 染色

数据：
- 拉所有用户（layout 已 fetch，但 page 重新查也行）
- 用 `scopeOccurrencesWhere(viewerId, allUserIds)` 拉本期事件
- 拉所有用户的 notes（暂不过滤）

调 impeccable。这是新设计。

提交：`feat: add /timeline merged multi-user view`

---

### Task 7: 进度徽章

**Files:**
- Modify: `src/app/(app)/page.tsx`、`week/page.tsx` 拉额外的"本周/本月聚合"数据
- Modify: `src/app/(app)/task-panel.tsx` 渲染徽章

简化方案：
- 在 `/` 和 `/week` 页面查 `本周` + `本月` 的事件聚合（按 taskId GROUP BY）
- 传给 task-panel
- task-panel 对每个 COUNTED 任务，按 task.targetPeriod 显示对应 period 的"n/target"
- 达成时绿色，未达灰色，超额时高亮

实现：
```ts
const weekR = weekRange(todayKey);
const monthR = monthRange(year, month);
const weekAgg = await prisma.occurrence.groupBy({
  by: ["taskId"],
  where: { userId: user.id, date: { gte: weekR.start, lte: weekR.end } },
  _sum: { count: true },
});
// 同样 monthAgg
```

提交：`feat: show period progress badge on counted tasks`

---

### Task 8: E2E

新建 `tests/e2e/multiuser.spec.ts` 和 `tests/e2e/week.spec.ts` 和 `tests/e2e/settings.spec.ts`。

至少：
- multiuser:
  1. 创建第二个测试用户 `e2e_bob`（在 beforeAll 用 seed）
  2. 给 alice 建一个公开任务 + 一个私密任务
  3. bob 登录 → 访问 /u/e2e_alice → 只看到公开任务
  4. /timeline 上看到两人
- week:
  1. 登录 → 访问 /week → 看到本周 7 列
  2. 选任务 + 点格子 → 图标出现
- settings:
  1. /settings → 改 displayName 和 color → 顶部 nav 立即更新

`scripts/e2e-clean-tasks.js` 也要清 `e2e_bob`。

提交：`test: add E2E for multiuser views, week view, settings`

---

### Task 9: 全量回归 + Plan 5 收官

- vitest 全绿
- E2E 全绿
- build 通过
- 手动 smoke：所有 5 路由（/、/week、/timeline、/u/x、/settings）跑通；私密任务在他人视角不可见
- README 更新
- commit `docs: update README for Plan 5 multiuser views`

---

## Plan 5 验收清单

- [ ] vitest + e2e 全绿
- [ ] build 通过
- [ ] /week 可用，能选任务点格子加事件
- [ ] /u/[username] 看到他人公开任务和心声，私密任务不显示
- [ ] /u/self → redirect /
- [ ] /timeline 显示所有用户的当月事件，私密过滤生效
- [ ] /settings 能改昵称 + 颜色，nav 立即更新
- [ ] 进度徽章在 /、/week 上显示
- [ ] 顶部 nav 在每个页面都有
- [ ] readonly mode：他人视角不能加事件、不能编辑心声

通过后进入 Plan 6（Docker 部署）。
