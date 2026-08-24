# Vite+: when Cursor owns `core.hooksPath`, chain into its dispatcher instead of skipping

**Tracker:** https://github.com/voidzero-dev/vite-plus/issues  
**Component:** `vp config` / commit hooks  
**Related Cursor report:** https://forum.cursor.com/t/cloud-agent-skipping-custom-git-hooks/155256  
**Severity:** Medium — breaks staged format/lint autofix in Cursor Cloud without a project workaround

## Summary

`vp config` detects that `core.hooksPath` is already set (Cursor Cloud agent
hooks) and **skips** installing the Vite+ dispatcher. That preserves Cursor’s
hooks, but leaves `.vite-hooks/pre-commit` (`vp staged`) unwired.

Cursor’s dispatcher can chain to a previous hooks directory via
`.cursor-original-hooks-path`. Vite+ should use that extension point: still
generate `.vite-hooks/_`, then register that path with Cursor instead of
no-opping.

## Expected behavior

When `vp config` / `vp hooks enable` runs and `core.hooksPath` already points
at a Cursor agent-hooks directory:

1. Ensure `.vite-hooks/_` (generated dispatcher) exists.
2. Do **not** overwrite Cursor’s `core.hooksPath`.
3. Set Cursor’s `.cursor-original-hooks-path` to the absolute path of
   `.vite-hooks/_` (so Cursor runs Vite+ hooks, then its own).
4. Print a clear status line, e.g.  
   `Cursor owns core.hooksPath; chained Vite+ dispatcher via .cursor-original-hooks-path`.

When Cursor is not present, keep today’s behavior (`core.hooksPath` →
`.vite-hooks/_`).

## Actual behavior

```text
core.hooksPath is already set to ".../.cursor/agent-hooks/...", skipping
```

- `.vite-hooks/pre-commit` (`vp staged`) is never invoked on commit.
- Formatting/lint autofix configured in `staged` never runs.
- CI `vp check` fails on issues pre-commit should have fixed.

## Reproduction

1. Repo with Vite+ hooks:

   ```ts
   // vite.config.ts
   export default defineConfig({
     staged: { "*": "vp check --fix" },
   });
   ```

   ```sh
   # .vite-hooks/pre-commit
   vp staged
   ```

   ```json
   { "scripts": { "prepare": "vp config" } }
   ```

2. Run inside Cursor Cloud (or any environment where Cursor already set
   `core.hooksPath` to its agent-hooks dir).
3. `vp install` / `vp config` prints the skip message above.
4. `cat $core.hooksPath/.cursor-original-hooks-path` → still `<repo>/.git/hooks`
   (empty), not `.vite-hooks/_`.
5. Commit a badly formatted file → succeeds; `vp staged` did not run.

## Evidence / workaround

Hexkit: https://github.com/williamrjribeiro/hexkit/pull/32

Workaround: `scripts/ensure-commit-hooks.sh` after `vp config` rewrites
`.cursor-original-hooks-path` → `.vite-hooks/_` and adds a `.git/hooks`
fallback bridge. That is what Vite+ could do natively.

## Proposed API / UX

| Situation                             | Suggested `vp config` action                                                                    |
| ------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `hooksPath` unset                     | Install `.vite-hooks/_`, set `core.hooksPath` (today)                                           |
| `hooksPath` is Vite+                  | Refresh dispatcher (today)                                                                      |
| `hooksPath` is Cursor agent-hooks     | Generate `.vite-hooks/_`; write it to `.cursor-original-hooks-path`; leave Cursor’s `hooksPath` |
| `hooksPath` is something else unknown | Skip with a warning that names the foreign path and links to docs                               |

Optional: `vp hooks status` should report `chained via Cursor` when this path
is active.

## Docs

Commit hooks guide should document Cursor Cloud coexistence: prefer chaining
over skipping, and show how to verify with `vp hooks status` /
`.cursor-original-hooks-path`.

## Why Vite+ should own part of this

Cursor must fix empty original-path capture (filed separately). Vite+ can
still offer a good experience **today** by registering with Cursor’s existing
chain file whenever it detects agent-hooks — the same pattern Husky users are
hand-rolling in `prepare`.
