# 日历记账

A self-hosted calendar-based task tracker for small circles (couple, family, close friends). Plan 3 complete — month view with task panel, occurrence recording (CHECK toggle + COUNTED accumulation), day detail sheet, and delete guard for tasks with occurrences.

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
pnpm test                        # vitest unit + integration (78 tests)
pnpm test:e2e                    # Playwright E2E (24 tests: 3 auth + 9 task CRUD + 12 occurrence/month-view, auto-spawns dev server)
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
    api/
      login/           # POST /api/login
      logout/          # POST /api/logout
  lib/
    db.ts              # Prisma singleton (dev-HMR-safe)
    password.ts        # bcrypt wrappers
    session.ts         # session create/validate/destroy
    auth.ts            # getCurrentUser / requireAuth
    task-validation.ts # validateTaskInput + 12-color palette + parseTaskFormData
    dates.ts           # formatDateKey (sv-SE), monthGrid, todayKey, weekRange, monthRange
scripts/               # CLI utilities (seed-user, reset-password)
tests/
  unit/                # password, session, task-validation
  integration/         # login route, seed-user, task server-actions
  e2e/                 # auth flow + task CRUD flow
  helpers/             # test DB fixtures
docs/superpowers/      # design docs and execution plans
```

The dev DB (`dev-data/dev.db`) and test DB (`test-data/test.db`) carry seeded users including `e2e_alice` (password: `test_password_123`) created by the E2E global setup.

## Roadmap

See `docs/superpowers/plans/` for execution plans:

- [x] Plan 1: Foundation + authentication (User, Session, login/logout)
- [x] Plan 2: Task CRUD — Prisma Task model, validation, server actions, `/tasks` UI (list, form, emoji picker, 12-color palette, archive/unarchive/delete)
- [x] Plan 3: Month view + occurrence recording — `/` is now month calendar with task panel; CHECK (idempotent toggle) + COUNTED (count badge accumulation); day detail sheet; delete guard blocks tasks with occurrences
- [ ] Plan 4: Daily notes / 心声 (text + image upload) (next)
- [ ] Plan 5: Week view + multi-user / merged timeline + privacy filtering
- [ ] Plan 6: Docker deployment + backup scripts

For full product specification, see `specifications.md`.
