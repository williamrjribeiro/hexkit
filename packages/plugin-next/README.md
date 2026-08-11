# `@hexkit/plugin-next`

Next.js App Router adapter generator for Hexkit. It produces Route Handlers,
RSC pages, server-access wiring, and integration with Apical-generated
operations **discovered from the input contract**.

This plugin exposes the generated application through Next.js while keeping the
framework outside the application core. It is **domain-agnostic** (PRD §5.0):
it must not hardcode sample operationIds or fixture paths. Dogfood and Library
fixtures may drive tests, not the generator implementation.

**OpenAPI → Route Handlers** at literal contract paths. Server Actions are not
part of the OpenAPI HTTP surface; PetShop form posts live in
`apps/petstore-next` only.

## CLI

Hono remains the default HTTP adapter. Select Next via the Hexkit CLI:

```bash
hexkit generate <openapi> <out> --http next [--next-surface both|routes|rsc]
```

- `--http next` — swap `plugin-hono` for `plugin-next`
- `--next-surface` — valid only with `--http next`; default `both`

## Surface options

- `routes` — emit `app/**/route.ts` at literal OpenAPI paths (no `/api` prefix)
- `rsc` — emit RSC `page.tsx` at literal OpenAPI paths
- `both` — Route Handlers at contract paths; RSC pages under `app/ui/...` to
  avoid colliding with handlers on the same segment

## Dogfood

The vanilla PetShop Next.js fixture (`apps/petstore-next`) merges generated
`src/**` and `app/**/route.ts` onto a create-next-app-shaped shell. See
`docs/superpowers/specs/2026-08-11-nextjs-route-handlers-design.md`.
