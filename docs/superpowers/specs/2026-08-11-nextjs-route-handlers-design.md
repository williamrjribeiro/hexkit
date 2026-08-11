# Design: Next.js App Router Route Handlers in Hexkit

**Status:** Draft  
**Date:** 2026-08-11  
**Companion:** [RFC.md](../../../RFC.md), [PRD.md](../../../PRD.md)  
**Implementation plan:** [2026-08-11-nextjs-route-handlers.md](../plans/2026-08-11-nextjs-route-handlers.md)  
**Docs reviewed:** Next.js **16.3.0** via [`/docs/llms.txt`](https://nextjs.org/docs/llms.txt) — Route Handlers, `route.js`, Backend for Frontend, Fetching Data, Mutating Data, Data Security.

## 1. Problem

Hexkit currently generates a **Hono** HTTP adapter as the only driving adapter. Next.js is the dominant React full-stack framework; teams often want OpenAPI-backed APIs colocated with an App Router UI.

RFC/PRD today treat **multiple web frameworks as a non-goal** for the initial release and fix the stack on Hono + (deferred) SST/Lambda. Adding Next.js is therefore an **explicit product amendment**, not a silent PoC stretch.

We need a contract-first path that:

- Maps OpenAPI operations to idiomatic Next.js **Route Handlers**.
- Keeps Hexagonal Architecture (domain/use cases/ports free of Next.js).
- Reuses Apical Zod validation and existing auth IR (`Principal` / `Authenticator`).
- Does **not** break the Hono Petstore / auth-api dogfood defaults.

## 2. What Next.js 16 says (findings)

### 2.1 Route Handlers are the public HTTP API surface

From [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) and [`route.js`](https://nextjs.org/docs/app/api-reference/file-conventions/route):

- Defined as `app/**/route.ts` exporting `GET` | `POST` | `PUT` | `PATCH` | `DELETE` | `HEAD` | `OPTIONS`.
- Use Web `Request` / `Response`, optionally `NextRequest` / `NextResponse`.
- Dynamic path params arrive as **`await ctx.params`** (Promise).
- Cannot coexist with `page.js` on the **same** segment.
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
| Server Component reads | Prefer **DAL / ORM / in-process** calls; avoid self-HTTP where possible | RSC should import **use cases / ports**, not `fetch` the generated Route Handlers |
| Public / external clients | HTTP APIs (REST) | Generate Route Handlers that honor the OpenAPI contract |
| Mutations from React UI | Server Actions (`"use server"`, POST-oriented, FormData-friendly) | **Out of v1** for OpenAPI fidelity |
| Authz | Check auth inside every public entry (Route Handler / Server Function) | Reuse hexagonal `Authenticator` + Apical header presence |

**Conclusion:** Hexkit’s OpenAPI → HTTP mapping belongs on **Route Handlers**. Server Actions are a parallel React mutation API and must not be treated as the OpenAPI surface.

### 2.4 Caching

Route Handlers are **dynamic by default**. Caching `GET` (`force-static` / `use cache` helpers) is opt-in and unsafe as a default for DB-backed authenticated APIs. Hexkit v1 emits **request-time** handlers (no static cache export).

## 3. Goals / non-goals

### Goals (v1)

1. Add `@hexkit/plugin-next` that emits App Router Route Handlers from Apical + hexagonal artifacts.
2. Keep Hono as the **default** HTTP adapter; Next.js is **opt-in** via CLI / plugin set.
3. Preserve domain-agnostic plugins (PRD §5.0).
4. Map auth the same way as Hono: Apical wire validation → 401 on auth header failures → `Authenticator` → `Principal` into secured use cases.
5. Dogfood with a Next-targeted fixture (reuse library or auth-api shape) that generates, typechecks, and serves Route Handlers.
6. Document how Server Components should call the hexagonal DAL **in-process**.

### Non-goals (v1)

- Replacing Hono as the default / PoC dogfood target.
- Pages Router `pages/api/*`.
- Generating React UI pages, layouts, or Server Actions from OpenAPI.
- Generating Cache Components / ISR / `use cache` policies for API routes.
- Mounting the Hono app inside a Next catch-all as the primary design (allowed later as an escape hatch, not v1).
- Vercel-specific adapters, Edge runtime, or SST/Next dual deploy.
- XML / non-JSON media types (same as PoC).

## 4. Approaches considered

### Approach A — Native Route Handlers plugin (recommended)

New `plugin-next` emits one `route.ts` per OpenAPI path (coalescing methods), plus shared request/response helpers and a runtime composition module. Controllers call the same protected use cases as Hono.

| Pros | Cons |
| ---- | ---- |
| Matches Next.js docs and file conventions | Duplicates some HTTP adapter logic vs Hono |
| Clear OpenAPI path → filesystem mapping | Need CLI target selection / packaging fork |
| Easy to type with `NextRequest` + awaited `params` | |

### Approach B — Catch-all Hono inside Next

Emit `app/api/[[...route]]/route.ts` that delegates to the existing Hono app via a Next/Hono bridge.

| Pros | Cons |
| ---- | ---- |
| Minimal new generator surface | Not idiomatic “Route Handlers” |
| Reuses Hono validation/auth wiring | Harder to teach; couples Next to Hono forever |
| | Path prefix / basePath friction |

### Approach C — Server Actions as the API

Emit `"use server"` functions per operation.

| Pros | Cons |
| ---- | ---- |
| Popular for React forms | POST-only; poor OpenAPI method/path fidelity |
| | Not a public REST contract; wrong dogfood for Petstore |
| | Conflicts with Hexkit’s contract-first HTTP story |

**Decision:** **Approach A** for v1. Approach B may be documented later as an advanced compose option. Approach C is rejected for OpenAPI REST.

## 5. Architecture

```
OpenAPI
  → plugin-apical          (contracts + Zod + security IR)
  → plugin-architecture-hexagonal  (domain, ports, use cases, Principal)
  → plugin-next  ∥  plugin-drizzle   (Next replaces plugin-hono when selected)
  → packaging (Next-aware Compose / scripts)
```

Business logic remains independent of Next.js, Hono, Drizzle, and deploy tooling.

### 5.1 Generated layout (Next target)

```
src/
├── generated/contracts/     # Apical (unchanged)
├── core/                    # hexagonal (unchanged; protected use cases)
├── adapters/
│   ├── db/                  # Drizzle (unchanged)
│   ├── auth/                # authenticator stub when security present
│   └── http-next/           # Next-specific helpers (controllers / request map)
app/                         # App Router (Next convention at project root)
└── …/{segment}/route.ts     # one file per OpenAPI path
```

OpenAPI paths map **literally** into `app/` (no forced `/api` prefix) so the public URL matches the contract:

| OpenAPI path | File |
| ------------ | ---- |
| `/pet` | `app/pet/route.ts` |
| `/pet/{petId}` | `app/pet/[petId]/route.ts` |
| `/store/order/{orderId}` | `app/store/order/[orderId]/route.ts` |

Multiple methods on the same path share one `route.ts` exporting the corresponding HTTP functions.

### 5.2 Handler shape

Each method:

1. Builds an Apical request object from `NextRequest` + `await params` + optional JSON body.
2. Runs the existing Apical operation wrapper (same as Hono).
3. On secured ops: authenticate via `Authenticator`; map auth failures to **401**.
4. Invokes the protected use case (with `Principal` when secured).
5. Validates response with Apical response map; returns `Response.json(...)`.
6. Maps request validation failures to **400**; unexpected errors to **500** without leaking stacks.

Shared logic lives under `src/adapters/http-next/` so `route.ts` files stay thin (Next file-convention entrypoints only).

### 5.3 Auth

Reuse contract security IR already on `ContractArtifact`. Next handlers read headers from `request.headers` (Web Headers). Do not invent cookie-session auth in v1 unless the OpenAPI scheme is header `apiKey` / HTTP bearer (same as Hono v1).

### 5.4 Server Components (documentation + optional helper)

Hexkit does **not** generate pages in v1. Docs must state:

- For UI in the same Next app, import use-case factories / ports from `src/core/**` (Data Access Layer pattern).
- Do **not** `fetch('http://localhost/.../pet')` from Server Components to hit own Route Handlers.

Optional later: a tiny `src/adapters/http-next/server-access.ts` re-exporting composed use cases for RSC — not required for green bar.

### 5.5 Packaging & CLI

- Default pipeline stays Hono + current Compose packaging.
- CLI gains an HTTP adapter selector, e.g. `hexkit generate <openapi> <out> --http next` (exact flag in plan), which swaps `plugin-hono` for `plugin-next` and emits Next packaging (`package.json` scripts `dev`/`build`/`start`, Dockerfile running `next start`, Compose with Postgres).
- Petstore PoC dogfood remains Hono unless explicitly extended.

### 5.6 Runtime

v1 targets the **Node.js** Next runtime (`export const runtime = 'nodejs'` only if needed for Drizzle). Edge runtime is out of scope.

## 6. Testing strategy

1. **Unit:** path mapping (`/a/{id}` → `app/a/[id]/route.ts`), method coalescing, auth status mapping.
2. **Generation integration:** generate library-api / auth-api with `--http next`; assert files + banned Petstore literals; typecheck generated app.
3. **Acceptance:** Next server + Postgres (Compose) + Pactum against OpenAPI paths (mirror existing dogfood, Next packaging).
4. **Regression:** Hono default dogfood stays green.

## 7. Docs / product amendments

- RFC: add Next.js as an **optional** HTTP adapter; keep Hono default; note Route Handlers (not Server Actions) as the OpenAPI mapping.
- PRD follow-ups: add Next.js Route Handlers plan pointer; clarify non-goal was “multiple frameworks in initial PoC,” amended post-PoC.
- `docs/README.md`: link this design + plan.

## 8. Success criteria

Hexkit Next.js v1 is done when:

1. `plugin-next` generates Route Handlers for every JSON operation in a fixture contract without domain hardcoding.
2. Generated app typechecks and serves those routes under Next.js 16 App Router.
3. Auth fixture returns 401/200 correctly via Route Handlers.
4. Default Hono Petstore dogfood is unchanged.
5. Docs explain RSC → DAL (use cases) vs public Route Handlers.

## 9. Decisions log

| Decision | Choice |
| -------- | ------ |
| Next surface for OpenAPI | App Router Route Handlers |
| Server Actions | Out of v1 |
| Pages Router API routes | Out of scope |
| Default HTTP adapter | Hono (unchanged) |
| Path prefix | Literal OpenAPI paths under `app/` |
| Caching | Dynamic / request-time default |
| Primary architecture | Native `plugin-next` (Approach A) |
| Next.js version floor | 16.x (aligned with reviewed docs) |
