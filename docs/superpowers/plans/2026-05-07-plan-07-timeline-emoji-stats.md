# 日历记账 — Plan 7: 时间轴月/周切换 + 自定义 emoji + 统计

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 三件事一起做：
1. `/timeline` 加月/周切换（spec §4.6 当初就提到，Plan 5 只做了月，补齐）
2. emoji picker 支持自定义分类 + 自定义收藏的 emoji（Unicode-only，不上传图片）
3. 新增 `/stats` 页面，按 年/月/周 看统计（任务总次数 + 目标达成率 + streak + 热力图日历）

**用户确认的决策：**
- 自定义 emoji：**只支持 Unicode**（不做图片上传）
- 统计内容：任务总次数 + 目标达成率 + CHECK streak + GitHub 热力图（不做圈内对比）
- 可视化：**数字 + 手绘 SVG 条形图**（不引入图表库）

**Architecture:**
- 时间轴：URL 加 `?period=month|week&d=YYYY-MM-DD`，复用 `weekRange`/`monthRange` helper
- Emoji：新 Prisma model `EmojiCategory` + `CustomEmoji`，per-user 持久化；built-in 仍硬编码但扩充
- Stats：`/stats` 新页面，server-side 聚合（`groupBy` + 客户端汇总），SVG 自绘

---

## ⚠ 实施前的关键坑点

### Timeline 月/周

1. **searchParams 兼容**：现有 `/timeline?y=2026&m=5` 还要继续工作。新参数 `period` 默认 `month` 时保留旧行为。
2. **prev/next 步长**：month 模式按月（已有），week 模式按周（差 7 天）。共用一个组件，传 period 区分。
3. **「现在」按钮**：跳到当前 period 的开始（本月 1 号 or 本周一）。
4. **格子宽度**：month 模式 31 列拥挤；week 模式 7 列宽松。**条件 CSS：`.tl-grid[data-period="week"] .tl-day-cell { width: 4× }`** 或类似。
5. **心声预览**：week 模式格子大，可以显示文字预览（month 模式只显示点）。

### Emoji 数据模型

6. **per-user 分类 vs 全局共享**：选 **per-user**。每人有自己的分类和收藏。系统不重复，简单。
7. **同分类内 emoji 不重复**：DB 加 `@@unique([categoryId, emoji])`。
8. **emoji 长度**：emoji 实际可以是 1-7 个 UTF-16 code unit（带 ZWJ 组合 emoji 更长）。表单 `maxLength=8`，DB `String` 无限制。**只校验非空 + ≤ 8 字符**，不验证是不是真的 emoji（用户输什么就显示什么，自由）。
9. **删除分类时 cascade**：分类下所有 emoji 一起删（FK Cascade）。
10. **删除一个 CustomEmoji 不影响已经用了它的任务**：Task.icon 是 String，存的就是 emoji 字符，DB 里没有 FK 引用 → 删 CustomEmoji 不影响 Task。

### Emoji 管理 UI

11. **新建分类**：输入名字 → 创建
12. **删除分类**：二次确认（"删除后该分类下所有 emoji 收藏也会删除"），但**已经被任务用过的 emoji 仍然显示在任务上**（它们是 String，与分类解耦）
13. **添加 emoji 到分类**：弹一个完整 Unicode emoji picker（grep 自带 1000+ emoji 列表），点选 → 加入
14. **不要让用户能改 built-in 分类**：built-in 5-8 个分类硬编码 + 不可编辑

### Emoji Picker 重构

15. **EmojiPicker 现在是 client component**：要让它能拿到 user 的 categories
16. **方案 A**：父组件（task-form is 'use client'）的父级（page is RSC）先拉数据传下来
17. **方案 B**：EmojiPicker 自己用 fetch 拉
18. **选 A**：减少 fetch 数 + 服务端拉更快 + 与现有 page.tsx 模式一致

### Stats 数据聚合

19. **年视图**：拉整年的 occurrence + group by date → 366 个点。groupBy 用 Prisma raw SQL 或 `groupBy({by: ["date"], _sum: {count}})`
20. **目标达成率计算**：
    - DAY 任务：在统计 period 内的天数中，有多少天 `当天 SUM(count) >= target`
    - WEEK 任务：period 内的周数中，有多少周达标
    - MONTH 任务：period 内的月数中，有多少月达标
    - 公式：达成数 / 总数 = 比率
21. **Streak**：单个 CHECK 任务的当前+历史最长连续 streak。算法：拉所有 date，sort，扫一遍找最长连续段。**当前 streak**：从今天往前数（包含今天的话只看 today 在不在；不包含的话从昨天看），实务上"截至今天还在持续"才算。MVP：拉所有日期，从 todayKey 往前每天检查是否有，找连续段。
22. **热力图**：年视图下，渲染 53 周 × 7 天 ≈ 371 格的网格；每格颜色 = 当天总事件数映射到色阶（0/1-3/4-7/8-15/16+ 五档）
23. **当前周/月聚合可以缓存**：`progressByTaskId` 已经在 /、/week 计算了一遍。stats 是独立的，不强依赖。**不做缓存**，每次 server render 现拉。

### Stats UI

24. **页面分区**：顶栏（period 选择 + nav + label）+ 概览数字卡片 + 任务统计列表 + Streak 列表（仅 CHECK 任务）+ 热力图（仅年视图）
25. **手绘 SVG 条形**：每个 task 一条 `<svg><rect></svg>`，宽度按值 / max 算
26. **图表配色**：用 task.color（已是 OKLCH 风的 hex）。坚持现有美学
27. **空数据**：当 period 内零事件时显示"还没记录"

### 通用

28. **不引图表库**（Recharts 等）：保持自部署轻量 + 与现有手作美学一致
29. **响应式**：stats 在窄屏单列堆叠；timeline week 模式即便窄屏也比 month 模式好看（7 列）
30. **测试覆盖**：emoji actions + stats helpers 都 TDD；时间轴 UI 改主要靠 E2E

---

## 文件结构

```
prisma/
  schema.prisma                            # +EmojiCategory +CustomEmoji
  migrations/<ts>_add_emoji_models/        # 迁移
src/
  lib/
    emoji-constants.ts                     # 扩充的 built-in emoji 列表（8 类 × 30+）
    emoji-validation.ts                    # 校验 + 单测
    stats.ts                               # 统计聚合 helpers + 单测
  app/
    (app)/
      timeline/
        page.tsx                           # 修改：加 ?period 参数
      timeline-view.tsx                    # 修改：支持 week mode
      emojis/
        page.tsx                           # /settings/emojis 或 /emojis 管理页
        actions.ts
        actions-core.ts
      tasks/
        emoji-picker.tsx                   # 重构：接 categories prop
      stats/
        page.tsx                           # /stats RSC
        stats-view.tsx                     # 'use client' 顶栏切换 + 内容
        heatmap.tsx                        # SVG 热力图组件
        task-bars.tsx                      # SVG 条形图
        streak-list.tsx                    # CHECK 任务 streak
tests/
  unit/
    emoji-validation.test.ts
    stats.test.ts
  integration/
    emoji-actions.test.ts
  e2e/
    plan7.spec.ts                          # timeline period 切换 + emoji 管理 + stats
```

---

### Task 1: Timeline 月/周切换

**Files:**
- Modify: `src/app/(app)/timeline/page.tsx`
- Modify: `src/app/(app)/timeline-view.tsx`

#### 行为

URL params:
- `period=month|week`（默认 month）
- `d=YYYY-MM-DD`（默认 todayKey；锚定一个具体日期，period 派生范围）
- 旧的 `y` 和 `m` 也兼容（month 模式下，等价于 `d=YYYY-MM-01`）

行为：
- month 模式：现状不变
- week 模式：
  - 起止用 `weekRange(d)` 算（周一到周日）
  - 7 列
  - 每列宽度 ~ 4× month 模式
  - 每格高度 ~ 2× month 模式，能展示心声预览前 30 字
  - prev/next 按周
  - 今天高亮（如果在本周内）

顶栏：
- 月/周 toggle（在月份 label 旁边）
- prev/next 按钮（按 period 步长）
- "现在" 按钮（period=month → 当月；period=week → 本周）

#### 步骤

1. 改 page.tsx：parse period + d，调相应 helper（monthRange / weekRange）算 [start, end]，查 occurrences 和 notes
2. 改 timeline-view.tsx：接 period prop，按 period 渲染 N 列
3. 调 impeccable 微调 week 模式视觉密度
4. 手动 smoke：登录 → /timeline → 切换月/周 → 切换上下 period
5. 提交：`feat: add month/week period toggle to /timeline`

---

### Task 2: Emoji 数据模型 + actions（TDD）

**Files:**
- Modify: `prisma/schema.prisma`（+EmojiCategory +CustomEmoji + relation on User）
- Migration
- Create: `src/lib/emoji-validation.ts` + test
- Create: `src/app/(app)/emojis/actions-core.ts` + integration test
- Create: `src/app/(app)/emojis/actions.ts`

#### Schema

```prisma
model User {
  // ... existing ...
  emojiCategories EmojiCategory[]
}

model EmojiCategory {
  id        Int           @id @default(autoincrement())
  userId    Int
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String                                            // 1-20 chars
  sortOrder Int           @default(0)
  createdAt DateTime      @default(now())
  emojis    CustomEmoji[]
  @@index([userId])
}

model CustomEmoji {
  id         Int           @id @default(autoincrement())
  categoryId Int
  category   EmojiCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  emoji      String                                            // 1-8 chars
  sortOrder  Int           @default(0)
  createdAt  DateTime      @default(now())
  @@unique([categoryId, emoji])
  @@index([categoryId])
}
```

#### test-db.ts reset 顺序

```typescript
await p.customEmoji.deleteMany();
await p.emojiCategory.deleteMany();
// ... 其余顺序不变
```

#### Validation

`emoji-validation.ts`:
```typescript
export const CATEGORY_NAME_MAX = 20;
export const EMOJI_MAX_LENGTH = 8;
export const CATEGORIES_PER_USER_MAX = 20;
export const EMOJIS_PER_CATEGORY_MAX = 200;

export function validateCategoryName(s: string) { /* trim + ≤ 20 */ }
export function validateEmoji(s: string) { /* 非空 + ≤ 8 */ }
```

测试：覆盖各种边界。

#### actions-core

```typescript
createCategoryCore(userId, name, prisma) → Result<{category}>
renameCategoryCore(userId, categoryId, newName, prisma) → Result<{category}>
deleteCategoryCore(userId, categoryId, prisma) → Result<{deletedId}>
addEmojiCore(userId, categoryId, emoji, prisma) → Result<{customEmoji}>
removeEmojiCore(userId, customEmojiId, prisma) → Result
reorderCategoriesCore(userId, ids[], prisma) → Result    # MVP 可不做
reorderEmojisCore(userId, categoryId, ids[], prisma) → Result    # MVP 可不做
listCategoriesCore(userId, prisma) → Category[] with emojis    # RSC 读
```

权限：每个动作 enforce ownership。

测试覆盖：
- happy paths
- 校验失败（空名、超长、重复）
- 操作别人的分类 → 失败
- 不存在的分类 → 失败
- per-user limit（≤ 20 分类，每分类 ≤ 200）

#### actions.ts

5-7 个薄包装：调 requireAuth → call core → revalidatePath(`/settings/emojis`)。

#### 提交

- `feat: add EmojiCategory + CustomEmoji Prisma models`
- `feat: add emoji-validation helpers`
- `feat: add emoji actions-core (create/rename/delete category, add/remove emoji)`
- `feat: add emoji server action wrappers`

---

### Task 3: 扩充 built-in emoji + emoji-picker 重构

**Files:**
- Create: `src/lib/emoji-constants.ts`（built-in 8 类 × 30+ emojis）
- Modify: `src/app/(app)/tasks/emoji-picker.tsx`（接 customCategories prop）
- Modify: `src/app/(app)/tasks/task-form.tsx`（接 RSC 传下来的 categories）
- Modify: `src/app/(app)/tasks/page.tsx`（RSC 拉 user 的 customCategories 传给 form）

#### built-in 扩充

8 类（每类 30 emoji）：
- 食物 🍎🍊...
- 饮品 ☕🍵🍺🍷🥤🧋... ← 新
- 运动 🏃🚴...
- 学习 📚✏️📝💡... ← 新（与"物品"重叠少量）
- 心情 😊😌...
- 自然 🌸🌺...
- 时间 ⏰📅📆⌚🌅🌄... ← 新
- 物品 📷💻📱...

总 ~ 240 个。

#### EmojiPicker 重构

接收 prop `customCategories: Array<{id, name, emojis: string[]}>`。
渲染：8 个 built-in tab + N 个 custom tab + "管理 emoji" 链接。
"管理 emoji" 跳 `/settings/emojis` 或新的 `/emojis`（决定见 Task 4）。

#### 提交
- `feat: expand built-in emoji set to 8 categories`
- `feat: emoji-picker reads custom categories from props`
- `feat: tasks page loads user emoji categories and passes to form`

---

### Task 4: Emoji 管理 UI

**Files:**
- Create: `src/app/(app)/emojis/page.tsx` (or `(app)/settings/emojis/page.tsx`)
- Create: `src/app/(app)/emojis/emoji-manage-view.tsx` ('use client')

#### 路由决策

放在 `/emojis`（独立路由）OR `/settings/emojis`（子页）。
**选 `/settings/emojis`**：emoji 管理是个人偏好，settings 子页面合适。
但是放进 nav 还是不？不要，太挤。从 `/settings` 主页加个链接 + 从 EmojiPicker 的"管理"按钮跳过去。

#### 功能

UI 上下分两区：
1. **分类列表**：左侧列出所有自定义分类，点击切换；最下方 "+ 新建分类"
2. **当前分类详情**：右侧
   - 顶部：分类名 + 重命名按钮 + 删除按钮（红字 + 确认）
   - 中部：emoji 网格，每个有 × 删除小按钮
   - 底部："+ 添加 emoji" 按钮 → 弹出完整 Unicode emoji 选择器（用现有的扩充 built-in + 一个 input 让用户粘贴任意 emoji）

调 impeccable craft。

#### 提交
- `feat: add /settings/emojis page for managing custom categories and emojis`

---

### Task 5: Stats 数据层（TDD）

**Files:**
- Create: `src/lib/stats.ts` + tests

```typescript
// stats.ts

export interface TaskStatsRow {
  taskId: number;
  taskName: string;
  taskIcon: string;
  taskColor: string;
  taskType: "COUNTED" | "CHECK";
  taskTargetCount: number | null;
  taskTargetPeriod: "DAY" | "WEEK" | "MONTH" | null;
  totalCount: number;
  // For COUNTED: percentage of periods that hit target (0-1)
  targetHitRate: number | null;
}

export interface StreakRow {
  taskId: number;
  taskName: string;
  taskIcon: string;
  taskColor: string;
  currentStreak: number;
  longestStreak: number;
}

export interface HeatmapDay {
  date: string;             // YYYY-MM-DD
  totalCount: number;
}

export function computeTaskStats(
  tasks: Task[],
  occurrences: Occurrence[],
  rangeStart: string,
  rangeEnd: string,
  period: "year" | "month" | "week"
): TaskStatsRow[] { /* ... */ }

export function computeStreaks(
  checkTasks: Task[],
  occurrences: Occurrence[],
  todayKey: string
): StreakRow[] { /* longest run / current run, scanning sorted dates */ }

export function computeHeatmap(
  occurrences: Occurrence[],
  rangeStart: string,
  rangeEnd: string
): HeatmapDay[] { /* sum per date, fill zeros */ }

export function colorBucket(count: number): 0 | 1 | 2 | 3 | 4 {
  // 0 / 1-3 / 4-7 / 8-15 / 16+
}
```

#### Test cases

- computeTaskStats 空数据 → 全部 0
- COUNTED 日目标：达成天数 / period 天数
- COUNTED 周目标：达成周数 / period 周数（要按周分组）
- CHECK 任务：targetHitRate = null
- computeStreaks：
  - 全 0 events → current=0, longest=0
  - 连续 5 天 + 今天有 → current=5+1=6, longest=6
  - 7 天 streak 结束在昨天 + 今天没有 → current=0, longest=7
- computeHeatmap：fill zeros for missing dates
- colorBucket：5 档边界

#### 提交
- `feat: add stats helpers (computeTaskStats, computeStreaks, computeHeatmap)`

---

### Task 6: /stats 页面（impeccable）

**Files:**
- Create: `src/app/(app)/stats/page.tsx` (RSC)
- Create: `src/app/(app)/stats/stats-view.tsx` ('use client')
- Create: `src/app/(app)/stats/heatmap.tsx`
- Create: `src/app/(app)/stats/task-bars.tsx`
- Create: `src/app/(app)/stats/streak-list.tsx`

#### URL params
`/stats?period=year|month|week&d=YYYY-MM-DD`，默认 month + today

#### page.tsx RSC

1. parse params
2. 算 [start, end]：
   - year: `${year}-01-01` ~ `${year}-12-31`
   - month: monthRange(year, month)
   - week: weekRange(d)
3. 拉 tasks（own active+archived 不限，看历史包括归档任务的统计；但归档不参与 COUNTED 达成率因为 archived 后没新事件）
4. 拉 occurrences in range
5. 计算 stats（taskStats / streaks / heatmap）
6. 传给 stats-view

#### stats-view layout

- 顶栏：年/月/周 toggle + prev/next + "现在"
- 概览数字卡片（一行 3-4 张）：总事件数 / 活跃任务数 / 涉及天数 / 完成率（aggregate）
- 任务统计 bar 列表：每个 COUNTED 任务一条横向 bar + 数字 "12/12"，达成绿；每个 CHECK 任务"打卡 X 天"
- Streak 列表：仅 CHECK 任务，"当前 X 天 / 最长 Y 天"
- 热力图：年视图渲染整年；月视图渲染本月；周视图省略（7 格没意义，直接不显示）

#### Nav bar 加 stats 链接

在 nav-bar.tsx 加 "统计" 链接到 `/stats`。

#### 提交
- `feat: add /stats page with task bars, streaks, and heatmap`
- `feat: add 统计 link to nav bar`

---

### Task 7: E2E

`tests/e2e/plan7.spec.ts` covering:
- timeline period toggle work（点月→看一种 layout，点周→另一种）
- emoji management 新建分类 + 加 emoji + 删除
- stats 页面访问 + period 切换看不到崩溃 + 看得到任务条形

#### 提交
- `test: add E2E for timeline period, emoji manage, stats`

---

### Task 8: 全量回归 + Plan 7 收官

- vitest 全绿
- e2e 全绿
- build 干净
- 手动 smoke 走完整流程
- 更新 README

提交：`docs: update README for Plan 7`

---

## Plan 7 验收

- [ ] vitest + e2e 全绿
- [ ] build 通过
- [ ] /timeline 月/周可切换，prev/next 按 period 步进
- [ ] 自定义分类创建/重命名/删除
- [ ] 自定义 emoji 添加/删除
- [ ] 任务表单 emoji picker 显示 built-in + custom 分类
- [ ] /stats 年/月/周 都能渲染
- [ ] COUNTED 任务条形图显示总数 + 达成率
- [ ] CHECK 任务 streak 显示
- [ ] 年视图热力图渲染 366 格
- [ ] nav 加"统计"链接
