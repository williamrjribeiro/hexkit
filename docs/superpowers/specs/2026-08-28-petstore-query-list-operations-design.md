# Design: Petstore query-parameter list operations (`findPetsByStatus`, `findPetsByTags`)

**Status:** Implemented  
**Date:** 2026-08-28  
**Tracker:** [docs/petstore-openapi-progress.md](../../petstore-openapi-progress.md) (Pet rows: `findPetsByStatus`, `findPetsByTags`)  
**Companions:** [PRD.md](../../../PRD.md) §11, [Rich Pet nested persistence plan](../plans/2026-08-20-rich-pet-nested-persistence.md), [RFC.md](../../../RFC.md)

## 1. Problem

Hexkit’s PoC contract (`openapi.poc.yaml`) covers seven JSON CRUD operations for Pet and Order. The post-PoC goal is full Swagger Petstore OpenAPI coverage tracked in `docs/petstore-openapi-progress.md`. The next missing Pet operations are:

| operationId        | Method / path           | Query param | Response |
| ------------------ | ----------------------- | ----------- | -------- |
| `findPetsByStatus` | `GET /pet/findByStatus` | `status`    | `Pet[]`  |
| `findPetsByTags`   | `GET /pet/findByTags`   | `tags`      | `Pet[]`  |

Today the generator pipeline **stops at hexagonal**: `deriveParameters()` throws on any non-path parameter. HTTP adapters already populate `request.query` on Apical requests, but `@hexkit/shared` never reads `request.value.query.*`. Drizzle `list` persistence always runs `SELECT *` with no `WHERE`.

This slice adds **domain-agnostic query-parameter support** end-to-end and proves it on Petstore dogfood. It does **not** add OAuth, XML, or form-urlencoded (those remain separate cross-cutting gaps).

## 2. Goals

1. Generate working Hono + Next Route Handler endpoints for both find operations from OpenAPI.
2. Filter persisted Pets in PostgreSQL (not in-memory fakes on the dogfood path).
3. Keep plugins free of Petstore literals (PRD §5.0).
4. Prove behavior with unit tests (generic fixture) and Pactum (Petstore dogfood).
5. Move tracker rows from `missing` → `partial` (JSON-only; no `petstore_auth`).

## 3. Non-goals (this slice)

- OAuth2 `petstore_auth` or scope-based 403 (Apical marks oauth2 unenforceable; tracker strict bar for `shipped` stays blocked).
- XML / form-urlencoded alternate media types.
- OpenAPI `style` / `explode` modeling in IR (rely on Apical server wrappers + Hono/Next query parsing).
- Query filters on `apps/fixtures/library-api` (optional follow-up).
- Next RSC browse pages for find ops (Route Handlers + dogfood API proof only; RSC hub unchanged unless trivial).
- Phase 2 relational tag tables (tags remain JSONB embed).

## 4. Approaches considered

### Approach A — Post-fetch filter in generated repository (reject)

Filter `rows.filter(...)` after full table scan.

| Pros                 | Cons                                       |
| -------------------- | ------------------------------------------ |
| Simple to emit       | Wrong for production scale; hides SQL bugs |
| Works for JSONB tags | Not acceptable for enum column filters     |

### Approach B — SQL filters in Drizzle `list` when parameters present (recommended)

Extend hexagonal `list` persistence kind: when a list operation declares query parameters, Drizzle emits `WHERE` clauses mapped from parameter names to table columns.

| Pros                                 | Cons                                          |
| ------------------------------------ | --------------------------------------------- |
| Real DB filtering on dogfood         | JSONB tag matching needs a generic heuristic  |
| Domain-agnostic mapping              | Multi-column filters deferred                 |
| Matches existing `listItems` pattern | First slice limited to one query param per op |

### Approach C — New `x-hexkit.queryFilter` extension (defer)

Explicit per-parameter filter semantics in OpenAPI.

| Pros              | Cons                                 |
| ----------------- | ------------------------------------ |
| Fully explicit    | New extension surface + Apical keys  |
| Avoids heuristics | Overkill for first query-param slice |

**Recommendation:** Approach B. Enum/scalar filters use `inArray`. JSONB array-of-objects filters use a documented v1 heuristic (§6.3).

## 5. Recommended design

### 5.1 Parameter location on application artifacts

Extend hexagonal `ApplicationParameter`:

```ts
export type ApplicationParameter = {
  name: string;
  typeExpression: string;
  location: "path" | "query";
};
```

Body parameters stay represented only via the existing `hasJsonRequestBody` flag (unchanged).

`deriveParameters()`:

- Accept `query` parameters (remove throw).
- Emit path parameters first, then query parameters (stable order).
- Reject `header` and `cookie` parameters with the same error pattern as today.

### 5.2 HTTP controller argument wiring

Extend `@hexkit/shared` `UseCaseArgumentInput`:

```ts
parameters: readonly { readonly name: string; readonly location: "path" | "query" }[];
```

Update `deriveUseCaseArgumentExpressions()`:

- `principal` first when `requiresAuth`.
- JSON body replaces all other args when `hasJsonRequestBody`.
- Otherwise emit path expressions, then query expressions:

```ts
request.value.path.<name>
request.value.query.<name>
```

Apical server wrappers already validate query shapes; controllers trust `request.isValid` (same as path/body today).

Hono and Next adapters require **no route-level changes** — they already pass `query` into Apical requests.

### 5.3 Persistence kind

No new `PersistenceKind`. `findPetsByStatus` / `findPetsByTags` are GET + array response → existing inference yields `persistenceKind: "list"` (see `persistenceKindFromAction` + `resultCardinality === "many"`).

When `list` has **zero** parameters → unchanged full scan (`auth-api` `listItems` regression).

When `list` has **one or more** parameters → Drizzle emits filtered select (§6).

### 5.4 PoC contract additions

Add to `apps/petstore-sample/openapi.poc.yaml` (JSON only; **no** `petstore_auth`):

```yaml
/pet/findByStatus:
  get:
    operationId: findPetsByStatus
    parameters:
      - name: status
        in: query
        required: true
        schema:
          type: array
          items:
            type: string
            enum: [available, pending, sold]
        style: form
        explode: true
    responses:
      "200":
        description: Pets matching status
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: "#/components/schemas/Pet"
      "400":
        description: Invalid status value

/pet/findByTags:
  get:
    operationId: findPetsByTags
    parameters:
      - name: tags
        in: query
        required: true
        schema:
          type: array
          items:
            type: string
        style: form
        explode: true
    responses:
      "200":
        description: Pets matching tags
        content:
          application/json:
            schema:
              type: array
              items:
                $ref: "#/components/schemas/Pet"
      "400":
        description: Invalid tag value
```

Multi-value query strings use Petstore form/explode shape (`?status=available&status=sold`, `?tags=friendly&tags=quiet`). Hono returns `string | string[]`; Apical normalizes to `Array<string>` in the server wrapper.

### 5.5 Generic proof fixture

Add `apps/fixtures/filter-api/openapi.yaml` — domain-agnostic Widget aggregate:

- `GET /widgets/findByStatus?status=…` → `Widget[]`
- Widget has persisted enum `status` column (mirrors Pet pattern without Petstore strings in plugin tests)

Used by hexagonal, shared, drizzle, and CLI integration tests per PRD §5.0 assurance matrix.

### 5.6 Drizzle filtered `list` generation

When `method.kind === "list"` and `method.parameters.length > 0`:

1. Resolve each query parameter to a table column by matching `parameter.name` to `column.propertyName`.
2. Apply filter rule by column + parameter type:

#### 5.6.1 Scalar / enum column + `Array<string>` or enum array param

Emit SQL filter using Drizzle `inArray`:

```ts
const rows = await db.select().from(pets).where(inArray(pets.status, status));
```

Import `inArray` from `drizzle-orm` when any list method has scalar filters.

Parameter type from hexagonal: `Array<"available" | "pending" | "sold">` or `Array<string>`.

#### 5.6.2 JSONB array-of-objects column + `Array<string>` param (tags heuristic)

When:

- column SQL type is JSONB, and
- column stores an array of objects (nested JSONB from Phase 1), and
- parameter type is `Array<string>`,

emit a **post-select filter** in TypeScript (v1 pragmatic):

```ts
const rows = await db.select().from(pets);
return rows
  .filter((row) => {
    const tags = row.tags as Array<{ name?: string }> | null;
    if (!tags) return false;
    return tags.some((tag) => tag.name !== undefined && tagsParam.includes(tag.name));
  })
  .map(mapPet);
```

**Rationale:** Generic SQL JSONB path queries require knowing which object property to match; `name` is the conventional Tag field in OpenAPI Petstore and is derivable from the column’s JSON schema items when present. Full `x-hexkit` filter extensions remain Phase 2+. Document the heuristic; revisit if a second fixture needs a different property.

If JSONB items schema is unavailable at generation time, fall back to post-select with `String()` coercion on each array element (test-covered edge).

#### 5.6.3 Unsupported combinations

Throw at generation time with a clear message, e.g.:

> `list` operation `"findWidgetsByOwner"` parameter `"ownerId"` has no matching persisted column on Widget.

Never silently ignore filter parameters.

### 5.7 Next.js

- Route Handlers: inherit shared controller binding changes automatically.
- Regenerate `apps/petstore-next` Route Handlers and `server-access.ts` after contract change (`findPetsByStatus`, `findPetsByTags` on `ServerAccess`).
- **Fixture-owned PetShop UI** (Task 10): showcase list filters on `/pets` without client-side fetching.

#### 5.7.1 PetShop catalog filters (`apps/petstore-next`)

The fixture owns UI under `app/pets/**`. Reads call generated **server-access in-process** (DAL); writes stay on Server Actions. Do not `fetch` Route Handlers from RSC.

**Replace** the current `featuredPetIds` + repeated `getPetById` workaround with query-driven catalog loading:

| URL                                  | Server-access call                                                          |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `/pets` (no params)                  | `findPetsByStatus(["available", "pending", "sold"])` — full catalog default |
| `/pets?status=available`             | `findPetsByStatus(["available"])`                                           |
| `/pets?status=available&status=sold` | `findPetsByStatus(["available", "sold"])`                                   |
| `/pets?tags=friendly`                | `findPetsByTags(["friendly"])`                                              |
| `/pets?tags=friendly&tags=quiet`     | `findPetsByTags(["friendly", "quiet"])`                                     |

**Filter precedence (v1):** Petstore has separate find endpoints, not a combined filter. If any `tags` are present in `searchParams`, call `findPetsByTags`; else if any `status` values are present, call `findPetsByStatus`; else default catalog (all statuses).

**Filter bar** — plain HTML `<form method="get">` on `/pets` (no `"use client"`):

- **Status:** `<select name="status">` with All / Available / Pending / Sold. “All” omits the param (default catalog). Single status submits one value.
- **Tags:** checkbox group with `name="tags"` and preset fixture labels (`friendly`, `quiet`, `trained`) matching dogfood seed data.
- **Apply filters** submit button; **Clear** links to `/pets`.
- Results: existing card grid + status badge + tag pills; header shows match count; empty state when API returns `[]`.

**Homepage** (`app/page.tsx`): add quick-link pills to `/pets?status=available`, `/pets?status=pending`, `/pets?status=sold`.

**Optional demo footer** on `/pets`: one line showing the equivalent OpenAPI Route Handler (`GET /pet/findByStatus?status=…`) for manual/curl testing — UI proves in-process DAL; footer proves public HTTP surface.

**Out of scope for fixture UI:** Vitest/Playwright tests (fixture has no app test suite per README); combined status+tags AND filter; client-side autocomplete.

### 5.8 Dogfood / Pactum

Extend `apps/petstore-sample/tests/api.test.ts`:

**findPetsByStatus**

- Seed pets with `available`, `pending`, `sold`.
- `GET /pet/findByStatus?status=available` → only available pets.
- Multi-value: `?status=available&status=sold` → union.
- Missing/empty `status` → 400 (Apical validation).

**findPetsByTags**

- Seed pets with distinct tag names (`friendly`, `quiet`, `trained`).
- `GET /pet/findByTags?tags=friendly` → matching pets only.
- Multi-tag OR semantics: `?tags=friendly&tags=quiet`.
- No matching tag → empty array `[]` with 200.

Existing CRUD lifecycle tests remain unchanged.

### 5.9 Progress tracker

Update `docs/petstore-openapi-progress.md`:

| Row                | Hono    | Next    |
| ------------------ | ------- | ------- |
| `findPetsByStatus` | partial | partial |
| `findPetsByTags`   | partial | partial |

Notes: JSON + DB filter proven; `petstore_auth` / XML still absent. Refresh Summary tallies + Last updated.

## 6. Error handling

| Condition                         | Behavior                                        |
| --------------------------------- | ----------------------------------------------- |
| Invalid/missing required query    | Apical wrapper → 400 (existing controller path) |
| No rows match filter              | 200 + `[]`                                      |
| Query param with no column match  | Generation fails with explicit error            |
| Header/cookie query params in OAS | Hexagonal generation throws (unchanged)         |

## 7. Testing strategy

| Layer      | Proof                                                               |
| ---------- | ------------------------------------------------------------------- |
| Hexagonal  | `deriveParameters` accepts query; rejects header/cookie             |
| Shared     | `deriveUseCaseArgumentExpressions` emits `request.value.query.*`    |
| Drizzle    | Snapshot/filter-api generated repo SQL + JSONB heuristic            |
| CLI        | `filter-api` generate integration test                              |
| Dogfood    | Petstore Pactum against Compose                                     |
| Regression | `auth-api` `listItems` still unfiltered; existing PoC ops unchanged |
| CI         | Quality + Dogfood API + Dogfood NextJS (parallel)                   |
| Next UI    | Manual smoke: `/pets` status/tag filters update catalog (Task 10)   |

Run locally: `vp run ready` then `vp run dogfood`.

## 8. Success criteria

1. `hexkit generate apps/petstore-sample/openapi.poc.yaml <out>` emits find routes, use cases, ports, and filtered Drizzle repos.
2. `vp run dogfood` passes with new Pactum cases.
3. Plugin unit tests use `filter-api` fixture — no Petstore strings in `@hexkit/plugin-*` production source.
4. Tracker rows move to `partial` with accurate Notes.
5. `@hexkit/plugin-apical` unchanged unless craft parity test gaps appear for array query params.
6. PetShop Next fixture: `/pets` filter toolbar drives `findPetsByStatus` / `findPetsByTags` via server-access; homepage status pills link into filtered views.

## 9. Risks

| Risk                                    | Mitigation                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Apical array query validation gaps      | Early craft smoke test in Task 1                                              |
| JSONB tag heuristic too Petstore-shaped | Derive match property from JSON schema items when possible; document fallback |
| Multi-param list filters                | Explicitly out of scope; one query param per op here                          |
| Next tracker stuck at partial           | Expected until OAuth/XML ship                                                 |
