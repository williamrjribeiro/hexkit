# Cursor Cloud: agent-hooks takeover leaves project pre-commit hooks unwired

**Tracker:** Cursor Forum → Bug Reports  
**Related:** https://forum.cursor.com/t/cloud-agent-skipping-custom-git-hooks/155256  
**Severity:** High for monorepos that rely on pre-commit format/lint autofix to keep CI green  
**Seen in:** Cursor Cloud Agents (Vite+ / Husky-style `core.hooksPath` managers)

## Summary

Cursor Cloud sets `core.hooksPath` to its agent-hooks dispatcher
(`~/.cursor/agent-hooks/<id>/`). That dispatcher is designed to chain to the
previous hooks directory via `.cursor-original-hooks-path`, then run Cursor’s
own hooks (e.g. secret scanning).

In practice, `.cursor-original-hooks-path` often still points at the **empty
default** `.git/hooks` (only `*.sample` files). Project hook managers that use
`core.hooksPath` — Vite+ (`.vite-hooks/_`), Husky (`.husky/_`), etc. — never
run. Pre-commit format/lint autofix is silently skipped; CI then fails on
issues the local hook should have fixed.

## Expected behavior

1. Cursor may own `core.hooksPath` for Cloud Agent features.
2. Project commit hooks (Vite+, Husky, …) still run on every `git commit`.
3. If Cursor takes over before the project manager installs hooks, either:
   - refresh `.cursor-original-hooks-path` when a known project dispatcher
     appears (e.g. `.vite-hooks/_`, `.husky/_`), or
   - document a stable extension point so `prepare` / install scripts can
     register the project dispatcher without fighting Cursor.

## Actual behavior

1. Cursor sets `core.hooksPath` → `~/.cursor/agent-hooks/<id>/`.
2. `.cursor-original-hooks-path` contains `/path/to/repo/.git/hooks`.
3. That directory has no real `pre-commit` (only samples).
4. Vite+ `vp config` (and similar tools) see Cursor owns `hooksPath` and
   **skip** installing their dispatcher — they refuse to overwrite Cursor.
5. Result: neither Cursor’s chain nor the project pre-commit runs project
   checks. Commits succeed; CI Quality fails on formatting.

## Reproduction (Vite+)

1. Start a Cursor Cloud Agent on a repo that uses Vite+ commit hooks:
   - `.vite-hooks/pre-commit` → `vp staged`
   - `vite.config.ts` `staged: { "*": "vp check --fix" }`
   - `package.json` `"prepare": "vp config"`
2. Observe:

   ```bash
   git config --get core.hooksPath
   # → .../.cursor/agent-hooks/<id>

   cat "$(git config --get core.hooksPath)/.cursor-original-hooks-path"
   # → <repo>/.git/hooks   ← empty default, not .vite-hooks/_

   ls .git/hooks/pre-commit
   # → No such file
   ```

3. Stage a file with an oxfmt/formatting issue and `git commit`.
4. Commit succeeds; project `vp staged` never ran.
5. CI `vp check` fails on formatting.

## Evidence from Hexkit

Repo: https://github.com/williamrjribeiro/hexkit  
PR: https://github.com/williamrjribeiro/hexkit/pull/32

Workaround committed as `scripts/ensure-commit-hooks.sh` (run from `prepare`
after `vp config`): rewrite `.cursor-original-hooks-path` to `.vite-hooks/_`
and install a `.git/hooks/pre-commit` fallback bridge.

## Proposed fixes (Cursor)

1. **Capture the real prior hooksPath** when taking over — if
   `core.hooksPath` was already `.vite-hooks/_` / `.husky/_` / etc., persist
   that path, not `.git/hooks`.
2. **Re-discover project dispatchers** when original path is the empty
   default: look for common locations (`.vite-hooks/_`, `.husky/_`, …) and
   update `.cursor-original-hooks-path`.
3. **Document the contract** for third-party hook managers: how to register
   with the Cursor dispatcher without unsetting Cursor’s `core.hooksPath`
   (so secret scanning and project hooks both keep working).
4. Avoid treating “hooksPath already set” as success if the chained original
   path has no executable project hooks.

## Why this matters

Cloud Agents commit frequently. Silent hook skip turns “format on commit”
into “format in CI”, which is exactly the failure mode teams adopt Vite+/Husky
to prevent. The dispatcher design is right; the empty `.git/hooks` original
path makes the chain a no-op.
