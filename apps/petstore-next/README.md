# Hexkit PetShop Next.js fixture

Vanilla create-next-app-shaped PetShop dogfood app for Hexkit's opt-in Next.js
adapter (`--http next`). Install from the repository root with **`vp` / pnpm** so
the monorepo lockfile stays authoritative. Styling uses Tailwind; individual
pages may use optional CSS Modules.

The fixture owns the human UI under `/`, `/pets/**`, and `/orders/**`. Generated
OpenAPI Route Handlers own contract paths such as `/pet` and `/store/order`.

**Data flow:** no client-side data fetching. RSC pages read via generated
server-access (DAL in-process). Writes use plain HTML forms wired to Server
Actions. Server Actions are not the OpenAPI HTTP surface.

**No PetShop test suite** — do not add Vitest, Pactum, or Playwright here.
`@hexkit/plugin-next` and CLI tests cover the generator; validate this fixture
with install/generate/start smoke checks.

## Development

```bash
source ~/.vite-plus/env
vp install
cd apps/petstore-next
pnpm next dev
```

The `@/*` TypeScript alias points at `./src/*` because Hexkit generated code
lives under `src/`. The App Router UI stays in the package-root `app/` directory.

## Dogfood generation

From the repository root:

```bash
vp run dogfood-petstore-next
```

Input contract: `../petstore-sample/openapi.poc.yaml`.

### Generate-to-TMP merge algorithm

1. Generate into a temporary directory, never directly over this fixture:

   ```bash
   hexkit generate apps/petstore-sample/openapi.poc.yaml "$TMPDIR/petstore-next" \
     --http next --next-surface routes
   ```

2. Copy these generated files from the temp directory into `apps/petstore-next/`:
   - `src/**`
   - `app/**/route.ts` files and their parent directories for OpenAPI handlers
   - Any non-UI packaging snippets documented by the generator
3. Do not copy generated `app/layout.tsx`, `app/page.tsx`, or non-`route.ts`
   files under `app/`. The fixture keeps ownership of `/`, `/pets/**`, and
   `/orders/**`.
4. Confirm `tsconfig.json` still maps `@/*` to `./src/*`.
5. From the repository root, run `vp install`.
6. Start the app with `cd apps/petstore-next && pnpm next dev`.
