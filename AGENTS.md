<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## Cursor Cloud specific instructions

This repo is a Vite+ monorepo driven by the global `vp` CLI. The repo does not ship a global `vp`; it is installed separately at `~/.vite-plus` and put on `PATH` by `~/.vite-plus/env`, which the update script's `vp install` relies on. (After `vp install`, a project-local `node_modules/.bin/vp` also exists, but bootstrapping still needs the global `vp`.) `vp` manages its own Node.js runtime (currently v24, required by `engines.node >=24.18.1`) rather than the system/nvm Node, so always invoke tooling through `vp` (e.g. `vp node`, `vp run ...`) instead of a bare `node`/`npm`.

Hexkit is a **PoC-stage** OpenAPI code generator. `@hexkit/cli` implements `hexkit generate` with pipelines for Apical contracts, hexagonal architecture, Hono (default) or Next.js (opt-in), Drizzle persistence, and Docker Compose packaging. Dogfood fixtures live under `apps/petstore-sample`, `apps/petstore-next`, and `apps/fixtures/auth-api`. `@hexkit/plugin-sst` is scaffold-only (deferred post-PoC). See [README.md](./README.md) § Project status and [PRD.md](./PRD.md) §10 for milestones.

Common commands (all standard, defined in root `package.json` / per-package scripts — see those files):

- `vp check` — format + lint + type-check for **Hexkit** (`packages/*` + `apps/cli`) via Oxlint. Dogfood fixtures are ignored (`apps/petstore-sample`, `apps/petstore-next`, `apps/fixtures`).
- `vp run --filter './packages/*' --filter './apps/cli' build` — pack Hexkit packages (`dist/index.mjs` + `.d.mts`). **Run before tests** — workspace packages export from `dist/`. Do not combine `--filter` with `-r`.
- `vp run --filter './packages/*' --filter './apps/cli' test` — Hexkit unit tests (~100+; some packages use `--passWithNoTests`).
- `vp run coverage` — Vitest coverage for generator packages only (`packages/*` + `apps/cli`); **90%** thresholds on statements/branches/functions/lines (`coverage.config.ts`). Dogfood apps are out of scope. Also run by GitHub Actions Quality. CI publishes a per-package Vitest job summary (`apps/cli/src/hexkit-test-report.ts`) with test counts and coverage %.
- `vp run dev` — runs the root `dev` script = `@hexkit/cli` in watch mode (`vp pack --watch`). There is no long-lived HTTP server in the monorepo; validate generated apps via dogfood or by executing rebuilt `dist/index.mjs`.
- `vp run ready` — convenience script that chains build + check + test + coverage.
- `vp run dogfood` — Hono Pet Shop: generate → Oxlint + `tsc` on the generated app → Compose build → Pactum (Docker required). CI job **Dogfood API**.
- `vp run dogfood-petstore-next` — Next Pet Shop: generate → ESLint 9 + `next build`. CI job **Dogfood NextJS** uses `HEXKIT_SKIP_COMPOSE=1` (no app tests). Locally, omit that env to also bring up Compose.
- `vp run dogfood-auth` — auth fixture Compose + Pactum acceptance (local; not a CI job).

Gotchas:

- Running `vp install` executes the `prepare` script (`vp config`), which rewrites the tool-managed `<!--VITE PLUS ... -->` block in `AGENTS.md`/`CLAUDE.md`. Keep custom docs (like this section) outside that block. `vp config` also detects the Cursor-managed git hooks path and skips installing its own hooks.
- `dist/` output is git-ignored, so a clean `git status` after a build/watch is expected.
- GitHub Actions runs three **parallel** jobs: **Quality** (Hexkit build/lint/types/unit tests/coverage), **Dogfood API** (generated Hono Pet Shop lint/types/Compose/Pactum), **Dogfood NextJS** (generated Next Pet Shop ESLint + `next build`).
- `apps/petstore-next` is a vanilla create-next-app-shaped dogfood app. Validate it with **its** ESLint 9 (`eslint-config-next`) and TypeScript 5 (`next build`), not monorepo Oxlint/`vp check`. Generated Hono apps use Oxlint + `tsc` from the generate output directory.
