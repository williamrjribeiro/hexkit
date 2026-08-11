# Hexkit documentation

- [RFC](../RFC.md) — architectural design and long-term scope
- [PRD](../PRD.md) — PoC product requirements and acceptance criteria (includes the plugin domain-agnostic invariant in §5.0)

## Specs & plans

- [OpenAPI auth design](./superpowers/specs/2026-08-05-openapi-auth-design.md) — how Apical models security and how Hexkit should integrate auth hexagonally
- [OpenAPI auth implementation plan](./superpowers/plans/2026-08-05-openapi-auth.md) — phased tasks to implement that design
- [Auth API dogfood plan](./superpowers/plans/2026-08-07-auth-api-dogfood.md) — Compose + Pactum acceptance for the auth fixture
- [Hexkit PoC plan](./superpowers/plans/2026-08-03-hexkit-poc.md) — PoC delivery plan (auth explicitly deferred)
- [Next.js Route Handlers + RSC design](./superpowers/specs/2026-08-11-nextjs-route-handlers-design.md) — opt-in domain-agnostic App Router adapter (`--next-surface both|routes|rsc`) plus PetShop Next dogfood (PostCSS/Tailwind/CSS Modules; no client fetch)
- [Next.js Route Handlers + RSC plan](./superpowers/plans/2026-08-11-nextjs-route-handlers.md) — phased tasks for `@hexkit/plugin-next` and `apps/petstore-next`
