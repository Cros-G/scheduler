# 日历记账

A self-hosted calendar-based task tracker for small circles (couple, family, close friends). Plan 5 complete — week view (`/week`), multi-user timeline (`/timeline`), per-user readonly calendar (`/u/<username>`), user profile settings (`/settings`), privacy filtering (private tasks hidden from others), and progress badges on COUNTED tasks.

## Stack

- Next.js 15 (App Router) + TypeScript
- Tailwind CSS 4
- Prisma 6 + SQLite
- bcryptjs for password hashing
- Vitest (unit + integration) + Playwright (E2E)

## Development

```bash
pnpm install
pnpm db:migrate                  # initialize SQLite
pnpm seed:user --username alice --display "Alice" --password "..." --color "#FF8888" [--admin]
pnpm dev                         # http://localhost:3000
```

## Testing

```bash
pnpm test                        # vitest unit + integration (122 tests, 13 files)
pnpm test:e2e                    # Playwright E2E (47 tests: auth + task CRUD + occurrence/month-view + daily-notes + settings + week-view + multiuser; auto-spawns dev server, runs sequentially)
pnpm build                       # production build (type-check + bundle)
```

## CLI utilities

```bash
# Create or upsert a user (used by admin to provision accounts).
pnpm seed:user --username <u> --display "<d>" --password "<p>" --color "#hex" [--admin]

# Reset a user's password (also clears all their sessions).
pnpm seed:reset-password --username <u> --password "<new>"
```

## Project structure

```
prisma/                # Prisma schema + migrations
src/
  app/
    login/             # public login page
    (app)/             # auth-guarded route group
      page.tsx         # / home — month view with task panel + occurrence grid
      week/            # /week — 7-column week view; today highlighted; occurrence recording
      timeline/        # /timeline — merged view all users × days; private tasks filtered
      u/[username]/    # /u/<x> — readonly month view of another user's public tasks
      settings/        # /settings — displayName + color picker; revalidates layout on save
      tasks/           # /tasks — task list + create/edit form + archive/delete
      occurrences/     # server actions: addOccurrence, removeOccurrence, setCheck
      notes/           # server actions: upsertNote, deleteNoteImage, reorderNoteImages
      nav-bar.tsx      # top nav: links to all routes, active state, view-switcher dropdown
      note-editor.tsx  # textarea + image grid; readonly prop hides save/upload/delete
    api/
      login/           # POST /api/login
      logout/          # POST /api/logout
      uploads/         # POST /api/uploads (multipart upload), GET /api/uploads/[id] (serve image, auth-gated)
  lib/
    db.ts              # Prisma singleton (dev-HMR-safe)
    password.ts        # bcrypt wrappers
    session.ts         # session create/validate/destroy
    auth.ts            # getCurrentUser / requireAuth / requireAuthApi
    task-validation.ts # validateTaskInput + 12-color palette + parseTaskFormData
    note-validation.ts # validateNoteContent / validateImageMeta; NOTE_IMAGES_MAX=6, NOTE_IMAGE_BYTES_MAX=5MB
    storage.ts         # buildUploadPath / saveUpload / readUpload / deleteNoteImageFromDisk
    dates.ts           # formatDateKey (sv-SE), monthGrid, todayKey, weekRange, monthRange
    visibility.ts      # scopeTasksWhere / scopeOccurrencesWhere — privacy filter helpers
scripts/               # CLI utilities (seed-user, reset-password)
tests/
  unit/                # password, session, task-validation
  integration/         # login route, seed-user, task server-actions
  e2e/                 # auth + task CRUD + occurrence + notes + settings + week + multiuser
  helpers/             # test DB fixtures
docs/superpowers/      # design docs and execution plans
```

The dev DB (`dev-data/dev.db`) and test DB (`test-data/test.db`) carry seeded users including `e2e_alice` (password: `test_password_123`) created by the E2E global setup.

Uploaded images are stored at `${DATA_DIR}/uploads/<userId>/<YYYY-MM>/<uuid>.<ext>` where `DATA_DIR` defaults to `dev-data` (dev) or `test-data` (test). The `/api/uploads/[id]` route serves files directly from disk; unauthenticated requests receive a 401 JSON response.

## Roadmap

See `docs/superpowers/plans/` for execution plans:

- [x] Plan 1: Foundation + authentication (User, Session, login/logout)
- [x] Plan 2: Task CRUD — Prisma Task model, validation, server actions, `/tasks` UI (list, form, emoji picker, 12-color palette, archive/unarchive/delete)
- [x] Plan 3: Month view + occurrence recording — `/` is now month calendar with task panel; CHECK (idempotent toggle) + COUNTED (count badge accumulation); day detail sheet; delete guard blocks tasks with occurrences
- [x] Plan 4: Daily notes / 心声 — per-day text editor (10000 char cap) + image upload (6 images/day, 5 MB each, jpg/png/webp/gif); auth-gated image serve; transactional DB + disk rollback on failure
- [x] Plan 5: Views + multi-user — `/week` (7-column week calendar), `/timeline` (all users × days merged), `/u/<username>` (readonly profile view with 404 for missing users, self-redirect to `/`), `/settings` (displayName + color), privacy filter (`isPrivate` tasks hidden from non-owners), progress badges on COUNTED tasks, view-switcher dropdown in nav
- [ ] Plan 6: Docker deployment + backup scripts

For full product specification, see `specifications.md`.
