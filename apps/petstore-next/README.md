# Hexkit PetShop Next.js fixture

This is the vanilla create-next-app-shaped PetShop dogfood app for Hexkit's Next.js Route Handler
target. The fixture owns the human UI under `/`, `/pets/**`, and `/orders/**`; generated OpenAPI
Route Handlers own contract paths such as `/pet` and `/store/order`.

## Development

Install from the repository root with Vite+ so the monorepo lockfile stays authoritative:

```bash
source ~/.vite-plus/env
vp install
```

Run the app with the stock Next.js script:

```bash
cd apps/petstore-next
pnpm next dev
```

The `@/*` TypeScript alias points at `./src/*` because Hexkit generated code lives under `src/`.
The App Router UI stays in the package-root `app/` directory.

## Generated source placeholder

Task 5 includes a small in-memory `src/adapters/http-next/server-access.ts` placeholder so this app
can install, lint, and start before the generator dogfood exists. The placeholder is intentionally
fixture-local and should be overwritten by Task 6.

## Dogfood generation input

Reuse the existing Petstore OpenAPI document:

```text
../petstore-sample/openapi.poc.yaml
```

## Generate-to-TMP merge algorithm

1. Generate into a temporary directory, never directly over this fixture:

   ```bash
   hexkit generate apps/petstore-sample/openapi.poc.yaml "$TMPDIR/petstore-next" \
     --http next --next-surface routes
   ```

2. Copy these generated files from the temp directory into `apps/petstore-next/`:
   - `src/**`
   - `app/**/route.ts` files and their parent directories for OpenAPI handlers
   - Any non-UI packaging snippets documented by the generator
3. Do not copy generated `app/layout.tsx`, `app/page.tsx`, or non-`route.ts` files under `app/`.
   The fixture keeps ownership of `/`, `/pets/**`, and `/orders/**`.
4. Confirm `tsconfig.json` still maps `@/*` to `./src/*`.
5. From the repository root, run `vp install`.
6. Start the app with `cd apps/petstore-next && pnpm next dev`.

Do not add a PetShop-specific Vitest, Pactum, or Playwright suite here. Plugin and CLI tests cover
the generator; this fixture is validated by install/generate/start smoke checks.
