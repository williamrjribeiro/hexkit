# Hexkit documentation

- [RFC](../RFC.md) — architectural design and long-term scope
- [PRD](../PRD.md) — PoC product requirements and acceptance criteria (includes the plugin domain-agnostic invariant in §5.0)
- [README](../README.md) — workspace overview and **project status** tracker
- [`@hexkit/shared`](../packages/shared/README.md) — shared generator calculations and `@hexkit/shared/testing` (not a pipeline plugin)
- [Pet Store OpenAPI progress](./petstore-openapi-progress.md) — Hono & Next.js feature tracker toward the **full** Petstore OpenAPI (`missing` / `in progress` / `partial` / `shipped`; keep current)
- [Upstream issue drafts](./upstream-issues/) — ready-to-post Cursor / Vite+ bug reports (e.g. Cloud Agent git hooks chaining)

## Specs & plans

Implementation plans below are **delivered on `main`** unless noted. Checkbox
lists remain for historical traceability.

| Document                                                                                                     | Status                                                                         |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| [Hexkit PoC plan](./superpowers/plans/2026-08-03-hexkit-poc.md)                                              | Delivered — PoC complete (2026-08-22)                                          |
| [Next.js Route Handlers + RSC design](./superpowers/specs/2026-08-11-nextjs-route-handlers-design.md)        | Delivered                                                                      |
| [Next.js Route Handlers + RSC plan](./superpowers/plans/2026-08-11-nextjs-route-handlers.md)                 | Delivered (#9)                                                                 |
| [PetShop Next Docker dogfood plan](./superpowers/plans/2026-08-13-petstore-next-docker-dogfood.md)           | Delivered                                                                      |
| [OpenAPI auth design](./superpowers/specs/2026-08-05-openapi-auth-design.md)                                 | Delivered — generator auth + Petstore Hono `getPetById` header `api_key` (#21) |
| [OpenAPI auth implementation plan](./superpowers/plans/2026-08-05-openapi-auth.md)                           | Delivered — generator + auth fixture; Petstore header apiKey on dogfood (#21)  |
| [Petstore header apiKey design](./superpowers/specs/2026-08-21-petstore-header-apikey-design.md)             | Delivered (#21) — Hono `getPetById` `api_key`; Next RSC stays header-free      |
| [Petstore header apiKey plan](./superpowers/plans/2026-08-21-petstore-header-apikey.md)                      | Delivered (#21)                                                                |
| [Auth API dogfood plan](./superpowers/plans/2026-08-07-auth-api-dogfood.md)                                  | Delivered (#7)                                                                 |
| [Rich Pet nested persistence plan](./superpowers/plans/2026-08-20-rich-pet-nested-persistence.md)            | Phase 1 delivered (JSONB default); Phase 2 relational opt-in later             |
| [Test coverage quality gate design](./superpowers/specs/2026-08-21-test-coverage-quality-gate-design.md)     | Delivered — 90% gate green for generator packages                              |
| [Grokking Simplicity refactor design](./superpowers/specs/2026-08-21-grokking-simplicity-refactor-design.md) | Delivered (#19) — TDD stratification per generator package                     |
| [Grokking Simplicity refactor plan](./superpowers/plans/2026-08-21-grokking-simplicity-refactor.md)          | Delivered (#19)                                                                |
| [Petstore query list ops design](./superpowers/specs/2026-08-28-petstore-query-list-operations-design.md)    | Draft — `findPetsByStatus` / `findPetsByTags` (JSON, query params)             |
| [Petstore query list ops plan](./superpowers/plans/2026-08-28-petstore-query-list-operations.md)             | Draft — pending review                                                         |

### Specs & plans (detail)

- [OpenAPI auth design](./superpowers/specs/2026-08-05-openapi-auth-design.md) — how Apical models security and how Hexkit should integrate auth hexagonally
- [OpenAPI auth implementation plan](./superpowers/plans/2026-08-05-openapi-auth.md) — phased tasks to implement that design
- [Petstore header apiKey design](./superpowers/specs/2026-08-21-petstore-header-apikey-design.md) — Petstore `api_key` header on Hono `getPetById` dogfood; Next RSC stays header-free (delivered #21)
- [Auth API dogfood plan](./superpowers/plans/2026-08-07-auth-api-dogfood.md) — Compose + Pactum acceptance for the auth fixture
- [Hexkit PoC plan](./superpowers/plans/2026-08-03-hexkit-poc.md) — PoC delivery plan (original slice auth-free; `getPetById` header `api_key` added later)
- [Next.js Route Handlers + RSC design](./superpowers/specs/2026-08-11-nextjs-route-handlers-design.md) — opt-in `@hexkit/plugin-next` (domain-agnostic, PRD §5.0); Hono default, `--http next`, `--next-surface both|routes|rsc`; OpenAPI → Route Handlers; vanilla PetShop dogfood (`apps/petstore-next`, `vp`/pnpm, no app tests)
- [Next.js Route Handlers + RSC plan](./superpowers/plans/2026-08-11-nextjs-route-handlers.md) — phased tasks for `@hexkit/plugin-next` and `apps/petstore-next`
- [PetShop Next Docker dogfood plan](./superpowers/plans/2026-08-13-petstore-next-docker-dogfood.md) — `docker compose up --build` for Next + Postgres, matching Hono dogfood
- [Rich Pet nested persistence plan](./superpowers/plans/2026-08-20-rich-pet-nested-persistence.md) — Phase 1: nested object/array/`$ref` → JSONB by default (delivered); later `x-hexkit` opt-in for relational tables/FKs
- [Test coverage quality gate design](./superpowers/specs/2026-08-21-test-coverage-quality-gate-design.md) — Vitest v8 coverage for generator packages; 90% thresholds; dogfood excluded
- [Grokking Simplicity refactor design](./superpowers/specs/2026-08-21-grokking-simplicity-refactor-design.md) — extract calculations from generator orchestrators after the 90% coverage raise
- [Grokking Simplicity refactor plan](./superpowers/plans/2026-08-21-grokking-simplicity-refactor.md) — Wave 0 codegen utils, then parallel per-package splits
- [Petstore query list ops design](./superpowers/specs/2026-08-28-petstore-query-list-operations-design.md) — query-parameter list endpoints; hexagonal + shared + Drizzle filtered `list`; JSON-first partial tracker bar
- [Petstore query list ops plan](./superpowers/plans/2026-08-28-petstore-query-list-operations.md) — phased TDD tasks for `findPetsByStatus` and `findPetsByTags`
