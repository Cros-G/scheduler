# 日历记账

A self-hosted calendar-based task tracker for small circles (couple, family, close friends). Phase 1 of an incremental build — currently provides foundation + authentication.

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
pnpm test                        # vitest unit + integration (20 tests)
pnpm test:e2e                    # Playwright E2E (3 tests, auto-spawns dev server)
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
    (app)/             # auth-guarded route group (current home; future tasks/calendar/views)
    api/
      login/           # POST /api/login
      logout/          # POST /api/logout
  lib/
    db.ts              # Prisma singleton (dev-HMR-safe)
    password.ts        # bcrypt wrappers
    session.ts         # session create/validate/destroy
    auth.ts            # getCurrentUser / requireAuth
scripts/               # CLI utilities (seed-user, reset-password)
tests/
  unit/                # password, session
  integration/         # login route, seed-user
  e2e/                 # auth flow
  helpers/             # test DB fixtures
docs/superpowers/      # design docs and execution plans
```

## Roadmap

This is **Plan 1** of 6. See `docs/superpowers/plans/` for upcoming work:
- Plan 2: Task CRUD (data + UI)
- Plan 3: Month view + occurrence recording + day detail
- Plan 4: Daily notes (text + image upload)
- Plan 5: Week view + multi-user / merged timeline + privacy filtering
- Plan 6: Docker deployment + backup scripts

For full product specification, see `specifications.md`.
