# Hexkit documentation

- [RFC](../RFC.md) — architectural design and long-term scope
- [PRD](../PRD.md) — PoC product requirements and acceptance criteria (includes the plugin domain-agnostic invariant in §5.0)
- [README](../README.md) — workspace overview and **project status** tracker
- [Pet Store OpenAPI progress](./petstore-openapi-progress.md) — Hono & Next.js feature tracker toward the **full** Petstore OpenAPI (`missing` / `in progress` / `partial` / `shipped`; keep current)

## Specs & plans

Implementation plans below are **delivered on `main`** unless noted. Checkbox
lists remain for historical traceability.

| Document                                                                                                     | Status                                                                                |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| [Hexkit PoC plan](./superpowers/plans/2026-08-03-hexkit-poc.md)                                              | Substantially complete — dogfood green is the remaining gate                          |
| [Next.js Route Handlers + RSC design](./superpowers/specs/2026-08-11-nextjs-route-handlers-design.md)        | Delivered                                                                             |
| [Next.js Route Handlers + RSC plan](./superpowers/plans/2026-08-11-nextjs-route-handlers.md)                 | Delivered (#9)                                                                        |
| [PetShop Next Docker dogfood plan](./superpowers/plans/2026-08-13-petstore-next-docker-dogfood.md)           | Delivered                                                                             |
| [OpenAPI auth design](./superpowers/specs/2026-08-05-openapi-auth-design.md)                                 | Design reference — generator auth; Petstore `getPetById` apiKey is a follow-up spec   |
| [OpenAPI auth implementation plan](./superpowers/plans/2026-08-05-openapi-auth.md)                           | Partial — generator support + auth fixture; Petstore header apiKey not yet on dogfood |
| [Petstore header apiKey design](./superpowers/specs/2026-08-21-petstore-header-apikey-design.md)             | Design — apply `api_key` to Hono Petstore `getPetById` dogfood                        |
| [Petstore header apiKey plan](./superpowers/plans/2026-08-21-petstore-header-apikey.md)                      | Implementation plan — Hono dogfood + Next RSC wrap                                    |
| [Auth API dogfood plan](./superpowers/plans/2026-08-07-auth-api-dogfood.md)                                  | Delivered (#7)                                                                        |
| [Rich Pet nested persistence plan](./superpowers/plans/2026-08-20-rich-pet-nested-persistence.md)            | Phase 1 delivered (JSONB default); Phase 2 relational opt-in later                    |
| [Test coverage quality gate design](./superpowers/specs/2026-08-21-test-coverage-quality-gate-design.md)     | Delivered — 90% gate green for generator packages                                     |
| [Grokking Simplicity refactor design](./superpowers/specs/2026-08-21-grokking-simplicity-refactor-design.md) | In progress — TDD refactor after coverage raise                                       |
| [Grokking Simplicity refactor plan](./superpowers/plans/2026-08-21-grokking-simplicity-refactor.md)          | In progress — per-package stratification                                              |

### Specs & plans (detail)

- [OpenAPI auth design](./superpowers/specs/2026-08-05-openapi-auth-design.md) — how Apical models security and how Hexkit should integrate auth hexagonally
- [OpenAPI auth implementation plan](./superpowers/plans/2026-08-05-openapi-auth.md) — phased tasks to implement that design
- [Petstore header apiKey design](./superpowers/specs/2026-08-21-petstore-header-apikey-design.md) — apply Petstore `api_key` header to Hono `getPetById` dogfood; Next RSC stays header-free
- [Auth API dogfood plan](./superpowers/plans/2026-08-07-auth-api-dogfood.md) — Compose + Pactum acceptance for the auth fixture
- [Hexkit PoC plan](./superpowers/plans/2026-08-03-hexkit-poc.md) — PoC delivery plan (auth explicitly deferred)
- [Next.js Route Handlers + RSC design](./superpowers/specs/2026-08-11-nextjs-route-handlers-design.md) — opt-in `@hexkit/plugin-next` (domain-agnostic, PRD §5.0); Hono default, `--http next`, `--next-surface both|routes|rsc`; OpenAPI → Route Handlers; vanilla PetShop dogfood (`apps/petstore-next`, `vp`/pnpm, no app tests)
- [Next.js Route Handlers + RSC plan](./superpowers/plans/2026-08-11-nextjs-route-handlers.md) — phased tasks for `@hexkit/plugin-next` and `apps/petstore-next`
- [PetShop Next Docker dogfood plan](./superpowers/plans/2026-08-13-petstore-next-docker-dogfood.md) — `docker compose up --build` for Next + Postgres, matching Hono dogfood
- [Rich Pet nested persistence plan](./superpowers/plans/2026-08-20-rich-pet-nested-persistence.md) — Phase 1: nested object/array/`$ref` → JSONB by default (delivered); later `x-hexkit` opt-in for relational tables/FKs
- [Test coverage quality gate design](./superpowers/specs/2026-08-21-test-coverage-quality-gate-design.md) — Vitest v8 coverage for generator packages; 90% thresholds; dogfood excluded
- [Grokking Simplicity refactor design](./superpowers/specs/2026-08-21-grokking-simplicity-refactor-design.md) — extract calculations from generator orchestrators after the 90% coverage raise
- [Grokking Simplicity refactor plan](./superpowers/plans/2026-08-21-grokking-simplicity-refactor.md) — Wave 0 codegen utils, then parallel per-package splits
