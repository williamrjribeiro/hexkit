# Hexkit PetShop Next.js fixture

Vanilla create-next-app-shaped PetShop dogfood app for Hexkit's opt-in Next.js
adapter (`--http next`). Install from the repository root with **`vp` / pnpm** so
the monorepo lockfile stays authoritative. Styling uses Tailwind; individual
pages may use optional CSS Modules.

The fixture owns the human UI under `/`, `/pets/**`, and `/orders/**`. Generated
OpenAPI Route Handlers own contract paths such as `/pet` and `/store/order`.
Pet create/edit forms send the contract-required `photoUrls` list (one URL per
line). Optional nested `category` and `tags` are not collected by those forms;
the generated API still accepts them as JSON.

**Data flow:** no client-side data fetching. RSC pages read via generated
server-access (DAL in-process). The `/pets` catalog uses `findPetsByStatus` and
`findPetsByTags` from server-access for filtered lists (status dropdown and tag
checkboxes in a GET form). Writes use plain HTML forms wired to Server
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

From the repository root, preferred local entry (stable `/tmp` so `:down`
works):

```bash
HEXKIT_KEEP_STACK=1 vp run dogfood:petstore:nextjs
# open http://127.0.0.1:3000
vp run dogfood:petstore:nextjs:down
```

`dogfood:petstore:nextjs` generates into `/tmp/hexkit-dogfood-petstore-next` by
default. The Compose file and Dockerfile are **generated packaging** (same as
`hexkit generate --http next`), not committed under this fixture — dogfood
builds the overlaid generated tree so packaging stays the source of truth.
`HEXKIT_KEEP_STACK` is still honored (default `0` tears down on exit). Override
the directory with `HEXKIT_DOGFOOD_OUTPUT` if needed.

CI still uses the legacy task name with `HEXKIT_SKIP_COMPOSE=1`:

```bash
HEXKIT_SKIP_COMPOSE=1 vp run dogfood-petstore-next
```

Local full dogfood (legacy name, random `/tmp` unless you set
`HEXKIT_DOGFOOD_OUTPUT`):

```bash
vp run dogfood-petstore-next
```

That follows the Hono Petstore pattern: generate into a temp tree, overlay this
fixture's UI, then (locally) `docker compose up --build` using the **generated**
`Dockerfile` + `docker-compose.yml` (Next.js app + Postgres). After generate,
dogfood runs `eslint-config-next` (Core Web Vitals + TypeScript +
`@next/next/no-html-link-for-pages`) **and** `next build` on the generated tree
(so RSC pages under `app/ui/**` are type-checked even though they are not copied
onto this fixture). It then overlays, merges, and repeats lint/`next build` on
this PetShop fixture. CI **Dogfood NextJS** sets `HEXKIT_SKIP_COMPOSE=1` so the
job stops after those host checks (no app tests). Locally, omit that env (or set
`HEXKIT_SKIP_COMPOSE=0`) to also bring up Compose. `HEXKIT_KEEP_STACK=1` leaves
the Compose stack running.

Input contract: `../petstore-sample/openapi.poc.yaml` (Rich Pet + Order + User JSON; nested
Pet fields persist as JSONB).

CLI default `--next-surface` is `both`; this fixture dogfood generate uses
`--next-surface both` so eslint-config-next can validate generated Route
Handlers and RSC scaffolds before overlay replaces fixture-owned UI. Overlay
still owns `/`, `/pets/**`, and `/orders/**`; only `src/**` and `app/**/route.ts`
are copied back onto this fixture.

### Generate-to-TMP merge algorithm

1. Generate into a temporary directory, never directly over this fixture:

   ```bash
   hexkit generate apps/petstore-sample/openapi.poc.yaml "$TMPDIR/petstore-next" \
     --http next --next-surface both
   ```

2. Overlay fixture-owned UI onto the temp tree (`scripts/overlay-fixture.sh`):
   `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `app/pets/**`,
   `app/orders/**`, `postcss.config.mjs`, plus Tailwind `devDependencies`.
   Generated `app/**/route.ts` files stay.
3. Copy these generated files from the temp directory into `apps/petstore-next/`:
   - `src/**`
   - `app/**/route.ts` files and their parent directories for OpenAPI handlers
4. Do not copy generated `app/layout.tsx`, `app/page.tsx`, or non-`route.ts`
   files under `app/` back onto the fixture. The fixture keeps ownership of `/`,
   `/pets/**`, and `/orders/**`.
5. Confirm `tsconfig.json` still maps `@/*` to `./src/*`.
6. From the repository root, run `vp install`, then lint and build this fixture
   with `vp run petstore-next#lint` and `vp run petstore-next#build`.
   Dogfood also lints **and** `next build`s the generated temp tree with the same
   `eslint-config-next` / Next.js toolchain before overlay. ESLint does not
   type-check; the generated `next build` is what catches RSC TypeScript errors
   that the fixture build never sees.
7. `docker compose -f "$TMP/docker-compose.yml" up --build -d --wait`, then
   smoke `GET /`, `GET /pets`, and `POST /pet` (body includes required
   `photoUrls`, which may be an empty list).
8. For local iteration without Compose: `cd apps/petstore-next && pnpm next dev`.
