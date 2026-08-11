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

| Concern | Next.js recommendation | Hexkit implication |
| -------- | ---------------------- | ------------------ |
| Server Component reads | Prefer **DAL / ORM / in-process** calls; avoid self-HTTP where possible | Generated RSC pages import **use cases** via a server-access composition module — **not** `fetch` to Route Handlers |
| Public / external clients | HTTP APIs (REST) | Generate Route Handlers that honor the OpenAPI contract |
| Mutations from React UI | Server Actions (`"use server"`, POST-oriented, FormData-friendly) | **Out of v1** for OpenAPI fidelity (pages are read-oriented scaffolds) |
| Authz | Check auth inside every public entry (Route Handler / Server Function) | Reuse hexagonal `Authenticator` + Apical header presence |

**Conclusion:** Hexkit’s OpenAPI → HTTP mapping belongs on **Route Handlers**. RSC support belongs on **in-process use-case calls**. Server Actions are a parallel React mutation API and must not be treated as the OpenAPI surface.

### 2.4 Caching

Route Handlers are **dynamic by default**. Caching `GET` (`force-static` / `use cache` helpers) is opt-in and unsafe as a default for DB-backed authenticated APIs. Hexkit v1 emits **request-time** handlers and pages (no static cache export).

### 2.5 `page` vs `route` conflict

Because `page` and `route` cannot share a segment, Hexkit **must** place RSC UI under a dedicated URL prefix (see §5.1). Public OpenAPI paths keep Route Handlers; sample UI lives under `/ui/...`.

## 3. Plugin domain-agnostic invariant (normative)

**`@hexkit/plugin-next` must obey PRD §5.0 exactly like `@hexkit/plugin-hono` / drizzle / hexagonal.**

Sample domains (Petstore, library, auth-api) are **fixtures only**. They must not be hardcoded into plugin production source.

| Layer | May know Petstore / sample domain? | How domain knowledge enters |
| ----- | ---------------------------------- | --------------------------- |
| `apps/petstore-sample`, `apps/fixtures/**` | **Yes** | Authored OpenAPI + dogfood tests |
| `@hexkit/plugin-next` | **No** | Derives Route Handlers, RSC pages, DAL wiring from Apical contracts + hexagonal artifacts |
| CLI packaging for Next | **No** | Generic Next + Postgres packaging from generation context |

**Rules:**

1. Generators consume OpenAPI/Apical/application artifacts in context; they do not embed sample schemas, operationIds, paths, or entity names in plugin source.
2. Plugin tests **may** use Petstore/library OpenAPI as **input fixtures** and snapshot outputs. Tests must not pass only because the plugin embeds those fixtures.
3. Changing a fixture OpenAPI (add/rename path or operation) must change generated `route.ts` / `page.tsx` **without** editing `plugin-next` for that domain.
4. `apps/cli` domain-agnostic scanner must include `packages/plugin-next/src` production sources.
5. A Next dogfood that greens only via hardcoded Pet/Order (or any sample) generators is **incomplete**.

## 4. Goals / non-goals

### Goals (v1)

1. Add `@hexkit/plugin-next` that emits App Router **Route Handlers** and **basic RSC pages** from Apical + hexagonal artifacts.
2. Keep Hono as the **default** HTTP adapter; Next.js is **opt-in** via CLI / plugin set.
3. Keep `plugin-next` **domain-agnostic** (§3 / PRD §5.0).
4. Map auth the same way as Hono for Route Handlers: Apical wire validation → 401 → `Authenticator` → `Principal`.
5. RSC pages call a generated **server-access / DAL** module (composed use cases) in-process — never self-HTTP.
6. Dogfood with a Next-targeted fixture that generates, typechecks, serves Route Handlers, and renders basic UI pages.
7. Document Route Handlers (public REST) vs RSC DAL (same-app UI).

### Non-goals (v1)

- Replacing Hono as the default / PoC dogfood target.
- Pages Router `pages/api/*`.
- Polished design systems, Client Components, or rich forms.
- Generating Server Actions from OpenAPI (mutations stay API/Route Handler oriented in v1).
- Generating Cache Components / ISR / `use cache` policies for API routes.
- Mounting the Hono app inside a Next catch-all as the primary design.
- Vercel-specific adapters, Edge runtime, or SST/Next dual deploy.
- XML / non-JSON media types (same as PoC).

## 5. Approaches considered

### Approach A — Native Route Handlers + RSC pages (recommended)

`plugin-next` emits:

1. One `route.ts` per OpenAPI path (method-coalesced) at **literal contract URLs**.
2. Shared HTTP helpers + runtime under `src/adapters/http-next/`.
3. A **server-access** composition module for RSC.
4. Basic `page.tsx` Server Components under `/ui/...` derived from readable (GET) operations.
5. Minimal `app/layout.tsx` + `app/page.tsx` index linking to generated UI pages.

| Pros | Cons |
| ---- | ---- |
| Matches Next.js Route Handler + DAL guidance | Duplicates some HTTP adapter logic vs Hono |
| RSC supported from day one | Need `/ui` prefix to avoid `page`/`route` conflicts |
| Domain-agnostic derivation from contracts | CLI target selection / packaging fork |

### Approach B — Catch-all Hono inside Next

Emit `app/api/[[...route]]/route.ts` that delegates to Hono.

| Pros | Cons |
| ---- | ---- |
| Minimal new HTTP generator | Not idiomatic Route Handlers; still need separate RSC story |
| | Couples Next to Hono |

### Approach C — Server Actions as the API

Emit `"use server"` functions per operation.

| Pros | Cons |
| ---- | ---- |
| Popular for React forms | POST-only; poor OpenAPI fidelity |
| | Wrong public REST surface |

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

### 6.1 Generated layout (Next target)

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
├── page.tsx                 # index linking to /ui/... pages (generated)
├── pet/route.ts             # OpenAPI path Route Handlers (example)
├── pet/[petId]/route.ts
└── ui/                      # RSC sample UI (no collision with route.ts)
    ├── page.tsx             # UI hub
    ├── pet/page.tsx         # list/read scaffold when GET /pet exists
    └── pet/[petId]/page.tsx # detail scaffold when GET /pet/{petId} exists
```

**URL mapping:**

| Kind | OpenAPI / source | Generated URL / file |
| ---- | ---------------- | -------------------- |
| Route Handler | `/pet/{petId}` | `/pet/{petId}` → `app/pet/[petId]/route.ts` |
| RSC page (GET) | same operation | `/ui/pet/[petId]` → `app/ui/pet/[petId]/page.tsx` |
| UI index | all GET ops | `/` and `/ui` list links derived from operations |

Multiple HTTP methods on one OpenAPI path share one `route.ts`.  
`page.tsx` is emitted only under `app/ui/...` (and root index/layout), never beside a `route.ts` on the same segment.

### 6.2 Handler shape (Route Handlers)

Each method:

1. Builds an Apical request from `NextRequest` + `await params` + optional JSON body.
2. Runs the Apical operation wrapper.
3. On secured ops: authenticate via `Authenticator`; map auth failures to **401**.
4. Invokes the protected use case (with `Principal` when secured).
5. Validates response with Apical response map; returns `Response.json(...)`.
6. Maps validation → **400**; unexpected → **500** without leaking stacks.

### 6.3 RSC + server-access (required in v1)

Generate `src/adapters/http-next/server-access.ts` that:

- Lazily composes DB repos → use-case factories → (optional) authenticator the same way runtime does for HTTP.
- Exports a stable `getServerAccess()` returning named use-case functions keyed by `operationId` (or derived safe names from the contract).

Generated pages:

- Are **async Server Components**.
- Call `getServerAccess()` and invoke the matching use case with path/search params from `await props.params` / `searchParams`.
- Render a minimal, domain-agnostic presentation (e.g. title = `operationId` or path; body = pretty-printed JSON or simple key/value list). **No sample-domain copy in the generator.**
- For secured GET ops in v1: pages may call use cases **without** browser credential UI (document limitation) **or** read a documented stub header/env only in dogfood — prefer documenting that authenticated RSC demos use Route Handlers / follow-up cookie session work; unsecured GET pages are the normative v1 UI slice.

Ownership:

- `app/ui/**/page.tsx`, `app/page.tsx`, `app/layout.tsx`: ownership **`generated`** (overwrite) for v1 scaffolds.
- Protected use cases under `src/core/application/**` remain protected (unchanged hexagonal policy).

### 6.4 Auth

Reuse contract security IR on `ContractArtifact`. Route Handlers read headers from `request.headers`. Do not invent cookie-session auth in v1 beyond existing header `apiKey` / HTTP bearer schemes.

### 6.5 Packaging & CLI

- Default pipeline stays Hono + current Compose packaging.
- CLI: `hexkit generate <openapi> <out> --http next` swaps `plugin-hono` for `plugin-next` and emits Next packaging.
- Petstore PoC dogfood remains Hono unless explicitly extended.

### 6.6 Runtime

v1 targets the **Node.js** Next runtime (needed for Drizzle). Edge runtime is out of scope.

## 7. Testing strategy

1. **Unit:** path mapping for handlers and UI pages; method coalescing; auth status mapping.
2. **Domain-agnostic:** plugin production sources contain no Petstore/sample literals; Library vs Petstore fixtures both generate coherent `route.ts` + `app/ui/**/page.tsx` without plugin edits.
3. **Generation integration:** `--http next` emits handlers + pages + server-access; typecheck generated app.
4. **Acceptance:** Next + Postgres Compose; Pactum against OpenAPI Route Handler URLs; smoke check that `/ui/...` pages return 200 HTML for unsecured GET ops.
5. **Regression:** Hono default dogfood stays green.

## 8. Docs / product amendments

- RFC: optional Next.js HTTP + RSC adapter; Hono default; Route Handlers for OpenAPI; RSC via DAL; domain-agnostic plugin rule.
- PRD §11: pointer to this design/plan; multi-framework was PoC non-goal, amended post-PoC as opt-in.
- `docs/README.md`: link design + plan.

## 9. Success criteria

Hexkit Next.js v1 is done when:

1. `plugin-next` generates Route Handlers **and** basic RSC pages from any in-scope JSON contract **without** domain hardcoding.
2. RSC pages call `getServerAccess()` / use cases in-process (no self-`fetch` to Route Handlers).
3. No `page.tsx` collides with `route.ts` on the same segment (`/ui` prefix strategy).
4. Generated app typechecks and serves handlers + pages under Next.js 16 App Router.
5. Auth fixture returns 401/200 correctly via Route Handlers.
6. Domain-agnostic scanner covers `packages/plugin-next/src`.
7. Default Hono Petstore dogfood is unchanged.

## 10. Decisions log

| Decision | Choice |
| -------- | ------ |
| Next surface for OpenAPI | App Router Route Handlers at literal contract paths |
| RSC support | **v1 required** — basic generated Server Component pages + server-access DAL |
| UI vs API paths | UI under `/ui/...` to avoid `page`/`route` segment conflict |
| Server Actions | Out of v1 for OpenAPI mapping |
| Pages Router API routes | Out of scope |
| Default HTTP adapter | Hono (unchanged) |
| Domain agnosticism | Normative for `plugin-next` (PRD §5.0) |
| Caching | Dynamic / request-time default |
| Primary architecture | Approach A |
| Next.js version floor | 16.x |
