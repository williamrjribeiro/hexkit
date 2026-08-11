# `@hexkit/plugin-next`

Next.js App Router adapter generator for Hexkit. It produces Route Handlers,
RSC pages, server-access wiring, and integration with Apical-generated
operations **discovered from the input contract**.

This plugin exposes the generated application through Next.js while keeping the
framework outside the application core. It must not hardcode sample operationIds
or fixture paths; dogfood and Library fixtures may drive tests, not the
generator implementation (see PRD §5.0).

## Surface options

- `routes` — emit `app/**/route.ts` at literal OpenAPI paths (no `/api` prefix)
- `rsc` — emit RSC `page.tsx` at literal OpenAPI paths
- `both` — Route Handlers at contract paths; RSC pages under `app/ui/...` to
  avoid colliding with handlers on the same segment
