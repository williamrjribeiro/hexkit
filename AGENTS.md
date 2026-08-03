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

Everything is scaffolding right now: every workspace `src/index.ts` is just `export {}`, there are no tests yet, and there is no runnable server/HTTP service. The "app" is a code-generator CLI (`@hexkit/cli`) that is not implemented yet. See `RFC.md` for the intended design.

Common commands (all standard, defined in root `package.json` / per-package scripts — see those files):

- `vp check` — format + lint + type-check across the workspace.
- `vp run -r test` — run tests in every package (uses `--passWithNoTests`; no test files exist yet).
- `vp run -r build` — build every package via `vp pack` (emits `dist/index.mjs` + `.d.mts`).
- `vp run dev` — runs the root `dev` script = `@hexkit/cli` in watch mode (`vp pack --watch`). This is the dev "run" loop: editing a `src/**` file triggers an automatic rebuild of that package's `dist/`. There is no long-lived server to hit; validate by importing/executing the rebuilt `dist/index.mjs`.
- `vp run ready` — convenience script that chains check + test + build.

Gotchas:

- Running `vp install` executes the `prepare` script (`vp config`), which rewrites the tool-managed `<!--VITE PLUS ... -->` block in `AGENTS.md`/`CLAUDE.md`. Keep custom docs (like this section) outside that block. `vp config` also detects the Cursor-managed git hooks path and skips installing its own hooks.
- `dist/` output is git-ignored, so a clean `git status` after a build/watch is expected.
