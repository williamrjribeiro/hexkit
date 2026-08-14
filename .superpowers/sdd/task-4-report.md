# Task 4 Report: CLI `--http` selection and Next packaging

## Status

Implemented CLI selection for Hono vs Next, Next surface selection, Next packaging output, and Next DB bootstrap generation.

## Changes

- Added `hexkit generate <openapi> <output> [--http hono|next] [--next-surface both|routes|rsc]`.
- Kept Hono as the default HTTP adapter.
- Added validation so `--next-surface` without `--http next` exits with an error.
- Added `createDefaultPlugins({ apical?, http?, nextSurface? })`.
- Wired the Next pipeline as `apical -> architecture-hexagonal -> next(surface) -> drizzle -> packaging(next)`.
- Added Next packaging files:
  - `package.json` with Next, React, React DOM, Drizzle, Postgres, Zod, and scripts.
  - `next.config.ts`, `next-env.d.ts`, and App Router `tsconfig.json`.
  - `Dockerfile`, `.dockerignore`, and `docker-compose.yml` for Next + Postgres.
  - `src/adapters/db/database.ts` exporting `getDatabase()` for generated Next runtime/server-access imports.
- Added `packages/plugin-next/src` to CLI domain-agnostic scan roots.
- Added `@hexkit/plugin-next` to `apps/cli` dependencies and lockfile.
- Added `apps/cli/src/next-generation.test.ts`.

## TDD evidence

Red checks observed:

- New CLI and Next generation tests failed on missing help/options parsing, Hono-only pipeline, missing CLI dependency, and missing Next generated output.
- Added a Dockerfile assertion after self-review; it failed because the generated Next Dockerfile used `pnpm install --prod` before `next build`.

Green checks observed:

- Updated CLI parser, pipeline wiring, dependency graph, and Next packaging.
- Updated Next Dockerfile generation to install build dependencies before `pnpm build`, then prune production dependencies.

## Verification

Passing:

- `vp run @hexkit/plugin-next#build`
- `vp run @hexkit/cli#test -- apps/cli/src/command.test.ts apps/cli/src/next-generation.test.ts`
- `vp run @hexkit/plugin-next#test`
- `vp run @hexkit/cli#check`
- `vp run @hexkit/plugin-next#check`
- `vp run @hexkit/cli#build`
- `git diff --check`

Known unrelated check issue:

- Root `vp check` still fails on formatting in:
  - `docs/superpowers/plans/2026-08-11-nextjs-route-handlers.md`
  - `docs/superpowers/specs/2026-08-11-nextjs-route-handlers-design.md`
- These docs were already outside the Task 4 edit set, so I left them untouched.

## Self-review

- Hono default path remains unchanged: existing assembled Petstore/Library/auth CLI tests pass.
- Next path emits no Hono `src/runtime/server.ts`.
- `routes` surface emits route handlers plus `server-access`, without `app/ui/**`.
- `rsc` surface emits contract-path pages plus `server-access`, without route handlers/runtime/controllers.
- Next `server-access` and runtime imports now resolve through generated `src/adapters/db/database.ts`.
- Domain-agnostic scanner now includes `packages/plugin-next/src`.

## Concerns

- Clean CLI test runs that import `@hexkit/plugin-next` require the plugin-next package entry to be built first (`vp run @hexkit/plugin-next#build`), matching the repo's dist-backed package export pattern.
