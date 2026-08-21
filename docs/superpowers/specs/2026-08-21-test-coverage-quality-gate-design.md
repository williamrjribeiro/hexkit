# Test coverage quality gate — design

**Status:** Delivered (wiring + 90% thresholds met)  
**Date:** 2026-08-21

## Decisions

| Decision       | Choice                                                                      |
| -------------- | --------------------------------------------------------------------------- |
| Scope          | Generator packages only: `packages/*` + `apps/cli`                          |
| Out of scope   | Dogfood apps (`petstore-sample`, `petstore-next`, `auth-api`)               |
| Provider       | Vitest `v8` via `@vitest/coverage-v8` (matches Vitest 4.1.x from Vite+)     |
| Thresholds     | 90% statements, branches, functions, lines                                  |
| Coverage raise | Delivered — all in-scope packages meet the gate                             |
| Config shape   | Shared root `coverage.config.ts` imported by each in-scope `vite.config.ts` |

## Architecture

1. Catalog + root `devDependency`: `@vitest/coverage-v8`.
2. Shared `hexkitCoverage` options (include `src/**`, exclude tests/dist, reporters text + text-summary, thresholds 90).
3. Each in-scope package adds `test.coverage` and a `coverage` script (`vp test run --coverage`, preserving `--passWithNoTests` where used).
4. Root `coverage` script uses pnpm workspace filters (`vp exec pnpm --filter './packages/*' --filter './apps/cli' run --no-bail coverage`) so every in-scope package’s `coverage` script runs; `ready` chains coverage after the existing test stage. `--no-bail` reports all failing packages instead of stopping at the first threshold miss.

## Baseline (pre-raise, 2026-08-21)

Weighted aggregate for generator packages before the raise: ~90.6% statements, ~79.8% branches, ~96.7% functions, ~91.4% lines. Packages that were below 90% on at least one metric: `codegen`, `plugin-apical`, `plugin-architecture-hexagonal`, `plugin-drizzle`, `plugin-next`, `cli`.

## Non-goals

- Coverage for dogfood / Compose acceptance suites
