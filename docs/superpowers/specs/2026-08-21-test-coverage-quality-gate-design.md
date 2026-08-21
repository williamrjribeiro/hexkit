# Test coverage quality gate — design

**Status:** Approved for wiring-only implementation  
**Date:** 2026-08-21

## Decisions

| Decision       | Choice                                                                      |
| -------------- | --------------------------------------------------------------------------- |
| Scope          | Generator packages only: `packages/*` + `apps/cli`                          |
| Out of scope   | Dogfood apps (`petstore-sample`, `petstore-next`, `auth-api`)               |
| Provider       | Vitest `v8` via `@vitest/coverage-v8` (matches Vitest 4.1.x from Vite+)     |
| Thresholds     | 90% statements, branches, functions, lines                                  |
| Coverage raise | **Not in this change** — gate may fail until follow-up tests                |
| Config shape   | Shared root `coverage.config.ts` imported by each in-scope `vite.config.ts` |

## Architecture

1. Catalog + root `devDependency`: `@vitest/coverage-v8`.
2. Shared `hexkitCoverage` options (include `src/**`, exclude tests/dist, reporters text + text-summary, thresholds 90).
3. Each in-scope package adds `test.coverage` and a `coverage` script (`vp test run --coverage`, preserving `--passWithNoTests` where used).
4. Root `coverage` script (`scripts/run-generator-coverage.sh`) runs each in-scope package’s `coverage` script; `ready` chains coverage after the existing test stage. (Vite+ `vp run -r --filter` cannot be combined; the shell runner scopes to `packages/*` + `apps/cli` only.)

## Baseline (pre-gate, 2026-08-21)

Weighted aggregate for generator packages: ~90.6% statements, ~79.8% branches, ~96.7% functions, ~91.4% lines. Packages below 90% on at least one metric: `codegen`, `plugin-apical`, `plugin-architecture-hexagonal`, `plugin-drizzle`, `plugin-next`, `cli`. Passing today: `core`, `plugin-api`, `plugin-hono` (`plugin-sst` has no instrumented statements).

## Non-goals

- Writing new unit tests to meet 90%
- Coverage for dogfood / Compose acceptance suites
- GitHub Actions CI (still deferred per PRD)
