# 日历记账 — Plan 1: 项目基础 + 认证 + 账号种子

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭起 Next.js 15 + Prisma + SQLite 项目骨架，实现简单密码登录 + session cookie 认证机制，以及通过 CLI 创建账号的脚本。完成后：`pnpm seed:user` 可建用户，浏览器能登入登出，登录后看到占位主页。

**Architecture:** Next.js 15 App Router (TypeScript) + Tailwind CSS 4 + Prisma 6 + SQLite。
认证用 bcryptjs 哈希密码 + 随机 32 字节 token 写 DB Session 表 + HttpOnly Cookie。
**关键决策**：用 `app/(app)/layout.tsx` 路由组 layout 调用 `requireAuth()` 拦截未登录访问，**不用 Next.js Middleware**——避开 edge runtime 不能调 Prisma 的坑。

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS 4, Prisma 6 (SQLite), bcryptjs, Vitest, Playwright (for E2E)

---

## ⚠️ 实施前的关键坑点（先看一遍）

1. **Prisma + Next.js dev 模式**：HMR 会重复 new PrismaClient，连接泄露。必须用 `globalThis` 单例（Task 4 会处理）。
2. **bcryptjs vs bcrypt**：选 bcryptjs（纯 JS）。原生 bcrypt 在 Alpine Docker 镜像里编译麻烦，bcryptjs 慢一点但 ~5 用户场景完全无所谓。
3. **Edge Runtime**：Next.js Middleware 默认跑在 edge，不支持 Prisma。我们用路由组 layout 代替，全在 nodejs runtime。
4. **Cookie Secure flag**：本地开发是 `http://localhost`，加了 `Secure` 就发不出去。代码里要 `process.env.NODE_ENV === 'production'` 才设 Secure。
5. **SQLite 文件路径**：Prisma 默认相对 `schema.prisma` 解析。我们用 `DATABASE_URL=file:../data/scheduler.db`（项目根 `/data/` 目录）。
6. **测试数据库隔离**：Vitest 每个测试文件用独立 SQLite 文件，`beforeEach` 重置；不要共用 dev 库。
7. **种子脚本里要直接连 Prisma**，不能走 Next.js 的 lib（那个有单例逻辑），用 `tsx` 直接跑 TypeScript。

---

## 文件结构（Plan 1 完成后的项目布局）

```
scheduler/
├── .env                          # 本地环境变量（gitignored）
├── .env.example                  # 模板（提交）
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── prisma/
│   └── schema.prisma             # User + Session 模型
├── data/                         # gitignored，SQLite 文件 + 测试库
│   └── scheduler.db
├── scripts/
│   ├── seed-user.ts              # CLI: 创建用户
│   └── reset-password.ts         # CLI: 重置密码
├── src/
│   ├── lib/
│   │   ├── db.ts                 # Prisma 单例
│   │   ├── password.ts           # bcrypt 哈希/校验
│   │   ├── session.ts            # 创建/校验/销毁 session
│   │   └── auth.ts               # getCurrentUser / requireAuth
│   ├── app/
│   │   ├── layout.tsx            # 根 layout
│   │   ├── globals.css           # Tailwind
│   │   ├── login/
│   │   │   └── page.tsx          # 登录表单
│   │   ├── (app)/
│   │   │   ├── layout.tsx        # requireAuth 守卫
│   │   │   └── page.tsx          # 占位主页
│   │   └── api/
│   │       ├── login/
│   │       │   └── route.ts      # POST /api/login
│   │       └── logout/
│   │           └── route.ts      # POST /api/logout
└── tests/
    ├── unit/
    │   ├── password.test.ts
    │   └── session.test.ts
    ├── integration/
    │   ├── login-route.test.ts
    │   └── seed-user.test.ts
    ├── helpers/
    │   └── test-db.ts            # 测试 DB 工具
    └── e2e/
        └── auth.spec.ts          # Playwright
```

---

### Task 1: 初始化项目骨架

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.example`, `.env`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1.1: 创建项目目录并 pnpm init**

```bash
cd /Users/gongqipeng/Desktop/scheduler
pnpm init
```

Expected: 生成 `package.json`，`name` 字段后续手动改成 `"scheduler"`。

- [ ] **Step 1.2: 安装运行时依赖**

```bash
pnpm add next@15 react@19 react-dom@19
pnpm add @prisma/client@^6 bcryptjs zod
pnpm add -D typescript @types/node @types/react @types/react-dom @types/bcryptjs
pnpm add -D prisma@^6 tsx
pnpm add -D tailwindcss@^4 postcss @tailwindcss/postcss
```

- [ ] **Step 1.3: 写 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*", "scripts/**/*", "tests/**/*", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 1.4: 写 `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
```

- [ ] **Step 1.5: 配置 Tailwind 4**

写 `postcss.config.mjs`：

```javascript
export default {
  plugins: { "@tailwindcss/postcss": {} },
};
```

写 `src/app/globals.css`：

```css
@import "tailwindcss";
```

（Tailwind 4 不需要 `tailwind.config.ts` 也能跑，配置可后续按需添加。）

- [ ] **Step 1.6: 写根 layout 和占位首页**

`src/app/layout.tsx`：

```tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "日历记账",
  description: "记录每一天",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-neutral-50 text-neutral-900">{children}</body>
    </html>
  );
}
```

`src/app/page.tsx`（临时入口，下一步会被 `(app)/page.tsx` 取代）：

```tsx
export default function HomePage() {
  return <div className="p-8">Loading…</div>;
}
```

- [ ] **Step 1.7: 写 `.gitignore` 和 `.env.example`**

`.gitignore`：

```
node_modules
.next
out
dist
*.log
.env
.env.local
data/
test-data/
playwright-report/
test-results/
.DS_Store
```

`.env.example`：

```
DATABASE_URL="file:../data/scheduler.db"
NODE_ENV=development
SESSION_SECRET_LENGTH=32
TZ=Asia/Shanghai
```

复制一份成 `.env`：

```bash
cp .env.example .env
```

- [ ] **Step 1.8: 给 `package.json` 加脚本**

编辑 `package.json` 的 `"scripts"`：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:studio": "prisma studio",
    "seed:user": "tsx scripts/seed-user.ts",
    "seed:reset-password": "tsx scripts/reset-password.ts"
  }
}
```

- [ ] **Step 1.9: 验证 dev server 能启动**

```bash
mkdir -p data
pnpm dev
```

Expected：终端显示 `Local: http://localhost:3000`，浏览器打开能看到 "Loading…"。`Ctrl+C` 关掉。

- [ ] **Step 1.10: git init + 首次提交**

```bash
git init
git add .
git commit -m "chore: scaffold Next.js + TypeScript + Tailwind project"
```

---

### Task 2: 配置 Prisma 与 User / Session 模型

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/db.ts`

- [ ] **Step 2.1: 初始化 Prisma**

```bash
pnpm prisma init --datasource-provider sqlite
```

会生成 `prisma/schema.prisma`。删除示例 model，只保留 generator + datasource。

- [ ] **Step 2.2: 写 `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model User {
  id           Int       @id @default(autoincrement())
  username     String    @unique
  passwordHash String
  displayName  String
  color        String
  isAdmin      Boolean   @default(false)
  createdAt    DateTime  @default(now())
  sessions     Session[]
}

model Session {
  id        String   @id
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([userId])
}
```

> 注意：业务模型（Task / Occurrence / DailyNote / NoteImage）留到后续 plan 再加。这一步只放认证需要的。

- [ ] **Step 2.3: 跑首个 migration**

```bash
pnpm db:migrate -- --name init
```

> `--` 后面的参数会传给 prisma migrate dev。如果交互式问要不要建 db，按 Enter 默认。

Expected：`prisma/migrations/<timestamp>_init/` 生成；`data/scheduler.db` 创建。

- [ ] **Step 2.4: 写 Prisma 单例 `src/lib/db.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

> **坑点**：必须用 `globalThis` 缓存，否则 dev HMR 每次刷新都新建连接，几次就把 SQLite 锁住。

- [ ] **Step 2.5: 提交**

```bash
git add prisma/ src/lib/db.ts .env.example
git commit -m "feat: add Prisma schema with User/Session models"
```

---

### Task 3: 配置 Vitest

**Files:**
- Create: `vitest.config.ts`
- Create: `tests/helpers/test-db.ts`

- [ ] **Step 3.1: 安装 Vitest**

```bash
pnpm add -D vitest @vitest/ui
```

- [ ] **Step 3.2: 写 `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globals: true,
    setupFiles: [],
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true }, // SQLite 单文件，避免并发写
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3.3: 写 `tests/helpers/test-db.ts` —— 隔离测试 DB**

```typescript
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const TEST_DB_DIR = path.resolve(__dirname, "../../test-data");
const TEST_DB_PATH = path.join(TEST_DB_DIR, "test.db");

let prisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    fs.mkdirSync(TEST_DB_DIR, { recursive: true });
    process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;
    execSync("pnpm prisma migrate deploy", {
      env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
      stdio: "inherit",
    });
    prisma = new PrismaClient({
      datasources: { db: { url: `file:${TEST_DB_PATH}` } },
    });
  }
  return prisma;
}

export async function resetTestDb() {
  const p = getTestPrisma();
  // 按依赖顺序清表
  await p.session.deleteMany();
  await p.user.deleteMany();
}

export async function closeTestDb() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}
```

- [ ] **Step 3.4: 写一个 smoke 测试验证 Vitest 能跑**

`tests/unit/smoke.test.ts`：

```typescript
import { describe, it, expect } from "vitest";

describe("smoke", () => {
  it("should run", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3.5: 跑测试**

```bash
pnpm test
```

Expected：`✓ tests/unit/smoke.test.ts (1 test)` PASS。

- [ ] **Step 3.6: 删 smoke 测试 + 提交**

```bash
rm tests/unit/smoke.test.ts
git add .
git commit -m "test: configure Vitest with isolated SQLite test DB"
```

---

### Task 4: 实现 password.ts（TDD）

**Files:**
- Test: `tests/unit/password.test.ts`
- Create: `src/lib/password.ts`

- [ ] **Step 4.1: 写失败测试**

`tests/unit/password.test.ts`：

```typescript
import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password", () => {
  it("hashPassword 返回非空字符串且不等于明文", async () => {
    const hash = await hashPassword("hunter2");
    expect(hash).toBeTypeOf("string");
    expect(hash.length).toBeGreaterThan(20);
    expect(hash).not.toBe("hunter2");
  });

  it("verifyPassword 对正确密码返回 true", async () => {
    const hash = await hashPassword("hunter2");
    await expect(verifyPassword("hunter2", hash)).resolves.toBe(true);
  });

  it("verifyPassword 对错误密码返回 false", async () => {
    const hash = await hashPassword("hunter2");
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("两次 hash 同一密码结果不同（盐随机）", async () => {
    const a = await hashPassword("hunter2");
    const b = await hashPassword("hunter2");
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 4.2: 跑测试，确认失败**

```bash
pnpm test password
```

Expected：FAIL，`Cannot find module '@/lib/password'`.

- [ ] **Step 4.3: 实现 `src/lib/password.ts`**

```typescript
import bcrypt from "bcryptjs";

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

- [ ] **Step 4.4: 跑测试，确认通过**

```bash
pnpm test password
```

Expected：4 个测试全 PASS。

- [ ] **Step 4.5: 提交**

```bash
git add src/lib/password.ts tests/unit/password.test.ts
git commit -m "feat: add password hashing helpers"
```

---

### Task 5: 实现 session.ts（TDD）

**Files:**
- Test: `tests/unit/session.test.ts`
- Create: `src/lib/session.ts`

- [ ] **Step 5.1: 写失败测试**

`tests/unit/session.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import {
  createSession,
  validateSession,
  destroySession,
  SESSION_DURATION_MS,
} from "@/lib/session";

const prisma = getTestPrisma();

beforeEach(async () => {
  await resetTestDb();
});
afterAll(async () => {
  await closeTestDb();
});

async function makeUser() {
  return prisma.user.create({
    data: {
      username: "alice",
      passwordHash: "x",
      displayName: "Alice",
      color: "#FF8888",
    },
  });
}

describe("session", () => {
  it("createSession 返回 32 字节 hex token 且写入 DB", async () => {
    const user = await makeUser();
    const token = await createSession(user.id, prisma);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const row = await prisma.session.findUnique({ where: { id: token } });
    expect(row?.userId).toBe(user.id);
  });

  it("validateSession 返回 user 当 token 有效", async () => {
    const user = await makeUser();
    const token = await createSession(user.id, prisma);
    const result = await validateSession(token, prisma);
    expect(result?.id).toBe(user.id);
  });

  it("validateSession 返回 null 当 token 无效", async () => {
    const result = await validateSession("nonexistent", prisma);
    expect(result).toBeNull();
  });

  it("validateSession 返回 null 当 token 过期", async () => {
    const user = await makeUser();
    const token = "abc".repeat(22).slice(0, 64);
    await prisma.session.create({
      data: {
        id: token,
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const result = await validateSession(token, prisma);
    expect(result).toBeNull();
  });

  it("validateSession 在过期前会滑动续期", async () => {
    const user = await makeUser();
    const token = await createSession(user.id, prisma);
    // 模拟"几天后"再访问，但还没过期
    const before = await prisma.session.findUnique({ where: { id: token } });
    await new Promise((r) => setTimeout(r, 10));
    await validateSession(token, prisma);
    const after = await prisma.session.findUnique({ where: { id: token } });
    expect(after!.expiresAt.getTime()).toBeGreaterThan(before!.expiresAt.getTime());
  });

  it("destroySession 删除 token", async () => {
    const user = await makeUser();
    const token = await createSession(user.id, prisma);
    await destroySession(token, prisma);
    const row = await prisma.session.findUnique({ where: { id: token } });
    expect(row).toBeNull();
  });

  it("SESSION_DURATION_MS = 30 天", () => {
    expect(SESSION_DURATION_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
```

- [ ] **Step 5.2: 跑测试，确认失败**

```bash
pnpm test session
```

Expected：FAIL，`Cannot find module '@/lib/session'`.

- [ ] **Step 5.3: 实现 `src/lib/session.ts`**

```typescript
import crypto from "node:crypto";
import type { PrismaClient, User } from "@prisma/client";
import { prisma as defaultPrisma } from "./db";

export const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(
  userId: number,
  prisma: PrismaClient = defaultPrisma
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await prisma.session.create({
    data: {
      id: token,
      userId,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    },
  });
  return token;
}

export async function validateSession(
  token: string,
  prisma: PrismaClient = defaultPrisma
): Promise<User | null> {
  const session = await prisma.session.findUnique({
    where: { id: token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
    return null;
  }
  // 滑动续期
  await prisma.session.update({
    where: { id: token },
    data: { expiresAt: new Date(Date.now() + SESSION_DURATION_MS) },
  });
  return session.user;
}

export async function destroySession(
  token: string,
  prisma: PrismaClient = defaultPrisma
): Promise<void> {
  await prisma.session.delete({ where: { id: token } }).catch(() => {});
}
```

- [ ] **Step 5.4: 跑测试，确认通过**

```bash
pnpm test session
```

Expected：7 个测试全 PASS。

- [ ] **Step 5.5: 提交**

```bash
git add src/lib/session.ts tests/unit/session.test.ts
git commit -m "feat: add session create/validate/destroy with sliding expiry"
```

---

### Task 6: 实现 auth.ts（getCurrentUser / requireAuth）

**Files:**
- Create: `src/lib/auth.ts`

> 这一步不写单元测试（依赖 Next.js cookies()，单元测试过于啰嗦），靠 E2E 测试覆盖。但代码必须够薄，逻辑都在 session.ts 里测过了。

- [ ] **Step 6.1: 实现 `src/lib/auth.ts`**

```typescript
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { validateSession } from "./session";

export const SESSION_COOKIE = "scheduler_session";

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return validateSession(token);
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
```

- [ ] **Step 6.2: 提交**

```bash
git add src/lib/auth.ts
git commit -m "feat: add getCurrentUser/requireAuth helpers"
```

---

### Task 7: 路由组 layout 与占位主页

**Files:**
- Move: `src/app/page.tsx` → `src/app/(app)/page.tsx`
- Create: `src/app/(app)/layout.tsx`

- [ ] **Step 7.1: 删除旧 `src/app/page.tsx`**

```bash
rm src/app/page.tsx
```

- [ ] **Step 7.2: 创建路由组目录与 layout**

```bash
mkdir -p "src/app/(app)"
```

`src/app/(app)/layout.tsx`：

```tsx
import { requireAuth } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white px-6 py-3 flex justify-between items-center">
        <span className="font-semibold">日历记账</span>
        <div className="flex items-center gap-3 text-sm">
          <span>
            欢迎，<span style={{ color: user.color }}>{user.displayName}</span>
          </span>
          <form action="/api/logout" method="POST">
            <button type="submit" className="text-neutral-600 hover:underline">
              登出
            </button>
          </form>
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
```

`src/app/(app)/page.tsx`：

```tsx
export default function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">主页（占位）</h1>
      <p className="mt-4 text-neutral-600">
        登录成功。下一份 plan 会把这里换成月视图。
      </p>
    </div>
  );
}
```

- [ ] **Step 7.3: 提交**

```bash
git add src/app/
git commit -m "feat: add (app) route group with auth-guarded layout"
```

---

### Task 8: 登录页 UI

**Files:**
- Create: `src/app/login/page.tsx`

- [ ] **Step 8.1: 写登录页**

```tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // 已登录 → 跳主页
  if (await getCurrentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <form
        action="/api/login"
        method="POST"
        className="w-80 bg-white rounded-lg shadow p-6 space-y-4"
      >
        <h1 className="text-xl font-bold">登录</h1>
        {error && (
          <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
            {error === "invalid" ? "用户名或密码错误" : "登录失败，请重试"}
          </p>
        )}
        <div>
          <label className="block text-sm mb-1">用户名</label>
          <input
            name="username"
            required
            autoComplete="username"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm mb-1">密码</label>
          <input
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 text-white rounded py-2 font-medium hover:bg-blue-700"
        >
          登录
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 8.2: 提交**

```bash
git add src/app/login/
git commit -m "feat: add login page UI"
```

---

### Task 9: 登录 API（TDD 集成测试）

**Files:**
- Test: `tests/integration/login-route.test.ts`
- Create: `src/app/api/login/route.ts`

- [ ] **Step 9.1: 写失败测试**

> 直接对 route 函数做集成测试（用 Web Request/Response 标准对象），不起 server。

`tests/integration/login-route.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import { hashPassword } from "@/lib/password";

const prisma = getTestPrisma();

beforeEach(async () => {
  await resetTestDb();
});
afterAll(async () => {
  await closeTestDb();
});

async function makeUser(username = "alice", password = "hunter2") {
  return prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      displayName: username,
      color: "#FF8888",
    },
  });
}

async function callLogin(body: Record<string, string>) {
  // 动态 import 让 process.env.DATABASE_URL 已经被 test-db 设好
  const { POST } = await import("@/app/api/login/route");
  const form = new URLSearchParams(body);
  const req = new Request("http://localhost/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });
  return POST(req);
}

describe("POST /api/login", () => {
  it("正确凭据 → 302 到 /，并设置 cookie", async () => {
    await makeUser();
    const res = await callLogin({ username: "alice", password: "hunter2" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
    const setCookie = res.headers.get("Set-Cookie");
    expect(setCookie).toMatch(/scheduler_session=/);
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it("错误密码 → 302 到 /login?error=invalid", async () => {
    await makeUser();
    const res = await callLogin({ username: "alice", password: "wrong" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?error=invalid");
  });

  it("用户不存在 → 302 到 /login?error=invalid", async () => {
    const res = await callLogin({ username: "bob", password: "x" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?error=invalid");
  });

  it("缺少字段 → 302 到 /login?error=invalid", async () => {
    const res = await callLogin({ username: "alice" });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/login?error=invalid");
  });
});
```

- [ ] **Step 9.2: 跑测试确认失败**

```bash
pnpm test login-route
```

Expected：FAIL（route 不存在）。

- [ ] **Step 9.3: 实现 `src/app/api/login/route.ts`**

> **坑点**：不能用 `NextResponse.redirect(new URL(...))`，它会输出 absolute URL（如 `http://placeholder/`），测试断言相对路径会失败。直接用原生 `Response` + Location header 更稳。

```typescript
import { z } from "zod";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { createSession, SESSION_DURATION_MS } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/auth";

const Body = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(200),
});

function redirectTo(path: string, headers: Headers = new Headers()) {
  headers.set("Location", path);
  return new Response(null, { status: 302, headers });
}

function loginFailed() {
  return redirectTo("/login?error=invalid");
}

export async function POST(req: Request) {
  let parsed;
  try {
    const form = await req.formData();
    parsed = Body.safeParse({
      username: form.get("username"),
      password: form.get("password"),
    });
  } catch {
    return loginFailed();
  }
  if (!parsed.success) return loginFailed();

  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return loginFailed();

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return loginFailed();

  const token = await createSession(user.id);
  const headers = new Headers();
  const cookieParts = [
    `${SESSION_COOKIE}=${token}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${SESSION_DURATION_MS / 1000}`,
    "SameSite=Lax",
  ];
  if (process.env.NODE_ENV === "production") cookieParts.push("Secure");
  headers.append("Set-Cookie", cookieParts.join("; "));
  return redirectTo("/", headers);
}
```

- [ ] **Step 9.4: 跑测试确认通过**

```bash
pnpm test login-route
```

Expected：4 个测试全 PASS。

- [ ] **Step 9.5: 提交**

```bash
git add src/app/api/login/ tests/integration/login-route.test.ts
git commit -m "feat: implement POST /api/login with cookie session"
```

---

### Task 10: 登出 API

**Files:**
- Create: `src/app/api/logout/route.ts`

> 登出逻辑足够薄，靠 E2E 测试覆盖即可。

- [ ] **Step 10.1: 实现**

`src/app/api/logout/route.ts`：

```typescript
import { cookies } from "next/headers";
import { destroySession } from "@/lib/session";
import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await destroySession(token);
  }
  const headers = new Headers();
  headers.set("Location", "/login");
  // 删除 cookie：Max-Age=0
  headers.append(
    "Set-Cookie",
    `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
  return new Response(null, { status: 302, headers });
}
```

- [ ] **Step 10.2: 提交**

```bash
git add src/app/api/logout/
git commit -m "feat: implement POST /api/logout"
```

---

### Task 11: seed-user CLI（TDD）

**Files:**
- Test: `tests/integration/seed-user.test.ts`
- Create: `scripts/seed-user.ts`

- [ ] **Step 11.1: 写失败测试**

`tests/integration/seed-user.test.ts`：

```typescript
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import { createUser, parseArgs } from "../../scripts/seed-user";
import { verifyPassword } from "@/lib/password";

const prisma = getTestPrisma();

beforeEach(async () => {
  await resetTestDb();
});
afterAll(async () => {
  await closeTestDb();
});

describe("seed-user createUser", () => {
  it("创建新用户：哈希密码、写入字段", async () => {
    await createUser(
      { username: "alice", display: "Alice", password: "hunter2", color: "#FF8888", admin: false },
      prisma
    );
    const u = await prisma.user.findUnique({ where: { username: "alice" } });
    expect(u).toBeTruthy();
    expect(u!.displayName).toBe("Alice");
    expect(u!.color).toBe("#FF8888");
    expect(u!.isAdmin).toBe(false);
    expect(await verifyPassword("hunter2", u!.passwordHash)).toBe(true);
  });

  it("用户已存在 → 更新密码 + 字段（upsert）", async () => {
    await createUser(
      { username: "alice", display: "Alice", password: "old", color: "#FF8888", admin: false },
      prisma
    );
    await createUser(
      { username: "alice", display: "Alice 2", password: "new", color: "#00FF00", admin: true },
      prisma
    );
    const u = await prisma.user.findUnique({ where: { username: "alice" } });
    expect(u!.displayName).toBe("Alice 2");
    expect(u!.color).toBe("#00FF00");
    expect(u!.isAdmin).toBe(true);
    expect(await verifyPassword("new", u!.passwordHash)).toBe(true);
  });
});

describe("parseArgs", () => {
  it("解析全部参数", () => {
    const result = parseArgs([
      "--username", "alice",
      "--display", "Alice",
      "--password", "hunter2",
      "--color", "#FF8888",
      "--admin",
    ]);
    expect(result).toEqual({
      username: "alice",
      display: "Alice",
      password: "hunter2",
      color: "#FF8888",
      admin: true,
    });
  });

  it("admin 默认 false", () => {
    const result = parseArgs([
      "--username", "alice",
      "--display", "Alice",
      "--password", "hunter2",
      "--color", "#FF8888",
    ]);
    expect(result.admin).toBe(false);
  });

  it("缺必填 → 抛错", () => {
    expect(() => parseArgs(["--username", "alice"])).toThrow();
  });
});
```

- [ ] **Step 11.2: 跑测试确认失败**

```bash
pnpm test seed-user
```

Expected：FAIL（脚本不存在）。

- [ ] **Step 11.3: 实现 `scripts/seed-user.ts`**

```typescript
import type { PrismaClient } from "@prisma/client";
import { PrismaClient as DefaultPrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

export interface SeedArgs {
  username: string;
  display: string;
  password: string;
  color: string;
  admin: boolean;
}

export function parseArgs(argv: string[]): SeedArgs {
  const flags: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i++;
    }
  }
  const required = ["username", "display", "password", "color"];
  for (const k of required) {
    if (typeof flags[k] !== "string") {
      throw new Error(`Missing --${k}`);
    }
  }
  return {
    username: flags.username as string,
    display: flags.display as string,
    password: flags.password as string,
    color: flags.color as string,
    admin: flags.admin === true,
  };
}

export async function createUser(args: SeedArgs, prisma: PrismaClient) {
  const passwordHash = await hashPassword(args.password);
  await prisma.user.upsert({
    where: { username: args.username },
    update: {
      displayName: args.display,
      color: args.color,
      isAdmin: args.admin,
      passwordHash,
    },
    create: {
      username: args.username,
      displayName: args.display,
      color: args.color,
      isAdmin: args.admin,
      passwordHash,
    },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const prisma = new DefaultPrismaClient();
  try {
    await createUser(args, prisma);
    console.log(`✓ User "${args.username}" created/updated.`);
  } finally {
    await prisma.$disconnect();
  }
}

// 直接运行时执行 main
if (process.argv[1]?.endsWith("seed-user.ts") || process.argv[1]?.endsWith("seed-user.js")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
```

- [ ] **Step 11.4: 跑测试确认通过**

```bash
pnpm test seed-user
```

Expected：5 个测试全 PASS。

- [ ] **Step 11.5: 手动验证 CLI 真能跑**

```bash
pnpm seed:user --username alice --display "Alice" --password "hunter2" --color "#FF8888"
```

Expected：终端输出 `✓ User "alice" created/updated.`。再用 `pnpm db:studio` 打开看到 alice 行。

- [ ] **Step 11.6: 提交**

```bash
git add scripts/seed-user.ts tests/integration/seed-user.test.ts
git commit -m "feat: add seed-user CLI for account provisioning"
```

---

### Task 12: reset-password CLI

**Files:**
- Create: `scripts/reset-password.ts`

> 实现非常薄，复用 seed-user 的 hashPassword + Prisma update。手动验证即可。

- [ ] **Step 12.1: 实现**

```typescript
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

function parseArgs(argv: string[]) {
  const flags: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith("--")) throw new Error(`Bad arg: ${argv[i]}`);
    flags[argv[i].slice(2)] = argv[i + 1];
  }
  if (!flags.username || !flags.password) {
    throw new Error("Usage: --username <name> --password <new>");
  }
  return flags as { username: string; password: string };
}

async function main() {
  const { username, password } = parseArgs(process.argv.slice(2));
  const prisma = new PrismaClient();
  try {
    const passwordHash = await hashPassword(password);
    const result = await prisma.user.updateMany({
      where: { username },
      data: { passwordHash },
    });
    if (result.count === 0) {
      throw new Error(`User "${username}" not found`);
    }
    // 同时清掉所有 session 强制重登
    await prisma.session.deleteMany({ where: { user: { username } } });
    console.log(`✓ Password reset for "${username}". All sessions cleared.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 12.2: 手动验证**

```bash
pnpm seed:reset-password --username alice --password "newpass"
```

Expected：`✓ Password reset for "alice". All sessions cleared.`

- [ ] **Step 12.3: 提交**

```bash
git add scripts/reset-password.ts
git commit -m "feat: add reset-password CLI"
```

---

### Task 13: 配置 Playwright

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/auth.spec.ts`

- [ ] **Step 13.1: 安装 Playwright**

```bash
pnpm add -D @playwright/test
pnpm playwright install chromium
```

- [ ] **Step 13.2: 写 `playwright.config.ts`**

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
```

- [ ] **Step 13.3: 写 E2E：登录/登出/受保护路由**

`tests/e2e/auth.spec.ts`：

```typescript
import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";

const TEST_USERNAME = "e2e_alice";
const TEST_PASSWORD = "test_password_123";

test.beforeAll(() => {
  // 在 dev 库里建一个测试用户（不用 test-data 因为 dev server 跑 dev 库）
  execSync(
    `pnpm seed:user --username ${TEST_USERNAME} --display "E2E Alice" --password "${TEST_PASSWORD}" --color "#AABBCC"`,
    { stdio: "inherit" }
  );
});

test("未登录访问 / 重定向到 /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator("h1")).toContainText("登录");
});

test("错误密码 → 显示错误信息", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="username"]', TEST_USERNAME);
  await page.fill('input[name="password"]', "wrong");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/login\?error=invalid/);
  await expect(page.locator("text=用户名或密码错误")).toBeVisible();
});

test("正确凭据 → 进主页 → 登出 → 回 /login", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="username"]', TEST_USERNAME);
  await page.fill('input[name="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.locator("h1")).toContainText("主页");
  await expect(page.locator("text=E2E Alice")).toBeVisible();

  // 登出
  await page.click('button:has-text("登出")');
  await expect(page).toHaveURL(/\/login$/);

  // 登出后再访问 / 仍跳 /login
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});
```

- [ ] **Step 13.4: 跑 E2E**

```bash
pnpm test:e2e
```

Expected：3 个 test PASS。

> **坑点**：跑 E2E 时 dev 库里会留一个 e2e_alice。可以接受（不污染生产，dev 本地独立）。

- [ ] **Step 13.5: 提交**

```bash
git add playwright.config.ts tests/e2e/
git commit -m "test: add Playwright E2E for auth flow"
```

---

### Task 14: 全量回归 + Plan 1 收官

- [ ] **Step 14.1: 跑所有单测 + 集成测试**

```bash
pnpm test
```

Expected：全部 PASS（password 4 个 + session 7 个 + login-route 4 个 + seed-user 5 个 = 20 个测试）。

- [ ] **Step 14.2: 跑 E2E**

```bash
pnpm test:e2e
```

Expected：全部 PASS。

- [ ] **Step 14.3: 跑生产 build 确保编译通过**

```bash
pnpm build
```

Expected：`✓ Compiled successfully` + 各路由列表。如果有 TS 错误，修到通过。

- [ ] **Step 14.4: 手动 smoke**

```bash
pnpm dev
```

打开 http://localhost:3000：

- [ ] 自动跳 /login
- [ ] 错误密码看到红色错误
- [ ] 正确密码登入，看到"欢迎，Alice"
- [ ] 点登出，回 /login

- [ ] **Step 14.5: 写最小 README（仅本 plan 范围）**

`README.md`：

````markdown
# 日历记账

## 开发

```bash
pnpm install
pnpm db:migrate              # 首次：初始化 SQLite
pnpm seed:user --username alice --display "Alice" --password "..." --color "#FF8888" --admin
pnpm dev                     # http://localhost:3000
```

## 测试

```bash
pnpm test                    # 单元 + 集成
pnpm test:e2e                # E2E（会启动 dev server）
```

## CLI

```bash
pnpm seed:user --username <u> --display <d> --password <p> --color <hex> [--admin]
pnpm seed:reset-password --username <u> --password <new>
```

> 详见 `specifications.md` 与 `docs/superpowers/plans/`。
````

- [ ] **Step 14.6: 最终提交**

```bash
git add README.md
git commit -m "docs: add README with dev / test / CLI usage"
```

---

## Plan 1 验收清单

执行人完成所有任务后，对着这个清单一项项核对：

- [ ] `pnpm test` 全绿（20 测试）
- [ ] `pnpm test:e2e` 全绿（3 测试）
- [ ] `pnpm build` 编译无报错
- [ ] 手动登录流程跑通：未登录跳转 / 错误密码提示 / 成功登入 / 登出
- [ ] `pnpm seed:user` 真能建用户（用 `pnpm db:studio` 看）
- [ ] `pnpm seed:reset-password` 真能改密码（旧密码应失效）
- [ ] cookie 名为 `scheduler_session`，HttpOnly，开发环境无 Secure
- [ ] git log 至少有 12 个 commit（每个 Task 至少一个）

通过后才能进入 Plan 2（任务 CRUD）。
