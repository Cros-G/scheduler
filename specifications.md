# 日历记账应用 — 设计规格 (Specifications)

> Last updated: 2026-05-06
> Status: Draft v2 — adds Admin user management UI (Plan 5.5)

---

## 1. 概述

一个以**日历**为核心的多人任务记录与心情记录应用。两类核心实体：

- **任务（Task）**：用户预先定义的、有图标的活动（如"吃苹果"），分两类：
  - **次数型 (COUNTED)**：有目标，比如"每周跑步 3 次"、"每月吃 20 个苹果"
  - **打卡型 (CHECK)**：每天 0/1，比如"今日冥想"
- **心声（DailyNote）**：每个用户每天一条的纯文本笔记（支持 emoji + 图片）

任务发生时，用户在日历上把图标"放"进对应的格子（拖拽或点击）。月视图为主，周视图次之。账号采用伴侣 / 小圈子模式，由管理员（你本人）通过种子脚本创建，不开放注册。

---

## 2. 用户与使用场景

- **典型用户**：2~5 人的小圈子（伴侣、家人、好友）
- **使用频率**：每天 1~N 次，主要是打开看日历 + 戳一下图标
- **设备**：主要桌面浏览器，偶尔手机浏览器（响应式即可，不做原生 App）
- **典型动作**：
  - 早晨：打开月视图，看看昨天大家做了什么 → 在合并时间轴里浏览
  - 白天：完成一项任务 → 点对应任务图标 → 在今天格子里加一个图标
  - 晚上：写当日心声 + 上传 1-2 张图

---

## 3. 角色与权限

| 角色 | 能做什么 |
|---|---|
| 管理员（admin） | 通过 `/admin` 后台 UI 创建/删除/重置密码/切换管理员标记；其余等同普通用户。User.isAdmin = true |
| 普通用户 | 维护自己的任务（增删改）、记录自己的事件、写自己的心声、查看圈内其他人的公开任务与心声 |

**首个管理员**：项目首次部署时仍用 CLI（`pnpm seed:user --admin`）创建第一个管理员账号；之后所有账号管理都走 `/admin` 页面。CLI 仍保留作为运维兜底。

**自我保护**：
- 管理员不能在 `/admin` 里删自己（防止误删后无人能管理系统）
- 管理员不能取消自己的 admin 标记（同理；要降级自己得让另一个 admin 操作）
- 系统至少要有一个 admin 账号 —— 删最后一个 admin 时拒绝

---

## 4. 功能清单（MVP 范围 = 全部）

### 4.1 认证

- 登录页：用户名 + 密码 → 服务端校验 → 写 HTTP-only Cookie session
- 登出（清 cookie + 删 session 记录）
- **不做**：自助注册、密码找回、邮箱验证、修改密码（管理员通过 CLI 重置）

### 4.2 任务管理 (Task CRUD)

创建任务，字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| 名称 | ✓ | ≤ 30 字 |
| 图标 | ✓ | emoji 字符（MVP 用 emoji picker，不做自定义图库） |
| 颜色 | ✓ | 从预设色板选；用于合并视图区分 |
| 类型 | ✓ | 次数型 / 打卡型；**创建后不可修改** |
| 目标次数 | 仅次数型 | 正整数 |
| 目标周期 | 仅次数型 | 日 / 周 / 月 |
| 私密 | — | 默认公开；私密时他人完全不可见 |

操作：

- **编辑**：除"类型"外都可改
- **归档**：软删除，保留历史记录但不出现在选择器（可恢复）
- **真删除**：仅当任务无任何事件记录时允许

### 4.3 事件记录 (Occurrence)

任务面板：左侧（或抽屉）列出当前用户的活动任务（图标 + 名称）。

添加事件：

- 拖拽任务图标到日历格子 → 加一次（桌面优先）
- 点击任务图标后再点格子（移动端 / 备选）
- 在"日详情"弹窗里按 + 增加（可一次性 +N，例如"今天吃了 3 个苹果"）

减少 / 删除：日详情弹窗里点图标减一，或长按删除。

显示：

- 同一格内多次：图标 + 数字角标（≥ 2 时显示）
- 打卡型：当日 0/1，重复点击不会加倍

### 4.4 日详情面板（点击日历格子触发）

- 显示这一天所有事件（按用户分组、组内按时间排序）
- 当前用户区：可加减事件、写 / 编辑心声
- 其他用户区：只读（仅显示公开数据）
- 心声编辑器：
  - 纯文本 + emoji，≤ 10000 字
  - 图片 ≤ 6 张，每张 ≤ 5MB（jpg / png / webp / gif）
  - 当日仅一条，再次保存即覆盖

### 4.5 日历视图

**月视图**（默认主页）：

- 标准月历网格（6 行 × 7 列）
- 格子内堆叠图标，多于阈值时折叠为"+N"角标
- 顶部导航：上月 / 下月 / 今天

**周视图**：

- 一周 7 列，纵向更高，能塞更多图标 + 心声预览
- 顶部导航：上周 / 下周 / 本周

**进度可视化**（次数型任务）：

- 日目标：当天达标显示绿勾，未达灰色
- 周目标：周视图顶部 / 月视图侧栏显示"2/3"+ 进度条
- 月目标：月视图顶部显示"15/20"+ 进度条

### 4.6 多人视图

通过顶部切换器在三种模式间切换：

1. **我的视图**（默认）：只显示我自己的任务和心声
2. **某人视图**：选择某用户，显示其公开任务和公开心声（只读）
3. **合并时间轴视图**：
   - 月或周布局，**每行一个用户**，按日期为列
   - 行内按日期列出该用户当天的图标 + 心声预览（截断）
   - 私密任务及其事件不出现在他人视角

### 4.7 隐私

- 任务级私密开关：私密时，他人在所有视图（含合并时间轴）都看不到该任务及其事件
- 心声暂不做私密开关（MVP 简化），全部对圈内可见
  - 注：未来加私密只需一次小迁移，不会破坏现有数据

### 4.8 用户管理（仅管理员）

`/admin` 页面（路由级 guard：非 admin → 403 / 跳 `/`）。

**用户列表**：表格展示所有账号，列出 `用户名`、`昵称`（带颜色 dot）、`是否管理员`、`创建时间`、`操作`。

**创建账号**（"+ 新建账号"按钮）：
- 字段：`username`（必填，3-30 字，仅字母数字下划线）、`displayName`（必填，≤ 30 字）、`password`（必填，≥ 6 字）、`color`（从 12 色板选）、`isAdmin`（默认 false）
- 校验：`username` 不能与现有账号重复（已 unique 约束 + UI 友好提示）
- 后端：调 `createUserAction` → 哈希密码 + insert User

**重置密码**：行内"重置密码"按钮 → 弹框输入新密码（≥ 6 字）→ 调 `resetPasswordAction(userId, newPw)` → 同时清掉该用户所有 Session（强制重登）

**改昵称 / 颜色 / admin 标记**：行内"编辑"按钮 → 弹框/抽屉编辑 → 调 `updateUserAction(userId, fields)`
- **不允许**改 username（数据完整性，避免破坏 url 引用）

**删除账号**：行内"删除"按钮 → 二次确认（输入 username 验证）→ 调 `deleteUserAction(userId)` → 级联删该用户的所有 Task/Occurrence/DailyNote/NoteImage/Session（已有 Cascade FK）+ 异步清理磁盘上该用户的 uploads 目录
- 自我保护见 §3：不能删自己；不能删最后一个 admin

**审计**：MVP 不做（spec §14 已经把"audit log"列为非目标）

---

## 5. 页面与路由

| 路由 | 说明 |
|---|---|
| `/login` | 登录页 |
| `/` | 月视图（默认主页，登录后） |
| `/week` | 周视图 |
| `/timeline` | 合并时间轴视图（月 / 周可切） |
| `/tasks` | 任务管理页（列表 + 创建/编辑） |
| `/u/[username]` | 看某人的视图（只读） |
| `/settings` | 个人设置（昵称、颜色、登出） |
| `/admin` | **仅 admin** — 用户管理（增 / 删 / 重置密码 / 改昵称 / 切换 admin 标记） |

---

## 6. 数据模型 (Prisma Schema)

```prisma
// schema.prisma
datasource db { provider = "sqlite"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

model User {
  id           Int          @id @default(autoincrement())
  username     String       @unique
  passwordHash String
  displayName  String
  color        String       // hex 颜色，用于合并视图
  isAdmin      Boolean      @default(false)
  createdAt    DateTime     @default(now())
  tasks        Task[]
  occurrences  Occurrence[]
  notes        DailyNote[]
  sessions     Session[]
}

model Session {
  id        String   @id              // 32 字节随机 token
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@index([userId])
}

enum TaskType { COUNTED CHECK }
enum Period   { DAY WEEK MONTH }

model Task {
  id           Int          @id @default(autoincrement())
  userId       Int
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  name         String
  icon         String       // emoji
  color        String       // hex
  type         TaskType
  targetCount  Int?         // 仅 COUNTED
  targetPeriod Period?      // 仅 COUNTED
  isPrivate    Boolean      @default(false)
  archivedAt   DateTime?
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  occurrences  Occurrence[]
  @@index([userId])
}

model Occurrence {
  id        Int      @id @default(autoincrement())
  taskId    Int
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  userId    Int      // 冗余字段，方便按用户筛
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  date      String   // 'YYYY-MM-DD'，按服务器时区计算
  count     Int      @default(1)  // COUNTED 任务的本条次数；CHECK 任务永远 1
  createdAt DateTime @default(now())
  @@index([userId, date])
  @@index([taskId, date])
  // CHECK 类型靠应用层保证 (taskId, date) 唯一
}

model DailyNote {
  id        Int         @id @default(autoincrement())
  userId    Int
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  date      String      // 'YYYY-MM-DD'
  content   String      // ≤ 10000 字
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  images    NoteImage[]
  @@unique([userId, date])
}

model NoteImage {
  id           Int       @id @default(autoincrement())
  noteId       Int
  note         DailyNote @relation(fields: [noteId], references: [id], onDelete: Cascade)
  filePath     String    // 相对 uploads 根目录
  originalName String
  sizeBytes    Int
  mimeType     String
  sortOrder    Int       @default(0)
  createdAt    DateTime  @default(now())
  @@index([noteId])
}
```

### Occurrence 模型取舍说明

采用"**每次发生一行**"而非"每天每任务一行 + count"：

- **优点**：保留 createdAt 时间戳，将来可做"今天什么时候发生的"时间轴；删除单次更直观
- **代价**：COUNTED 任务的"今天总次数"需要 `SUM(count) GROUP BY (taskId, date)`，但数据量小，无性能问题
- 字段保留 `count`：允许一次性记录"今天吃了 3 个苹果"（一行 count=3），既能批量加也能逐个加

---

## 7. 时间 / 周期处理

- **服务器时区**：通过环境变量 `TZ` 设置（默认 `Asia/Shanghai`），所有日期边界以此计算
- **日**：`YYYY-MM-DD`
- **周**：ISO 周（周一 ~ 周日）
- **月**：日历月

进度计算（次数型任务）：

| 周期 | 计算 |
|---|---|
| 日 | 当天 `SUM(count)` / `targetCount` |
| 周 | 本周（周一 0:00 ~ 周日 23:59）`SUM(count)` / `targetCount` |
| 月 | 本月（1 日 ~ 月末）`SUM(count)` / `targetCount` |

---

## 8. API / Server Actions

### Server Actions（数据写）

任务：`createTask / updateTask / archiveTask / unarchiveTask / deleteTask`
事件：`addOccurrence(taskId, date, delta=1)` / `removeOccurrence(id)` / `setCheck(taskId, date, on)`
心声：`upsertNote(date, content)` / `deleteNoteImage(id)` / `reorderNoteImages(ids[])`

### Route Handlers（少量 REST）

| Method | 路径 | 说明 |
|---|---|---|
| POST | `/api/login` | 用户名 + 密码 → set cookie |
| POST | `/api/logout` | 清 session |
| POST | `/api/uploads` | multipart 上传图片，返回 fileId 列表 |
| GET  | `/api/uploads/[file]` | 鉴权后流式返回图片 |

### 视图查询

直接在 Server Component 里 `prisma.xxx.findMany`，不暴露 GET API（YAGNI）。

---

## 9. 文件存储

- 数据根由环境变量 `DATA_DIR` 指定（默认 `./data`，生产可设 `/var/scheduler/`）
- `${DATA_DIR}/scheduler.db` —— SQLite 数据库文件
- `${DATA_DIR}/uploads/${userId}/${YYYY-MM}/${uuid}.${ext}` —— 上传图片
- 图片访问 **必须**走 `/api/uploads/[file]`，应用层鉴权：未登录或对方私密 / 不可见 → 403

---

## 10. 认证细节

- 密码哈希：`bcrypt`（cost 12）
- Session token：`crypto.randomBytes(32).toString('hex')`，存数据库
- Cookie：`HttpOnly`, `Secure`（生产）, `SameSite=Lax`, `Path=/`
- 默认过期 30 天，每次访问滑动续期到 30 天
- `middleware.ts` 拦截除 `/login`, `/api/login`, 静态资源外的所有路由，校验 session

---

## 11. 账号种子 CLI

CLI 仅用于**首次部署**创建第一个管理员，以及运维兜底（admin 把自己锁死时）。日常账号管理走 `/admin` 页面。

```bash
# 创建首个管理员（必须 --admin）
pnpm seed:user --username alice --display "Alice" --password '...' --color '#FF8888' --admin

# 兜底重置密码（admin 忘了自己的密码时）
pnpm seed:reset-password --username alice --password '新密码'
```

脚本位于 `scripts/seed-user.ts` 和 `scripts/reset-password.ts`。

---

## 12. 部署

- 容器化：Dockerfile + `docker-compose.yml`，挂载 `${DATA_DIR}` 数据卷
- 反向代理：Nginx / Caddy 终结 HTTPS
- 备份：cron 每天打包 `${DATA_DIR}` → 异地存储（README 给示例脚本，不在应用代码内）

---

## 13. 技术栈总结

| 层 | 选型 |
|---|---|
| 框架 | Next.js 15 (App Router) + TypeScript |
| UI | React + Tailwind CSS + shadcn/ui |
| 拖拽 | @dnd-kit/core（支持触屏） |
| ORM | Prisma + SQLite |
| 认证 | 自实现（bcrypt + cookie） |
| 上传 | Next.js Route Handler，multipart 解析用 `formidable` 或 `busboy` |
| Emoji 选择器 | `emoji-picker-react` 或类似 |
| 包管理 | pnpm |
| 部署 | Docker + Docker Compose |

---

## 14. 非目标 (Non-Goals)

明确**不做**的：

- 用户自助注册（账号一律由 admin 在 `/admin` 创建）
- 密码找回 / 邮箱验证 / 邮件
- 圈子 / 多群组（所有账号默认同一个圈子，互相可见）
- 用户操作审计日志（admin 删账号 / 重置密码不记录历史）
- 任务模板 / 社区分享
- 导出 / 导入数据（备份靠运维层 cron）
- 推送通知 / 提醒 / Webhooks
- 移动端原生 App
- 心声评论 / 点赞等社交功能
- 多时区切换（应用单时区运行）
- 任务自定义图库（仅 emoji）

---

## 15. 开放问题

无重大开放项。以下可在实现期再细化：

- 月视图格子图标折叠阈值（3 个？4 个？看视觉密度）
- 周 / 月任务进度可视化样式（环形 / 进度条 / 数字徽章）
- 移动端拖拽是否好用，不行就降级为"先点任务再点格子"
