# Design: Next.js App Router Route Handlers + RSC in Hexkit

**Status:** Draft  
**Date:** 2026-08-11  
**Companion:** [RFC.md](../../../RFC.md), [PRD.md](../../../PRD.md)  
**Implementation plan:** [2026-08-11-nextjs-route-handlers.md](../plans/2026-08-11-nextjs-route-handlers.md)  
**Docs reviewed:** Next.js **16.3.0** via [`/docs/llms.txt`](https://nextjs.org/docs/llms.txt) — Route Handlers, `route.js`, Backend for Frontend, Fetching Data, Mutating Data, Data Security.

## 1. Problem

Hexkit currently generates a **Hono** HTTP adapter as the only driving adapter. Next.js is the dominant React full-stack framework; teams often want OpenAPI-backed APIs colocated with an App Router UI that uses **React Server Components (RSC)**.

RFC/PRD today treat **multiple web frameworks as a non-goal** for the initial release and fix the stack on Hono + (deferred) SST/Lambda. Adding Next.js is therefore an **explicit product amendment**, not a silent PoC stretch.

We need a contract-first path that:

- Maps OpenAPI operations to idiomatic Next.js **Route Handlers**.
- Generates **basic RSC pages** that call hexagonal use cases **in-process** (DAL pattern).
- Keeps Hexagonal Architecture (domain/use cases/ports free of Next.js).
- Keeps `@hexkit/plugin-next` **domain-agnostic** (PRD §5.0) — same invariant as other plugins.
- Reuses Apical Zod validation and existing auth IR (`Principal` / `Authenticator`).
- Does **not** break the Hono Petstore / auth-api dogfood defaults.

## 2. What Next.js 16 says (findings)

### 2.1 Route Handlers are the public HTTP API surface

From [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) and [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route):

- Defined as `app/**/route.ts` exporting `GET` | `POST` | `PUT` | `PATCH` | `DELETE` | `HEAD` | `OPTIONS`.
- Use Web `Request` / `Response`, optionally `NextRequest` / `NextResponse`.
- Dynamic path params arrive as **`await ctx.params`** (Promise).
- **Cannot coexist with `page.js` on the same route segment.**
- App Router Route Handlers replace Pages Router “API Routes”; Hexkit must **not** generate `pages/api`.

### 2.2 Backend-for-Frontend guidance

From [Backend for Frontend](https://nextjs.org/docs/app/guides/backend-for-frontend):

- Route Handlers are **public** endpoints for any HTTP client.
- Validate inputs before side effects; avoid leaking internals in 500 bodies.
- Next.js backend features are an API layer, not a claim that UI + API must share one process forever — but they are the correct Next-native place for OpenAPI REST.

### 2.3 Data fetching vs public REST (critical distinction)

From [Fetching Data](https://nextjs.org/docs/app/getting-started/fetching-data) and [Data Security](https://nextjs.org/docs/app/guides/data-security):

| Concern                   | Next.js recommendation                                                  | Hexkit implication                                                                                                  |
| ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Server Component reads    | Prefer **DAL / ORM / in-process** calls; avoid self-HTTP where possible | Generated RSC pages import **use cases** via a server-access composition module — **not** `fetch` to Route Handlers |
| Public / external clients | HTTP APIs (REST)                                                        | Generate Route Handlers that honor the OpenAPI contract                                                             |
| Mutations from React UI   | Server Actions (`"use server"`, POST-oriented, FormData-friendly)       | **Out of v1** for OpenAPI fidelity (pages are read-oriented scaffolds)                                              |
| Authz                     | Check auth inside every public entry (Route Handler / Server Function)  | Reuse hexagonal `Authenticator` + Apical header presence                                                            |

**Conclusion:** Hexkit’s OpenAPI → HTTP mapping belongs on **Route Handlers**. RSC support belongs on **in-process use-case calls**. Server Actions are a parallel React mutation API and must not be treated as the OpenAPI surface.

### 2.4 Caching

Route Handlers are **dynamic by default**. Caching `GET` (`force-static` / `use cache` helpers) is opt-in and unsafe as a default for DB-backed authenticated APIs. Hexkit v1 emits **request-time** handlers and pages (no static cache export).

### 2.5 `page` vs `route` conflict

Because `page` and `route` cannot share a segment, Hexkit must avoid colocating them. Path placement depends on the plugin **surface** option (see §6.0):

| Surface          | Route Handlers        | RSC pages                                    |
| ---------------- | --------------------- | -------------------------------------------- |
| `both` (default) | Literal OpenAPI paths | Under `/ui/...` (no collision)               |
| `routes`         | Literal OpenAPI paths | Not emitted                                  |
| `rsc`            | Not emitted           | Literal OpenAPI paths (safe — no `route.ts`) |

## 3. Plugin domain-agnostic invariant (normative)

**`@hexkit/plugin-next` must obey PRD §5.0 exactly like `@hexkit/plugin-hono` / drizzle / hexagonal.**

Sample domains (Petstore, library, auth-api) are **fixtures only**. They must not be hardcoded into plugin production source.

| Layer                                      | May know Petstore / sample domain? | How domain knowledge enters                                                               |
| ------------------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------- |
| `apps/petstore-sample`, `apps/fixtures/**` | **Yes**                            | Authored OpenAPI + dogfood tests                                                          |
| `@hexkit/plugin-next`                      | **No**                             | Derives Route Handlers, RSC pages, DAL wiring from Apical contracts + hexagonal artifacts |
| CLI packaging for Next                     | **No**                             | Generic Next + Postgres packaging from generation context                                 |

**Rules:**

1. Generators consume OpenAPI/Apical/application artifacts in context; they do not embed sample schemas, operationIds, paths, or entity names in plugin source.
2. Plugin tests **may** use Petstore/library OpenAPI as **input fixtures** and snapshot outputs. Tests must not pass only because the plugin embeds those fixtures.
3. Changing a fixture OpenAPI (add/rename path or operation) must change generated `route.ts` / `page.tsx` **without** editing `plugin-next` for that domain.
4. `apps/cli` domain-agnostic scanner must include `packages/plugin-next/src` production sources.
5. A Next dogfood that greens only via hardcoded Pet/Order (or any sample) generators is **incomplete**.

## 4. Goals / non-goals

### Goals (v1)

1. Add `@hexkit/plugin-next` that can emit App Router **Route Handlers**, **basic RSC pages**, or **both**, selected by a plugin/CLI surface option.
2. Keep Hono as the **default** HTTP adapter; Next.js is **opt-in** via CLI / plugin set.
3. Keep `plugin-next` **domain-agnostic** (§3 / PRD §5.0).
4. Map auth the same way as Hono for Route Handlers: Apical wire validation → 401 → `Authenticator` → `Principal`.
5. RSC pages call a generated **server-access / DAL** module (composed use cases) in-process — never self-HTTP.
6. Ship a **vanilla PetShop Next.js dogfood app** under `apps/` (fixture-owned), bootstrapped like [create-next-app](https://nextjs.org/docs/app/getting-started/installation) (TypeScript, App Router, Tailwind), using **Vite+ (`vp`) / pnpm** for installs — **no client-side data fetching**, **no PetShop app test suite**.
7. Dogfood **PetShop** with `--next-surface routes` + fixture overlay (see §6.7); use `both` in plugin/CLI tests for generic `/ui` scaffolds. Unit/integration tests cover `plugin-next` surfaces only (not the PetShop UI app).
8. Document Route Handlers (public REST) vs RSC DAL (same-app UI), surface switch, and PetShop dogfood rules.

### Non-goals (v1)

- Replacing Hono as the default / PoC dogfood target.
- Pages Router `pages/api/*`.
- Polished design systems beyond vanilla create-next-app + light CSS Modules.
- Client-side data fetching (SWR, TanStack Query, `useEffect`+`fetch`, etc.) in generated or PetShop UI.
- Baking PetShop/Tailwind/CSS Module UI into `@hexkit/plugin-next` (plugin stays domain-agnostic and UI-minimal).
- **Automated tests for `apps/petstore-next`** (no Vitest/Pactum/UI suite for the shop app).
- Generating Server Actions **as the OpenAPI surface** (OpenAPI remains Route Handlers; PetShop forms may use Server Actions only as a UI→use-case bridge).
- Generating Cache Components / ISR / `use cache` policies for API routes.
- Mounting the Hono app inside a Next catch-all as the primary design.
- Vercel-specific adapters, Edge runtime, or SST/Next dual deploy.
- XML / non-JSON media types (same as PoC).

## 5. Approaches considered

### Approach A — Native Route Handlers + RSC pages (recommended)

`plugin-next` emits a configurable subset:

1. **Routes surface:** one `route.ts` per OpenAPI path (method-coalesced) at literal contract URLs + HTTP helpers/runtime.
2. **RSC surface:** **server-access** DAL + basic `page.tsx` Server Components (path rules in §6.0) + minimal layout/index.
3. **Both (default):** routes at contract paths; RSC under `/ui/...`.

| Pros                                            | Cons                                            |
| ----------------------------------------------- | ----------------------------------------------- |
| Matches Next.js Route Handler + DAL guidance    | Duplicates some HTTP adapter logic vs Hono      |
| RSC from day one with opt-out of either surface | `both` needs `/ui` prefix to avoid collisions   |
| Domain-agnostic derivation from contracts       | CLI target + surface selection / packaging fork |

### Approach B — Catch-all Hono inside Next

Emit `app/api/[[...route]]/route.ts` that delegates to Hono.

| Pros                       | Cons                                                        |
| -------------------------- | ----------------------------------------------------------- |
| Minimal new HTTP generator | Not idiomatic Route Handlers; still need separate RSC story |
|                            | Couples Next to Hono                                        |

### Approach C — Server Actions as the API

Emit `"use server"` functions per operation.

| Pros                    | Cons                             |
| ----------------------- | -------------------------------- |
| Popular for React forms | POST-only; poor OpenAPI fidelity |
|                         | Wrong public REST surface        |

**Decision:** **Approach A** for v1.

## 6. Architecture

```
OpenAPI
  → plugin-apical          (contracts + Zod + security IR)
  → plugin-architecture-hexagonal  (domain, ports, use cases, Principal)
  → plugin-next  ∥  plugin-drizzle   (Next replaces plugin-hono when selected)
  → packaging (Next-aware Compose / scripts)
```

Business logic remains independent of Next.js, Hono, Drizzle, and deploy tooling.

### 6.0 Surface option (normative)

```ts
export type NextSurface = "routes" | "rsc" | "both";

export type NextPluginOptions = {
  /** @default "both" */
  surface?: NextSurface;
};

export function createNextPlugin(options?: NextPluginOptions): HexkitPlugin;
```

CLI (when `--http next`):

```text
hexkit generate <openapi> <out> --http next [--next-surface both|routes|rsc]
```

Default: `--next-surface both`.

| `surface` | Emits                                                                                                                                      | Does not emit                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| `both`    | `route.ts` at OpenAPI paths; RSC under `app/ui/...`; server-access; HTTP helpers/runtime; layout/index                                     | —                                                               |
| `routes`  | `route.ts`; HTTP helpers/controllers/runtime; **server-access (DAL)**; auth stub if needed; minimal `app/layout.tsx` + stub `app/page.tsx` | `app/ui/**` GET UI scaffolds                                    |
| `rsc`     | server-access; RSC `page.tsx` at **literal OpenAPI paths**; layout/index                                                                   | `route.ts`, HTTP controller/route helpers used only by handlers |

**Path rules by surface:**

| Surface  | Handler file for `/pet/{petId}` | RSC page file for GET `/pet/{petId}` |
| -------- | ------------------------------- | ------------------------------------ |
| `both`   | `app/pet/[petId]/route.ts`      | `app/ui/pet/[petId]/page.tsx`        |
| `routes` | `app/pet/[petId]/route.ts`      | _(none)_                             |
| `rsc`    | _(none)_                        | `app/pet/[petId]/page.tsx`           |

Invalid: empty surface / unknown token → CLI non-zero exit with clear message.

### 6.1 Generated layout (Next target, `both`)

```
src/
├── generated/contracts/     # Apical (unchanged)
├── core/                    # hexagonal (unchanged; protected use cases)
├── adapters/
│   ├── db/                  # Drizzle (unchanged)
│   ├── auth/                # authenticator stub when security present
│   └── http-next/           # helpers, controllers, runtime, server-access
app/
├── layout.tsx               # minimal root layout (generated)
├── page.tsx                 # index linking to UI pages (generated)
├── pet/route.ts             # OpenAPI path Route Handlers (example)
├── pet/[petId]/route.ts
└── ui/                      # RSC sample UI (no collision with route.ts)
    ├── page.tsx             # UI hub
    ├── pet/page.tsx         # list/read scaffold when GET /pet exists
    └── pet/[petId]/page.tsx # detail scaffold when GET /pet/{petId} exists
```

**URL mapping (`both`):**

| Kind           | OpenAPI / source | Generated URL / file                              |
| -------------- | ---------------- | ------------------------------------------------- |
| Route Handler  | `/pet/{petId}`   | `/pet/{petId}` → `app/pet/[petId]/route.ts`       |
| RSC page (GET) | same operation   | `/ui/pet/[petId]` → `app/ui/pet/[petId]/page.tsx` |
| UI index       | all GET ops      | `/` and `/ui` list links derived from operations  |

Multiple HTTP methods on one OpenAPI path share one `route.ts`.  
Under `both`, `page.tsx` for resources is emitted only under `app/ui/...`, never beside a `route.ts` on the same segment. Under `rsc`, pages use literal OpenAPI paths.

### 6.2 Handler shape (Route Handlers)

Each method:

1. Builds an Apical request from `NextRequest` + `await params` + optional JSON body.
2. Runs the Apical operation wrapper.
3. On secured ops: authenticate via `Authenticator`; map auth failures to **401**.
4. Invokes the protected use case (with `Principal` when secured).
5. Validates response with Apical response map; returns `Response.json(...)`.
6. Maps validation → **400**; unexpected → **500** without leaking stacks.

### 6.3 RSC pages + server-access (DAL)

**Always** generate `src/adapters/http-next/server-access.ts` for every Next surface (`routes`, `rsc`, and `both`). PetShop and other fixture UIs need the DAL even when generic `/ui` scaffolds are omitted.

`server-access.ts`:

- Lazily composes DB repos → use-case factories → (optional) authenticator the same way runtime does for HTTP.
- Exports a stable `getServerAccess()` returning named use-case functions keyed by `operationId` (or derived safe names from the contract).

**Resource RSC pages** (under `app/ui/...` for `both`, or literal OpenAPI paths for `rsc`) are emitted only when `surface` is `rsc` or `both`. Those pages:

- Are **async Server Components**.
- Call `getServerAccess()` and invoke the matching use case with path params from `await props.params` and query inputs from `await props.searchParams` when the operation declares them.
- Render a minimal, domain-agnostic presentation (e.g. title = `operationId` or path; body = pretty-printed JSON or simple key/value list). **No sample-domain copy in the generator.**
- For secured GET ops in v1: pages may call use cases **without** browser credential UI (document limitation); unsecured GET pages are the normative v1 UI slice. Authenticated demos prefer Route Handlers (`routes` / `both`).

Ownership:

- Generated pages / layout / index: ownership **`generated`** (overwrite) for v1 scaffolds.
- Protected use cases under `src/core/application/**` remain protected (unchanged hexagonal policy).

When `surface` is `routes`, **omit** resource UI scaffolds under `app/ui/**`, but **still emit** `server-access.ts`. Still emit a minimal root `app/layout.tsx` + stub `app/page.tsx` so a routes-only generated tree can `next build` — **except** when generating into a PetShop (or other fixture) overlay mode, where root `layout`/`page` emission is skipped so fixture UI is preserved (see §6.7).

### 6.4 Auth

Reuse contract security IR on `ContractArtifact`. Route Handlers read headers from `request.headers`. Do not invent cookie-session auth in v1 beyond existing header `apiKey` / HTTP bearer schemes.

### 6.5 Packaging & CLI

- Default pipeline stays Hono + current Compose packaging.
- CLI: `hexkit generate <openapi> <out> --http next [--next-surface both|routes|rsc]` swaps `plugin-hono` for `plugin-next` (with surface) and emits Next packaging.
- `--next-surface` is valid **only** with `--http next`; otherwise CLI errors.
- Petstore Hono PoC dogfood remains unchanged.
- **PetShop dogfood always uses `--next-surface routes`** plus the fixture overlay algorithm in §6.7 (not `both`).
- Generic fixture / plugin tests may use `both` or `rsc` without PetShop UI.

### 6.6 Runtime

v1 targets the **Node.js** Next runtime (needed for Drizzle). Edge runtime is out of scope.

### 6.7 PetShop Next.js dogfood app (normative)

Canonical Next dogfood lives in **`apps/petstore-next/`**. It is a **fixture app**, not plugin source.

**Vanilla Next.js first** — follow [Installation](https://nextjs.org/docs/app/getting-started/installation):

- Prefer scaffolding with explicit create-next-app flags (do not rely on machine-local `--yes` prefs), e.g.  
  `pnpm create next-app@latest petstore-next --ts --tailwind --eslint --app --no-src-dir --use-pnpm --import-alias "@/*"`, then adapt into the monorepo workspace.
- Package installs in this repo use **Vite+** (`vp install`) / **pnpm** — not a parallel npm/yarn toolchain.
- Keep the app structure close to create-next-app: `app/` at package root (**not** `src/app`), `public/`, `next.config.ts`, `package.json` scripts `dev` / `build` / `start` / `lint`.
- **Import alias:** Hexkit generated code lives under `src/`. Configure `tsconfig` so `@/*` maps to `./src/*` (adapters import as `@/adapters/http-next/server-access`). App Router files stay under top-level `app/` and use relative imports or a second alias if needed — do **not** assume create-next-app’s default `@/* → ./*` after merge.
- Avoid custom frameworks, UI kits, or test runners in this package.

**Ownership split (PRD §5.0):**

| Concern                                                                       | Owner                      |
| ----------------------------------------------------------------------------- | -------------------------- |
| OpenAPI (`openapi.poc.yaml` reuse), dogfood script, vanilla Next app shell    | `apps/petstore-next`       |
| Generated contracts, hexagonal core, Drizzle, Route Handlers, `server-access` | Hexkit CLI + `plugin-next` |
| PetShop pages, forms, styling                                                 | `apps/petstore-next` only  |

**UI stack (keep boring):**

- Tailwind CSS as set up by create-next-app (PostCSS included by that default).
- Optional **CSS Modules** (`*.module.css`) for a few scoped layout tweaks — still stock Next.
- No component libraries, no client data libraries.

**Data rules (hard):**

1. **No client-side data fetching** — no SWR/React Query, no `useEffect`/`onClick` `fetch`/`axios` for reads or writes from Client Components.
2. **Reads:** React Server Components call `getServerAccess()` / use cases **in-process** (DAL).
3. **Writes:** HTML `<form>` + Server Actions calling use cases in-process; browser must not XHR/fetch app data.
4. Client Components, if any, are presentational only (e.g. `useFormStatus`).

**No tests for the PetShop app:** do **not** add Vitest, Pactum, Playwright, or UI acceptance suites under `apps/petstore-next`. Prove the loop by generating, installing with `vp`/`pnpm`, and running `next dev` / Compose. (`plugin-next` package tests remain separate.)

**Suggested information architecture:**

| Route                                      | Role                                                  |
| ------------------------------------------ | ----------------------------------------------------- |
| `/`                                        | Shop home — lists pets via RSC                        |
| `/pets/[petId]`                            | Pet detail via RSC                                    |
| `/pets/new`, edit forms                    | Create/update pet via form → Server Action → use case |
| `/orders/...`                              | Place/get/delete order via RSC + forms                |
| OpenAPI paths (`/pet`, `/store/order/...`) | Generated Route Handlers for external HTTP            |

Human UI paths (`/pets`, `/orders`) stay distinct from OpenAPI handlers.

**Dogfood merge algorithm (normative — no hand-waving):**

1. Generate **into a temporary output directory** (not directly over `apps/petstore-next`):  
   `hexkit generate <openapi.poc.yaml> <TMP> --http next --next-surface routes`.
2. From `<TMP>`, copy into `apps/petstore-next/`:
   - `src/**` (contracts, core, adapters including `http-next` + `server-access`, drizzle, auth)
   - OpenAPI Route Handler files only: `app/**/route.ts` (and their parent dirs)
   - Generated Next packaging pieces that do not own UI: e.g. drizzle/env snippets as documented by packaging
3. **Do not copy** from `<TMP>`: `app/layout.tsx`, `app/page.tsx`, or any non-`route.ts` under `app/` (fixture owns shop UI).
4. Ensure `apps/petstore-next` keeps its fixture `app/layout.tsx`, `app/page.tsx`, `app/pets/**`, `app/orders/**`, Tailwind/PostCSS configs, and `tsconfig` `@/*` → `./src/*`.
5. `vp install` (or pnpm) in `apps/petstore-next`.
6. Apply DB schema if needed; start Postgres (Compose optional).
7. `next dev` or `next build && next start`.

```text
openapi.poc.yaml
  → hexkit generate --http next --next-surface routes → TMP
  → copy src/** + app/**/route.ts into apps/petstore-next
  → preserve fixture app UI (layout/page/pets/orders)
  → vp install / pnpm install
  → next dev  (or Compose: Next + Postgres)
```

## 7. Testing strategy

1. **Unit (plugin-next only):** path mapping; method coalescing; auth status mapping; surface filtering.
2. **Domain-agnostic:** plugin production sources contain no Petstore/sample literals; dual fixtures without plugin edits; PetShop UI sources only under `apps/petstore-next`.
3. **Generation integration (CLI/plugin):** `--http next` with each surface; assert emitted/omitted files; typecheck generated tree when practical.
4. **PetShop app:** **no automated tests** — manual/scripted generate + `vp install` + `next dev` (or Compose) only.
5. **Regression:** Hono default dogfood stays green.

## 8. Docs / product amendments

- RFC: optional Next.js HTTP + RSC adapter; Hono default; Route Handlers for OpenAPI; RSC via DAL; domain-agnostic plugin rule; PetShop Next dogfood pointer.
- PRD §11: pointer to this design/plan; multi-framework was PoC non-goal, amended post-PoC as opt-in.
- `docs/README.md`: link design + plan.

## 9. Success criteria

Hexkit Next.js v1 is done when:

1. `plugin-next` supports `surface: "routes" | "rsc" | "both"` and generates the correct subset from any in-scope JSON contract **without** domain hardcoding.
2. When RSC/DAL is enabled, PetShop pages call `getServerAccess()` / use cases in-process (no self-`fetch` to Route Handlers).
3. No `page.tsx` collides with `route.ts` on the same segment (`both` uses `/ui`; `rsc` uses contract paths with no handlers; PetShop UI uses distinct human paths).
4. Vanilla PetShop Next app (create-next-app-shaped, `vp`/`pnpm`) typechecks / `next build`s against generated Hexkit output.
5. Auth fixture returns 401/200 correctly via Route Handlers when routes are enabled (plugin/CLI coverage — not PetShop UI tests).
6. Domain-agnostic scanner covers `packages/plugin-next/src`.
7. **PetShop dogfood:** generate → `vp`/`pnpm` install → run Next (+ Postgres as needed) with RSC + forms and **zero client-side data fetching**; **no PetShop test suite required**.
8. Default Hono Petstore dogfood is unchanged.

## 10. Decisions log

| Decision                          | Choice                                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Next surface for OpenAPI          | App Router Route Handlers at literal contract paths                                                                                              |
| RSC support                       | **v1 required** as selectable surface — basic pages + server-access DAL                                                                          |
| Generation modes                  | `NextSurface = "routes" \| "rsc" \| "both"` (default `both`)                                                                                     |
| UI vs API paths                   | `both` → UI under `/ui/...`; `rsc` → pages at contract paths; `routes` → handlers + **server-access DAL** + stub root entry (no `/ui` scaffolds) |
| PetShop dogfood                   | `apps/petstore-next` fixture UI; generate to TMP with `routes`; copy `src/**` + `app/**/route.ts` only                                           |
| PetShop bootstrap                 | Vanilla create-next-app defaults; installs via **Vite+ (`vp`) / pnpm**; `@/*` → `./src/*`                                                        |
| PetShop styling                   | Tailwind (create-next-app default) + optional CSS Modules                                                                                        |
| PetShop data loading              | RSC DAL reads; form posts (Server Actions → use cases); **no client-side fetching**                                                              |
| PetShop tests                     | **None**                                                                                                                                         |
| Server Actions as OpenAPI surface | Out of scope — OpenAPI stays on Route Handlers                                                                                                   |
| Pages Router API routes           | Out of scope                                                                                                                                     |
| Default HTTP adapter              | Hono (unchanged)                                                                                                                                 |
| Domain agnosticism                | Normative for `plugin-next` (PRD §5.0)                                                                                                           |
| Caching                           | Dynamic / request-time default                                                                                                                   |
| Primary architecture              | Approach A                                                                                                                                       |
| Next.js version floor             | 16.x                                                                                                                                             |
