# Contributing to Skibidi Orders

Thanks for helping. This guide is the shortest path from clone → local run → pull request.

## 1. Clone and install

```bash
git clone https://github.com/CarmineMattia/skibidi-.git
cd skibidi-
npm install
cp .env.example .env
```

Fill `.env` with Supabase credentials (see [SETUP-GUIDE.md](./SETUP-GUIDE.md)). Ask a maintainer for a shared **dev** project if you do not have your own.

Start the app:

```bash
npm run web
# or: npm start  → then press `w`
```

## 2. Branching

Never push straight to `main` for feature work.

```bash
git checkout main
git pull origin main
git checkout -b feature/short-description
# or: fix/short-description
```

Keep branches small and focused on one concern (UI, migration, hook, etc.).

## 3. Before you open a PR

Run what applies to your change:

```bash
npm run type-check
npm run lint
npx vitest run          # if you touched lib/utils or unit-tested code
npx playwright test     # if you changed user-facing flows (app must be up)
```

Also:

- Do **not** commit `.env`, credentials, or `playwright-report/`
- Prefer existing patterns in `components/`, `lib/hooks/`, and `lib/stores/`
- New SQL goes in `supabase/migrations/` with a dated filename (`YYYYMMDD_description.sql`)
- Keep UI consistent with the current Ambrosia / brand styles already in the app

## 4. Commit message format (required)

A `commit-msg` hook enforces this shape:

```text
{message} ({taskId}) tests: {description of tests}
```

- `taskId`: alphanumeric only (e.g. `TASK147`)
- `tests:`: what you verified (or `tests: non eseguiti` if nothing ran)

Examples:

```text
fix: order tracking code display for guests (TASK148) tests: unit orderDisplayCode + manual guest track
add: pizza capacity snapshot on create order (TASK149) tests: vitest pizzaCapacity
chore: ignore playwright-report in gitignore (TASK150) tests: non eseguiti
```

## 5. Open a pull request

```bash
git push -u origin HEAD
```

Then open a PR against `main` on GitHub (UI or CLI):

```bash
gh pr create --title "Short summary of the change" --body "$(cat <<'EOF'
## Summary
- What changed and why

## Test plan
- [ ] `npm run type-check`
- [ ] Manual / Playwright steps you ran

EOF
)"
```

### PR checklist

- [ ] Branch is up to date with `main`
- [ ] Commit messages follow the hook format
- [ ] No secrets in the diff
- [ ] Migrations included if schema/RLS changed
- [ ] Type-check passes
- [ ] Description explains **why**, not only **what**

## 6. Review expectations

Maintainers look for:

- Correct RLS / auth boundaries (customers must not see other customers’ orders)
- No regressions on kitchen / admin / guest checkout
- Clear, small diffs that are easy to revert

If CI or review fails, push fixes on the **same branch**; do not open a duplicate PR.

## Need help?

- Setup details: [SETUP-GUIDE.md](./SETUP-GUIDE.md)
- Stack overview: [README.md](./README.md)
- Product roadmap (if present): `roadmap.md`
