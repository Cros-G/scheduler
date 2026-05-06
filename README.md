# 日历记账

A self-hosted calendar-based task tracker for small circles (couple, family, close friends). Plan 4 complete — daily notes (心声) with rich text editor and image upload (jpg/png/webp/gif, up to 6 images per day, 5 MB each), served through an auth-guarded `/api/uploads` route with transactional DB + disk rollback.

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
pnpm test                        # vitest unit + integration (109 tests)
pnpm test:e2e                    # Playwright E2E (30 tests: 2 auth + 8 task CRUD + 12 occurrence/month-view + 6 daily-notes/image-upload; auto-spawns dev server, runs sequentially)
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
      tasks/           # /tasks — task list + create/edit form + archive/delete
      occurrences/     # server actions: addOccurrence, removeOccurrence, setCheck
      notes/           # server actions: upsertNote, deleteNoteImage, reorderNoteImages
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
scripts/               # CLI utilities (seed-user, reset-password)
tests/
  unit/                # password, session, task-validation
  integration/         # login route, seed-user, task server-actions
  e2e/                 # auth flow + task CRUD flow + occurrence flow + notes/image upload flow
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
- [ ] Plan 5: Week view + multi-user / merged timeline + privacy filtering (next)
- [ ] Plan 6: Docker deployment + backup scripts

For full product specification, see `specifications.md`.
