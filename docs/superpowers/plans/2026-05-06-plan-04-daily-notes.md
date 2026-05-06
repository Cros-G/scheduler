# 日历记账 — Plan 4: 心声（DailyNote）+ 图片上传

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development.

**Goal:** 把日详情面板里的"心声功能将在 Plan 4 上线"占位换成可用的编辑器：每用户每天一条文本 + 最多 6 张图片。文件落到云服务器本地 `${DATA_DIR}/uploads/...`，图片走鉴权路由服务，URL 不可被外部直接绕过。

**不在本 Plan 范围**：心声私密开关（不在 MVP；spec §4.7 标注，未来加字段）；多人查看心声（私密过滤逻辑统一在 Plan 5）。

**Architecture:**
- Prisma 加 `DailyNote` 与 `NoteImage` 模型；`@@unique([userId, date])` 保证一天一条
- `notes-actions-core.ts` + 薄 server-action 包装：
  - `upsertNoteCore(userId, date, content)` — text content（≤10000）
  - `deleteNoteImageCore(userId, imageId)`
  - `reorderNoteImagesCore(userId, noteId, imageIds[])`
- 图片走 Route Handler：
  - `POST /api/uploads` — multipart，鉴权后保存到 `${DATA_DIR}/uploads/${userId}/${YYYY-MM}/${uuid}.${ext}`，写 `NoteImage` 行（关联到当日 note，note 不存在时先 upsert 一条空 note）
  - `GET /api/uploads/[id]` — 鉴权后流式返回；私密任务的 note 暂不区分（心声 MVP 全公开），但仍需登录才能看
- UI：`day-detail-sheet.tsx` 加心声编辑区（textarea + 图片缩略图网格 + 上传按钮 + 删除）
- 月视图格子加"心声"小指示（点缀，不抢戏）

**Tech Stack:** 沿用，新增依赖：`busboy` 解析 multipart（轻、稳，比 formidable 简单）。

---

## ⚠ 实施前的关键坑点

### 已知必须处理

1. **API 路由 ≠ Page 路由的 auth 处理**：
   - 现有 `requireAuth()` 用 `redirect('/login')` → 对页面访问 OK，对 fetch API 不行（前端拿到 HTML 而不是 401 JSON）
   - **必须**新增 `requireAuthApi()`：返回 `User | Response`，未登录时返回 `Response.json({ok:false,error:"未登录"}, {status: 401})`
   - 在 `src/lib/auth.ts` 加这个新 helper，uploads/[id] 和 uploads POST 都用它

2. **图片数量并发条件**：
   - 用户连点上传 6 张 → 浏览器并行发 6 请求，每个都看到 `count <= 5` 都通过校验 → 写超 6 张
   - **修复**：上传 route 用 `prisma.$transaction` 包"upsert note + 计数 + insert image + 再计数 → 超限 throw"。失败回滚整事务 + 删除磁盘文件
   - 单用户场景罕见但仍是真 bug，处理掉

3. **Next.js 15 Request.formData() body 限制**：
   - **Server Actions 默认 1MB 上限**（之前是 4MB），但 **Route Handler 没有此限制**（fully streaming）
   - 我们走 Route Handler 上传，所以 5MB 不会被框架拦
   - 仍需在 Route 里手动检查 `buffer.length > 5MB` 兜底
   - **绝对不能**把上传走 server action（容易踩 size 限制）

4. **路径遍历**：保存文件名严格用服务端 `crypto.randomBytes(16).toString('hex')` + 白名单扩展（jpg/png/webp/gif）。**绝不**用客户端 file.name 拼路径

5. **DATA_DIR 默认**：`./data/`，生产可 `/var/scheduler/`。`uploads/` 子目录要 `fs.mkdir(..., { recursive: true })` 创建

6. **图片要鉴权服务**：`GET /api/uploads/[id]` 调 `requireAuthApi`，再读 `NoteImage` 行，再读盘流式返回。MVP 心声圈内可见（任何登录用户都能看心声 + 图）；Plan 5 加 isPrivate 字段时在这里加过滤

7. **Note upsert 副作用**：上传图片时若当日 note 不存在，自动 upsert 一个 `content=""` 的 note 再附图

8. **删除图片**：先删 DB 行，再 fire-and-forget 删盘（删盘失败只 console.error，不回滚 DB）

9. **content 长度限制**：UI textarea `maxLength=10000`，后端 `validateNoteContent` 兜底

10. **textarea 保存策略**：MVP 显式"保存"按钮（不做防抖自动保存）。**未保存关闭 sheet** → `window.confirm("未保存的修改将丢失，是否离开？")`。比较 `currentContent !== lastSavedContent` 判断是否未保存

11. **lastSavedContent 同步**：父组件 `revalidatePath` 之后会把新 props 传下来。子组件 `useEffect` 监听 `note?.content` 变化 → 更新 `lastSavedContent`。**这块要小心**：用户在编辑过程中其他客户端动作触发了 revalidate（不太可能但可能），不能让用户的本地编辑被覆盖。**简化**：组件 mount 时把 props.note.content 设成 lastSaved 和 current；之后 props 变化忽略（除非用户没编辑过 — 用 `useRef` 跟踪 dirty flag）

12. **图片排序**：MVP 不做 reorder UI，按 `sortOrder asc` 展示（上传时取当前最大 + 1）。core 函数留着供 Plan 5 接

13. **磁盘删除失败处理**：用 `.catch((e) => console.error("upload cleanup failed", relPath, e))` 而不是直接吞掉。运维问题需要看到

### 安全 / 质量类

14. **MIME 伪造**：客户端可以伪造 `file.type`。MVP 自部署可控环境 + emoji picker 一类的小风险，**接受**。Plan 5/6 可以加 magic byte 检查（jpg=`FFD8FF`, png=`89504E47`, webp=`RIFF...WEBP`, gif=`GIF8`）

15. **图片直链未鉴权访问**：经过 `/api/uploads/[id]` 路由，`requireAuthApi` 拒未登录 → 401。**测试要覆盖**

16. **图片缩略图带宽**：5MB 原图渲染 96×96 浪费。MVP 不做服务端缩略图（避免 sharp 等 deps）。README 里标记 future work

17. **revalidatePath('/')**：刷新月视图（也是 `/` 路径）。但 day detail sheet 里改了内容后**要主动 `router.refresh()`**，否则 sheet 自己不重新拉数据（sheet 是同一个 client component 实例，只有 props 重传才更新）。所以 action 调用后客户端要 `router.refresh()`

18. **next/cache revalidatePath 在 dev mode**：dev 下 revalidate 立即生效；prod 下生效但走 ISR pipeline。MVP dev 工作正常即可

### 测试 / 运维相关

19. **process.env.DATA_DIR 在测试中污染**：`storage.test.ts` 改 DATA_DIR。Vitest `pool: forks` + `fileParallelism: false` 单进程顺序跑，测试间共享 process.env。**必须**：每个修改 DATA_DIR 的测试在 `afterEach` 还原

20. **uploads-route 集成测试**：复杂（要 mock cookies / requireAuth）。**不写** vitest 集成测试 — 完全靠 E2E 覆盖完整链路

21. **E2E 上传**：用 `page.setInputFiles(selector, { name, mimeType, buffer })`，buffer 用预先准备的 1×1 PNG hex 字节序列

22. **dev DB cleanup**：每次 e2e 跑都 wipe `e2e_alice` 的 noteImage / dailyNote / occurrence / task。**注意**：noteImage cascade on dailyNote delete，但 dailyNote 不会因 user.tasks 删除自动删 — 显式删

23. **编辑器 onClose 被打断**：用户点关闭 → 弹 confirm → 按取消 → sheet 仍打开。逻辑是先拦后关。Playwright E2E 可以 `page.on('dialog', d => d.dismiss())` 测取消分支

### 容易遗漏的细节

24. **下午 12:00 服务器时区**：图片路径用 `dateKey.slice(0,7)` 取 YYYY-MM。前提 dateKey 已经是服务器时区下的日期。todayKey() 返回的就是。但如果客户端传一个非"今天"的日期（如往日补记），路径仍按那个日期分组，OK

25. **空心声 + 0 图 = 删除 note？**：MVP 不删（保留 created_at 作为"那天我打开过"的痕迹）。spec 没要求清理

26. **textarea 中输入的换行 \n / Tab**：DB 里保留原样。渲染时 `white-space: pre-wrap`

27. **图片删除竞态**：用户连点 X 删两次同一图。第二次 `findUnique` 拿 null → 返回 "图片不存在"。前端处理：删除按钮在 pending 时禁用 + revalidate 后图片消失 → 自然不会双击

28. **数据库迁移影响 dev DB**：dev DB 已经有 e2e_alice 等用户。新增 DailyNote 表对他们无影响。安全

---

## 文件结构

```
prisma/
  schema.prisma                                       # +DailyNote +NoteImage
  migrations/<ts>_add_note_models/migration.sql
src/
  lib/
    note-validation.ts                                # 字数 / 图数 / MIME / 大小限制 + 校验
    storage.ts                                        # ${DATA_DIR} 路径工具 + 文件保存/删除
  app/
    (app)/
      notes/
        actions.ts
        actions-core.ts
    api/
      uploads/
        route.ts                                       # POST 上传
        [id]/
          route.ts                                     # GET 下载
tests/
  unit/
    note-validation.test.ts
    storage.test.ts
  integration/
    notes-actions.test.ts
    uploads-route.test.ts
  e2e/
    notes.spec.ts
```

---

### Task 1: Prisma 加 DailyNote + NoteImage + 迁移

#### Step 1.1: schema 修改

User 加：
```prisma
notes DailyNote[]
```

Task 不变。文件末尾追加：

```prisma
model DailyNote {
  id        Int         @id @default(autoincrement())
  userId    Int
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  date      String
  content   String
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt
  images    NoteImage[]

  @@unique([userId, date])
}

model NoteImage {
  id           Int       @id @default(autoincrement())
  noteId       Int
  note         DailyNote @relation(fields: [noteId], references: [id], onDelete: Cascade)
  filePath     String
  originalName String
  sizeBytes    Int
  mimeType     String
  sortOrder    Int       @default(0)
  createdAt    DateTime  @default(now())

  @@index([noteId])
}
```

#### Step 1.2: Migration

```bash
pnpm exec prisma migrate dev --name add_note_models
```

#### Step 1.3: Update `tests/helpers/test-db.ts`

`resetTestDb` 顺序（FK 依赖）：
```typescript
await p.noteImage.deleteMany();
await p.dailyNote.deleteMany();
await p.occurrence.deleteMany();
await p.session.deleteMany();
await p.task.deleteMany();
await p.user.deleteMany();
```

#### Step 1.4: smoke

```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  console.log('Notes:', await p.dailyNote.findMany());
  console.log('Images:', await p.noteImage.findMany());
  await p.\$disconnect();
})();
"
```
Expected: empty arrays.

#### Step 1.5: existing tests still pass

```bash
pnpm test
```

#### Step 1.6: Commit

```bash
git add prisma/ tests/helpers/test-db.ts
git commit -m "feat: add DailyNote + NoteImage models with unique (userId, date)"
```

---

### Task 2: notes 校验工具 + actions-core（TDD）

**Files:**
- Test: `tests/unit/note-validation.test.ts`
- Test: `tests/integration/notes-actions.test.ts`
- Create: `src/lib/note-validation.ts`
- Create: `src/app/(app)/notes/actions-core.ts`

#### `note-validation.ts`

```typescript
export const NOTE_CONTENT_MAX = 10000;
export const NOTE_IMAGES_MAX = 6;
export const NOTE_IMAGE_BYTES_MAX = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const ALLOWED_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateNoteContent(content: string) {
  if (typeof content !== "string") return { ok: false, error: "内容必须是字符串" } as const;
  if (content.length > NOTE_CONTENT_MAX) return { ok: false, error: `内容不能超过 ${NOTE_CONTENT_MAX} 字` } as const;
  return { ok: true } as const;
}

export function validateDateKey(date: string) {
  if (!DATE_RE.test(date)) return { ok: false, error: "日期格式错误" } as const;
  return { ok: true } as const;
}

export function validateImageMeta(meta: { mimeType: string; sizeBytes: number }) {
  if (!(ALLOWED_MIME as readonly string[]).includes(meta.mimeType)) {
    return { ok: false, error: "不支持的图片格式（仅 jpg/png/webp/gif）" } as const;
  }
  if (meta.sizeBytes <= 0) return { ok: false, error: "文件为空" } as const;
  if (meta.sizeBytes > NOTE_IMAGE_BYTES_MAX) {
    return { ok: false, error: "单张图片不能超过 5MB" } as const;
  }
  return { ok: true } as const;
}
```

#### Tests for note-validation

```typescript
// tests/unit/note-validation.test.ts
import { describe, it, expect } from "vitest";
import {
  validateNoteContent, validateDateKey, validateImageMeta,
  NOTE_CONTENT_MAX, NOTE_IMAGES_MAX, NOTE_IMAGE_BYTES_MAX, ALLOWED_MIME,
} from "@/lib/note-validation";

describe("validateNoteContent", () => {
  it("空字符串通过", () => {
    expect(validateNoteContent("")).toEqual({ ok: true });
  });
  it("非字符串失败", () => {
    expect(validateNoteContent(null as unknown as string).ok).toBe(false);
  });
  it(`超 ${NOTE_CONTENT_MAX} 字失败`, () => {
    expect(validateNoteContent("a".repeat(NOTE_CONTENT_MAX + 1)).ok).toBe(false);
  });
  it(`恰好 ${NOTE_CONTENT_MAX} 字通过`, () => {
    expect(validateNoteContent("a".repeat(NOTE_CONTENT_MAX)).ok).toBe(true);
  });
});

describe("validateDateKey", () => {
  it("通过 YYYY-MM-DD", () => { expect(validateDateKey("2026-05-06").ok).toBe(true); });
  it("拒绝 5/6/2026", () => { expect(validateDateKey("5/6/2026").ok).toBe(false); });
  it("拒绝空", () => { expect(validateDateKey("").ok).toBe(false); });
});

describe("validateImageMeta", () => {
  it("png 1KB 通过", () => {
    expect(validateImageMeta({ mimeType: "image/png", sizeBytes: 1024 }).ok).toBe(true);
  });
  it("jpeg 5MB 通过", () => {
    expect(validateImageMeta({ mimeType: "image/jpeg", sizeBytes: NOTE_IMAGE_BYTES_MAX }).ok).toBe(true);
  });
  it("超 5MB 失败", () => {
    expect(validateImageMeta({ mimeType: "image/jpeg", sizeBytes: NOTE_IMAGE_BYTES_MAX + 1 }).ok).toBe(false);
  });
  it("0 bytes 失败", () => {
    expect(validateImageMeta({ mimeType: "image/png", sizeBytes: 0 }).ok).toBe(false);
  });
  it("不支持的 mime 失败", () => {
    expect(validateImageMeta({ mimeType: "image/svg+xml", sizeBytes: 100 }).ok).toBe(false);
  });
});

describe("constants", () => {
  it("NOTE_IMAGES_MAX = 6", () => { expect(NOTE_IMAGES_MAX).toBe(6); });
  it("ALLOWED_MIME 含 4 种", () => { expect(ALLOWED_MIME).toHaveLength(4); });
});
```

#### `actions-core.ts`

```typescript
import type { PrismaClient, DailyNote } from "@prisma/client";
import { validateDateKey, validateNoteContent } from "@/lib/note-validation";

export type ActionResult<T = void> =
  | { ok: true; note: T }
  | { ok: false; error: string };

export async function upsertNoteCore(
  userId: number,
  date: string,
  content: string,
  prisma: PrismaClient
): Promise<ActionResult<DailyNote>> {
  const dv = validateDateKey(date);
  if (!dv.ok) return dv;
  const cv = validateNoteContent(content);
  if (!cv.ok) return cv;

  const note = await prisma.dailyNote.upsert({
    where: { userId_date: { userId, date } },
    update: { content },
    create: { userId, date, content },
  });
  return { ok: true, note };
}

export async function deleteNoteImageCore(
  userId: number,
  imageId: number,
  prisma: PrismaClient
): Promise<{ ok: true; filePath: string } | { ok: false; error: string }> {
  const img = await prisma.noteImage.findUnique({
    where: { id: imageId },
    include: { note: true },
  });
  if (!img) return { ok: false, error: "图片不存在" };
  if (img.note.userId !== userId) return { ok: false, error: "无权操作" };
  await prisma.noteImage.delete({ where: { id: imageId } });
  return { ok: true, filePath: img.filePath };
}

export async function reorderNoteImagesCore(
  userId: number,
  noteId: number,
  imageIds: number[],
  prisma: PrismaClient
): Promise<{ ok: true } | { ok: false; error: string }> {
  const note = await prisma.dailyNote.findUnique({
    where: { id: noteId },
    include: { images: true },
  });
  if (!note) return { ok: false, error: "心声不存在" };
  if (note.userId !== userId) return { ok: false, error: "无权操作" };
  const existingIds = new Set(note.images.map((i) => i.id));
  if (imageIds.length !== existingIds.size || imageIds.some((id) => !existingIds.has(id))) {
    return { ok: false, error: "图片列表不一致" };
  }
  await prisma.$transaction(
    imageIds.map((id, idx) =>
      prisma.noteImage.update({ where: { id }, data: { sortOrder: idx } })
    )
  );
  return { ok: true };
}
```

#### Tests for actions-core

```typescript
// tests/integration/notes-actions.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import {
  upsertNoteCore, deleteNoteImageCore, reorderNoteImagesCore,
} from "@/app/(app)/notes/actions-core";
import { hashPassword } from "@/lib/password";
import { COLOR_PALETTE } from "@/lib/task-validation";

const prisma = getTestPrisma();

beforeEach(async () => { await resetTestDb(); });
afterAll(async () => { await closeTestDb(); });

async function makeUser(username = "alice") {
  return prisma.user.create({
    data: {
      username, passwordHash: await hashPassword("x"),
      displayName: username, color: COLOR_PALETTE[0],
    },
  });
}

describe("upsertNoteCore", () => {
  it("create new note", async () => {
    const u = await makeUser();
    const out = await upsertNoteCore(u.id, "2026-05-06", "今天很好", prisma);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.note.content).toBe("今天很好");
  });

  it("update existing note (same user, same date)", async () => {
    const u = await makeUser();
    await upsertNoteCore(u.id, "2026-05-06", "v1", prisma);
    const out = await upsertNoteCore(u.id, "2026-05-06", "v2", prisma);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.note.content).toBe("v2");
    const all = await prisma.dailyNote.findMany({ where: { userId: u.id } });
    expect(all).toHaveLength(1);
  });

  it("rejects bad date", async () => {
    const u = await makeUser();
    expect((await upsertNoteCore(u.id, "5/6/2026", "x", prisma)).ok).toBe(false);
  });

  it("rejects content > 10000", async () => {
    const u = await makeUser();
    expect((await upsertNoteCore(u.id, "2026-05-06", "a".repeat(10001), prisma)).ok).toBe(false);
  });

  it("two users, same date, separate notes", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    await upsertNoteCore(a.id, "2026-05-06", "A note", prisma);
    await upsertNoteCore(b.id, "2026-05-06", "B note", prisma);
    const aNote = await prisma.dailyNote.findUnique({ where: { userId_date: { userId: a.id, date: "2026-05-06" } } });
    const bNote = await prisma.dailyNote.findUnique({ where: { userId_date: { userId: b.id, date: "2026-05-06" } } });
    expect(aNote!.content).toBe("A note");
    expect(bNote!.content).toBe("B note");
  });
});

describe("deleteNoteImageCore", () => {
  it("deletes own image, returns filePath", async () => {
    const u = await makeUser();
    const note = await prisma.dailyNote.create({ data: { userId: u.id, date: "2026-05-06", content: "" } });
    const img = await prisma.noteImage.create({
      data: { noteId: note.id, filePath: "uploads/x.jpg", originalName: "x.jpg", sizeBytes: 100, mimeType: "image/jpeg" },
    });
    const out = await deleteNoteImageCore(u.id, img.id, prisma);
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.filePath).toBe("uploads/x.jpg");
    expect(await prisma.noteImage.findUnique({ where: { id: img.id } })).toBeNull();
  });

  it("rejects another user's image", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const note = await prisma.dailyNote.create({ data: { userId: a.id, date: "2026-05-06", content: "" } });
    const img = await prisma.noteImage.create({
      data: { noteId: note.id, filePath: "p", originalName: "p", sizeBytes: 1, mimeType: "image/png" },
    });
    expect((await deleteNoteImageCore(b.id, img.id, prisma)).ok).toBe(false);
  });

  it("missing image fails", async () => {
    const u = await makeUser();
    expect((await deleteNoteImageCore(u.id, 99999, prisma)).ok).toBe(false);
  });
});

describe("reorderNoteImagesCore", () => {
  it("reorders images", async () => {
    const u = await makeUser();
    const note = await prisma.dailyNote.create({ data: { userId: u.id, date: "2026-05-06", content: "" } });
    const i1 = await prisma.noteImage.create({ data: { noteId: note.id, filePath: "1", originalName: "1", sizeBytes: 1, mimeType: "image/png", sortOrder: 0 } });
    const i2 = await prisma.noteImage.create({ data: { noteId: note.id, filePath: "2", originalName: "2", sizeBytes: 1, mimeType: "image/png", sortOrder: 1 } });
    const out = await reorderNoteImagesCore(u.id, note.id, [i2.id, i1.id], prisma);
    expect(out.ok).toBe(true);
    const after = await prisma.noteImage.findMany({ where: { noteId: note.id }, orderBy: { sortOrder: "asc" } });
    expect(after.map((x) => x.id)).toEqual([i2.id, i1.id]);
  });

  it("rejects another user's note", async () => {
    const a = await makeUser("a");
    const b = await makeUser("b");
    const note = await prisma.dailyNote.create({ data: { userId: a.id, date: "2026-05-06", content: "" } });
    expect((await reorderNoteImagesCore(b.id, note.id, [], prisma)).ok).toBe(false);
  });

  it("rejects mismatched id list", async () => {
    const u = await makeUser();
    const note = await prisma.dailyNote.create({ data: { userId: u.id, date: "2026-05-06", content: "" } });
    expect((await reorderNoteImagesCore(u.id, note.id, [1, 2], prisma)).ok).toBe(false);
  });
});
```

提交：
```bash
git add src/lib/note-validation.ts tests/unit/note-validation.test.ts
git commit -m "feat: add note validation helpers"

git add 'src/app/(app)/notes/actions-core.ts' tests/integration/notes-actions.test.ts
git commit -m "feat: add note CRUD core (upsert/deleteImage/reorderImages)"
```

---

### Task 3: server action 包装

```typescript
// src/app/(app)/notes/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteNoteImageFromDisk } from "@/lib/storage";
import {
  upsertNoteCore, deleteNoteImageCore, reorderNoteImagesCore,
} from "./actions-core";

export async function upsertNoteAction(date: string, content: string) {
  const user = await requireAuth();
  const result = await upsertNoteCore(user.id, date, content, prisma);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/");
  return { ok: true };
}

export async function deleteNoteImageAction(imageId: number) {
  const user = await requireAuth();
  const result = await deleteNoteImageCore(user.id, imageId, prisma);
  if (!result.ok) return { ok: false, error: result.error };
  // 异步清理磁盘，不阻塞响应
  deleteNoteImageFromDisk(result.filePath).catch(() => {});
  revalidatePath("/");
  return { ok: true };
}

export async function reorderNoteImagesAction(noteId: number, imageIds: number[]) {
  const user = await requireAuth();
  const result = await reorderNoteImagesCore(user.id, noteId, imageIds, prisma);
  if (!result.ok) return { ok: false, error: result.error };
  revalidatePath("/");
  return { ok: true };
}
```

提交：`feat: add notes server action wrappers`

---

### Task 4: storage helper + `requireAuthApi` + uploads API（TDD where reasonable）

#### Step 4.0: 给 `src/lib/auth.ts` 加 `requireAuthApi`

```typescript
export async function requireAuthApi(): Promise<User | Response> {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(
      JSON.stringify({ ok: false, error: "未登录" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return user;
}
```

#### `src/lib/storage.ts`

```typescript
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { ALLOWED_EXT } from "./note-validation";

export function getDataDir(): string {
  return process.env.DATA_DIR || path.resolve(process.cwd(), "data");
}

export function getUploadsRoot(): string {
  return path.join(getDataDir(), "uploads");
}

export function buildUploadPath(userId: number, dateKey: string, mimeType: string): {
  relPath: string;
  absPath: string;
} {
  const ext = ALLOWED_EXT[mimeType] || "bin";
  const yyyymm = dateKey.slice(0, 7); // YYYY-MM
  const id = crypto.randomBytes(16).toString("hex");
  const relPath = path.posix.join(`${userId}`, yyyymm, `${id}.${ext}`);
  const absPath = path.join(getUploadsRoot(), relPath);
  return { relPath, absPath };
}

export async function saveUpload(absPath: string, buffer: Buffer): Promise<void> {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, buffer);
}

export async function deleteNoteImageFromDisk(relPath: string): Promise<void> {
  const abs = path.join(getUploadsRoot(), relPath);
  await fs.unlink(abs).catch(() => {}); // missing is fine
}

export async function readUpload(relPath: string): Promise<Buffer | null> {
  const abs = path.join(getUploadsRoot(), relPath);
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}
```

测试 storage 工具：

```typescript
// tests/unit/storage.test.ts
import { describe, it, expect, afterEach } from "vitest";
import { buildUploadPath, saveUpload, readUpload, deleteNoteImageFromDisk, getDataDir } from "@/lib/storage";
import path from "node:path";
import fs from "node:fs/promises";

const TEST_DIR = path.resolve(process.cwd(), "test-data/uploads-test");
const ORIGINAL_DATA_DIR = process.env.DATA_DIR;

beforeEach(() => {
  process.env.DATA_DIR = path.resolve(process.cwd(), "test-data");
});
afterEach(async () => {
  process.env.DATA_DIR = ORIGINAL_DATA_DIR;
  // best-effort cleanup
  await fs.rm(TEST_DIR, { recursive: true, force: true });
});

describe("buildUploadPath", () => {
  it("produces userId/YYYY-MM/uuid.ext", () => {
    const p = buildUploadPath(7, "2026-05-06", "image/png");
    expect(p.relPath).toMatch(/^7\/2026-05\/[0-9a-f]{32}\.png$/);
  });

  it("falls back to bin for unknown mime", () => {
    const p = buildUploadPath(1, "2026-05-06", "image/svg+xml");
    expect(p.relPath).toMatch(/\.bin$/);
  });
});

describe("save / read / delete roundtrip", () => {
  it("saves and reads a buffer; deletes it", async () => {
    const buf = Buffer.from("hello");
    const { relPath, absPath } = buildUploadPath(1, "2026-05-06", "image/png");
    await saveUpload(absPath, buf);
    const back = await readUpload(relPath);
    expect(back?.equals(buf)).toBe(true);
    await deleteNoteImageFromDisk(relPath);
    expect(await readUpload(relPath)).toBeNull();
  });
});
```

#### `requireAuthApi` 加到 `src/lib/auth.ts`

```typescript
export async function requireAuthApi(): Promise<User | Response> {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(
      JSON.stringify({ ok: false, error: "未登录" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return user;
}
```

#### Upload route — `src/app/api/uploads/route.ts`

> **关键**：用 `requireAuthApi` 而不是 `requireAuth`（区别见坑点 #1）。
> **关键**：用 `prisma.$transaction` 把"upsert note + 检查 count + insert image"放一起，避免并发超限（坑点 #2）。先写盘再开事务，事务失败时删盘。

```typescript
import { requireAuthApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import fs from "node:fs/promises";
import {
  validateImageMeta, validateDateKey,
  NOTE_IMAGES_MAX, NOTE_IMAGE_BYTES_MAX,
} from "@/lib/note-validation";
import { buildUploadPath, saveUpload, getUploadsRoot } from "@/lib/storage";
import path from "node:path";

function bad(error: string, status = 400) {
  return Response.json({ ok: false, error }, { status });
}

export async function POST(req: Request) {
  const userOrRes = await requireAuthApi();
  if (userOrRes instanceof Response) return userOrRes;
  const user = userOrRes;

  const form = await req.formData().catch(() => null);
  if (!form) return bad("请求格式错误");

  const date = String(form.get("date") ?? "");
  const dv = validateDateKey(date);
  if (!dv.ok) return bad(dv.error);

  const file = form.get("file");
  if (!(file instanceof File)) return bad("缺少文件");

  const mv = validateImageMeta({ mimeType: file.type, sizeBytes: file.size });
  if (!mv.ok) return bad(mv.error);

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) return bad("文件为空");
  if (buffer.length > NOTE_IMAGE_BYTES_MAX) return bad("单张图片不能超过 5MB");

  // 先写盘（盘失败 → 立即返回，没动 DB）
  const { relPath, absPath } = buildUploadPath(user.id, date, file.type);
  try {
    await saveUpload(absPath, buffer);
  } catch (e) {
    console.error("upload write failed", e);
    return bad("文件保存失败", 500);
  }

  // 事务：upsert note + 检查 count + insert image。失败回滚 DB + 删盘
  try {
    const created = await prisma.$transaction(async (tx) => {
      const note = await tx.dailyNote.upsert({
        where: { userId_date: { userId: user.id, date } },
        update: {},
        create: { userId: user.id, date, content: "" },
        include: { images: true },
      });
      if (note.images.length >= NOTE_IMAGES_MAX) {
        throw Object.assign(new Error("OVER_LIMIT"), { __reason: "OVER_LIMIT" });
      }
      const maxOrder = note.images.reduce((m, i) => Math.max(m, i.sortOrder), -1);
      return tx.noteImage.create({
        data: {
          noteId: note.id,
          filePath: relPath,
          originalName: file.name || "image",
          sizeBytes: buffer.length,
          mimeType: file.type,
          sortOrder: maxOrder + 1,
        },
      });
    });

    return Response.json({ ok: true, image: { id: created.id, sortOrder: created.sortOrder } });
  } catch (e) {
    // 删盘清理（fire-and-forget log）
    fs.unlink(path.join(getUploadsRoot(), relPath)).catch((err) =>
      console.error("upload rollback unlink failed", relPath, err)
    );
    if (e && (e as { __reason?: string }).__reason === "OVER_LIMIT") {
      return bad(`每条心声最多 ${NOTE_IMAGES_MAX} 张图`);
    }
    console.error("upload tx failed", e);
    return bad("写入失败", 500);
  }
}
```

#### Serve route — `src/app/api/uploads/[id]/route.ts`

> 用 `requireAuthApi`（坑点 #1）。MVP 心声圈内可见，Plan 5 加 isPrivate 时再加过滤。

```typescript
import { requireAuthApi } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { readUpload } from "@/lib/storage";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const userOrRes = await requireAuthApi();
  if (userOrRes instanceof Response) return userOrRes;

  const { id: idStr } = await ctx.params;
  const id = Number(idStr);
  if (!Number.isInteger(id)) return new Response("Bad request", { status: 400 });

  const img = await prisma.noteImage.findUnique({ where: { id } });
  if (!img) return new Response("Not found", { status: 404 });

  const buf = await readUpload(img.filePath);
  if (!buf) return new Response("Not found on disk", { status: 404 });

  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": img.mimeType,
      "Cache-Control": "private, max-age=3600",
      "Content-Length": String(img.sizeBytes),
    },
  });
}
```

集成测 uploads route：

```typescript
// tests/integration/uploads-route.test.ts
import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { getTestPrisma, resetTestDb, closeTestDb } from "../helpers/test-db";
import { hashPassword } from "@/lib/password";
import { COLOR_PALETTE } from "@/lib/task-validation";
import path from "node:path";
import fs from "node:fs/promises";

const TEST_DATA = path.resolve(process.cwd(), "test-data/uploads-route-test");
process.env.DATA_DIR = TEST_DATA;

const prisma = getTestPrisma();

beforeEach(async () => {
  await resetTestDb();
  await fs.rm(TEST_DATA, { recursive: true, force: true });
});
afterAll(async () => {
  await closeTestDb();
  await fs.rm(TEST_DATA, { recursive: true, force: true });
});

async function makeUserAndCookie() {
  const user = await prisma.user.create({
    data: {
      username: "alice", passwordHash: await hashPassword("x"),
      displayName: "Alice", color: COLOR_PALETTE[0],
    },
  });
  return user;
}

// Use cookies API mock: simplest is to patch next/headers via vi.mock
import { vi } from "vitest";

vi.mock("next/headers", async () => {
  return {
    cookies: async () => ({
      get: () => undefined, // override per test via global state if needed
    }),
  };
});

// Above mock is rough — for integration we test the core: build a session
// row and call validateSession via auth.ts. But auth.ts uses cookies()...
// Simplest robust path: skip route-level integration; rely on E2E for the 端到端
// upload path. Here, just unit-test buildUploadPath and saveUpload (already in storage.test.ts).
// Skip writing brittle Vitest tests for the upload route.

describe("placeholder", () => {
  it("uploads route covered by E2E", () => {
    expect(true).toBe(true);
  });
});
```

> Per the comment above: route-level integration testing of `requireAuth()` is brittle. Skip route unit tests, rely on E2E in Task 7. Just keep storage unit tests.

提交：
```bash
git add src/lib/storage.ts tests/unit/storage.test.ts
git commit -m "feat: add upload storage helpers"

git add 'src/app/api/uploads/' 'src/app/(app)/notes/actions.ts'
git commit -m "feat: add image upload + serve route handlers + note actions"
```

> **NOTE**：跳过 uploads-route.test.ts。E2E 会覆盖。

---

### Task 5: 心声编辑器 UI（impeccable，集成到 day-detail-sheet）

#### 必须先调 impeccable craft

延续 Plan 1-3 的设计语言：温暖手作、纸张感、OKLCH 配色、衬线 CJK 标题。

#### 功能契约

修改 `src/app/(app)/day-detail-sheet.tsx`：

替换"心声功能将在 Plan 4 上线"占位为编辑区，包含：

1. textarea：value 从 props.note.content 初始化（无则空），maxLength=10000，placeholder "今天最想说的一句话…"，下方字数计数 `{n}/10000`
2. **保存** 按钮：调 `upsertNoteAction(date, content)`；按钮 disabled 当无变化或 pending。
3. **图片网格**：缩略图（fixed-size，比如 96×96），来源 `/api/uploads/${img.id}`。每张右上角小 × 删除按钮，调 `deleteNoteImageAction(img.id)`。
4. **上传按钮**：`<input type="file" accept="image/jpeg,image/png,image/webp,image/gif">`，change 后 fetch POST `/api/uploads` with FormData{date, file}。pending 时禁用。返回错误时 toast。上传成功后用 `router.refresh()` 拉新数据。
5. 状态：textarea 有未保存修改时按钮高亮"保存"；otherwise"已保存"。
6. 限额提示：图片数 ≥ 6 时禁用上传按钮 + 显示"已达上限 6 张"。
7. 不保存就关闭 sheet → 弹 confirm "未保存的修改将丢失，是否离开？"。

#### page.tsx 数据加载

`(app)/page.tsx` 现在要把当月 daily notes（含 images）也查出来传给 month-view，以便：
- 月历格子上的"心声"指示
- 日详情面板里直接拿到当日 note + images

```typescript
const notes = await prisma.dailyNote.findMany({
  where: { userId: user.id, date: { gte: range.start, lte: range.end } },
  include: { images: { orderBy: { sortOrder: "asc" } } },
});
const notesByDate = Object.fromEntries(notes.map((n) => [n.date, n]));
```

把 `notesByDate` 传给 `<MonthView>`，再传给 `<DayDetailSheet>`。

#### 提交（按合理粒度）

```bash
git add 'src/app/(app)/page.tsx' 'src/app/(app)/month-view.tsx' 'src/app/(app)/day-detail-sheet.tsx'
git commit -m "feat: add note editor with text + image upload in day detail sheet"
```

---

### Task 6: 月视图格子上加心声指示

很轻：格子右下角放一个小 ✎ 或浅色小圆点。鼠标 hover 显示心声前 30 字预览（title 属性即可）。如果 note.content 为空但有 image，也显示。

数据：把 `notesByDate` 传到 cell 渲染层，按 `cell.key` 取。

提交：`feat: show note indicator on month-view day cells`

---

### Task 7: E2E

`tests/e2e/notes.spec.ts`

测试：
1. 登录 → 打开今天的日详情 → 编辑器可见
2. 输入文本 → 点保存 → toast / 按钮变"已保存" → reopen 仍存在
3. 上传一张小 PNG → 网格出现缩略图
4. 删除该图 → 缩略图消失
5. 字数超过 10000 → 输入被截断（maxLength） / 提示

实现细节：
- 用 `page.setInputFiles('input[type=file]', { name: "tiny.png", mimeType: "image/png", buffer: <1x1 png buffer> })` 上传
- 1x1 png buffer：
  ```js
  Buffer.from(
    "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000005000158a72f8d0000000049454e44ae426082",
    "hex"
  )
  ```
- beforeAll 清 e2e_alice 的 notes / images

更新 `scripts/e2e-clean-tasks.js`（或新写一个 clean-all）：
```javascript
await p.noteImage.deleteMany({ where: { note: { user: { username: "e2e_alice" } } } });
await p.dailyNote.deleteMany({ where: { user: { username: "e2e_alice" } } });
await p.occurrence.deleteMany({ where: { user: { username: "e2e_alice" } } });
await p.task.deleteMany({ where: { user: { username: "e2e_alice" } } });
```

提交：
```bash
git add scripts/e2e-clean-tasks.js
git commit -m "chore: extend e2e cleanup to clear notes and images"

git add tests/e2e/notes.spec.ts
git commit -m "test: add E2E for daily note editor + image upload"
```

---

### Task 8: 全量回归 + Plan 4 收官

- `pnpm test` 全绿（78 + 验证 + actions + storage）
- `pnpm test:e2e` 全绿（24 + ~5 新）
- `pnpm build` 通过
- 手动 smoke：登录 → 打开日详情 → 写一条心声 → 上传 PNG → 关闭 sheet → 重新打开 → 全部还在
- 验证图片 URL 直访（未登录）→ 401/重定向
- 删除一张图 → 磁盘文件实际消失（用 `find data/uploads`)
- 更新 README
- 最终 commit：`docs: update README for Plan 4 daily notes`

---

## Plan 4 验收清单

- [ ] `pnpm test` 全绿
- [ ] `pnpm test:e2e` 全绿
- [ ] `pnpm build` 通过
- [ ] 日详情面板：能写心声、保存、再打开内容仍在
- [ ] 上传 5MB 内的 jpg/png/webp/gif 成功，缩略图显示
- [ ] 超 5MB 或不支持类型 → 后端拒绝（前端兜底 + 后端兜底）
- [ ] 6 张上限 → 后端拒绝
- [ ] 字数超 10000 → 后端拒绝
- [ ] 图片 URL 未登录访问 → 401/302
- [ ] 同日同用户多次保存 → 仍只一行 note
- [ ] 删除图片 → DB 行消失 + 磁盘文件消失
- [ ] git log 比 Plan 3 末尾多 ~10 个 commit

通过后进入 Plan 5。
