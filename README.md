# 日历记账

A self-hosted calendar-based task tracker for small circles (couple, family, close friends). Plan 2 complete — foundation, authentication, and full task CRUD (create / edit / archive / delete).

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
pnpm test                        # vitest unit + integration (46 tests)
pnpm test:e2e                    # Playwright E2E (12 tests: 3 auth + 9 task CRUD, auto-spawns dev server)
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
      page.tsx         # / home (redirects to /tasks for now)
      tasks/           # /tasks — task list + create/edit form + archive/delete
    api/
      login/           # POST /api/login
      logout/          # POST /api/logout
  lib/
    db.ts              # Prisma singleton (dev-HMR-safe)
    password.ts        # bcrypt wrappers
    session.ts         # session create/validate/destroy
    auth.ts            # getCurrentUser / requireAuth
    task-validation.ts # validateTaskInput + 12-color palette + parseTaskFormData
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
- [ ] Plan 3: Month view + occurrence recording + day detail panel (next)
- [ ] Plan 4: Daily notes (text + image upload)
- [ ] Plan 5: Week view + multi-user / merged timeline + privacy filtering
- [ ] Plan 6: Docker deployment + backup scripts

For full product specification, see `specifications.md`.
