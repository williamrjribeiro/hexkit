# Design: Petstore `updatePetWithForm` (query field patch)

**Status:** Draft — awaiting review  
**Date:** 2026-09-01  
**Tracker:** [docs/petstore-openapi-progress.md](../../petstore-openapi-progress.md) (Pet row: `updatePetWithForm`)  
**Companions:** [PRD.md](../../../PRD.md) §11, [query-list design](./2026-08-28-petstore-query-list-operations-design.md), [RFC.md](../../../RFC.md)

## 1. Problem

Hexkit’s Petstore dogfood (`openapi.poc.yaml`) covers JSON Pet CRUD plus query list filters. The next classic Petstore Pet write still marked **`missing`** for both Hono and Next is:

| operationId         | Method / path       | Inputs                                        | Response   |
| ------------------- | ------------------- | --------------------------------------------- | ---------- |
| `updatePetWithForm` | `POST /pet/{petId}` | Path `petId`; optional query `name`, `status` | `Pet` JSON |

Official Swagger Petstore OAS 3.1 models `name` / `status` as **query parameters** (not `application/x-www-form-urlencoded`). The progress tracker already records that shape. Swagger 2.0 / some third-party docs use formData / form-urlencoded; that remains a **separate** cross-cutting capability row and is out of this slice.

Today the generator cannot ship this operation correctly because:

1. **POST defaults to `insert`.** `persistenceKindFromAction` only treats exact action tokens `update` / `patch` as updates; otherwise HTTP `post` → `insert`. `operationId` `updatePetWithForm` would insert unless the contract sets `x-hexkit.operation.action: update`.
2. **Update persistence assumes a full entity body.** Drizzle `update` always `.set({ …every non-identity column from entity… })` keyed by `entity.id`. A path id + optional query fields needs a **field patch** emit path.
3. **Optional query typing is incomplete.** Hexagonal `deriveParameters` ignores `parameter.required`, so optional query strings would be typed as required `string` instead of `string | undefined`.
4. **Next dogfood UI only exposes full `updatePet` (PUT).** There is no fixture-owned surface that exercises a lightweight name/status patch, so regenerating Route Handlers alone would not prove the operation in the App Router dogfood UX.

## 2. Goals

1. Generate working Hono + Next Route Handler endpoints for `updatePetWithForm` from OpenAPI (JSON response; query inputs).
2. Persist a **partial** Pet update in PostgreSQL (only provided fields; preserve category / tags / photoUrls).
3. Keep plugins free of Petstore literals (PRD §5.0) via a generic fixture.
4. Prove with unit tests (generic fixture) and Pactum (Hono dogfood); regenerate Next Route Handlers + `server-access`.
5. Ship a **useful Next PetShop UI** that makes the form-update semantics obvious next to full PUT edit.
6. Move tracker `updatePetWithForm` from `missing` → `partial` (JSON + query; no `petstore_auth`).

## 3. Non-goals (this slice)

- OAuth2 `petstore_auth` / scopes (Apical still marks oauth2 unenforceable; `shipped` bar stays blocked).
- `application/x-www-form-urlencoded` request bodies (cross-cutting tracker row).
- XML request/response.
- Changing PUT `updatePet` semantics or replacing the existing full Edit page.
- Generated RSC resource pages for this operation (fixture-owned UI under `app/pets/**`, same pattern as list filters).
- Multipart / `uploadFile`.

## 4. Approaches considered

### Approach A — Application merge: select → mutate → entity update (reject)

Generate a use case that `get`s the pet, overlays query fields, then calls existing `updatePet(entity)`.

| Pros                     | Cons                                                         |
| ------------------------ | ------------------------------------------------------------ |
| No Drizzle emit changes  | Two round-trips; races; wrong abstraction for “form patch”   |
| Reuses entity update SQL | Encourages hand-written use cases for a common OpenAPI shape |

### Approach B — Domain-agnostic field-patch `update` in Drizzle (recommended)

When an `update` method’s parameters are path identity + query fields that map to table columns, emit conditional `.set({ … })` for only defined fields. Keep today’s entity-body update path unchanged.

| Pros                                       | Cons                                         |
| ------------------------------------------ | -------------------------------------------- |
| Matches OpenAPI shape 1:1                  | Second update emit path to test and document |
| Single SQL statement; preserves other cols | Needs optional-param typing in hexagonal     |
| Generic fixture proves PRD §5.0            | Identity is path param name, not column name |

### Approach C — New persistence kind `patch` (defer)

Introduce `PersistenceKind = "patch"` distinct from `"update"`.

| Pros                    | Cons                                                 |
| ----------------------- | ---------------------------------------------------- |
| Very explicit semantics | Extra IR surface for one detectably different shape  |
|                         | Entity PUT and query POST both mean “persist update” |

**Recommendation:** Approach B. Detect field-patch vs entity-update from parameter `location` already present on hexagonal `ApplicationParameter`. Use contract extension `x-hexkit.operation.action: update` so POST is not misclassified as insert (designed escape hatch in `persistenceKindFromAction`).

## 5. Recommended design

### 5.1 PoC contract addition

Add to `apps/petstore-sample/openapi.poc.yaml` under existing `/pet/{petId}` (alongside `get` / `delete`):

```yaml
post:
  operationId: updatePetWithForm
  x-hexkit:
    operation:
      aggregate: Pet
      action: update
  parameters:
    - $ref: "#/components/parameters/PetId"
    - name: name
      in: query
      required: false
      schema:
        type: string
    - name: status
      in: query
      required: false
      schema:
        type: string
        enum: [available, pending, sold]
  responses:
    "200":
      description: Pet updated
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Pet"
    "400":
      description: Invalid input
    "404":
      description: Pet not found
```

Notes:

- **Query, not form body** — matches official swagger-petstore OAS 3.1 and the tracker Notes column.
- **`action: update`** — required so POST does not become `insert`.
- **Status enum** — tighter than classic bare `string`; improves Apical validation and Next UI selects. Still Petstore-recognizable.
- **404** — PoC enrichment (classic often omits it) so controllers return `Pet | undefined` → HTTP 404, consistent with `getPetById` / delete-not-found dogfood style.
- **No `petstore_auth`** — same as other PoC Pet writes; tracker stays `partial`.

Do **not** edit `apps/petstore-sample/openapi.yaml` (checked-in reference; PRD §3.1).

### 5.2 Generic proof fixture

Add `apps/fixtures/patch-api/openapi.yaml` — domain-agnostic Widget aggregate:

| operationId            | Method / path              | Params                                           |
| ---------------------- | -------------------------- | ------------------------------------------------ |
| `updateWidgetWithForm` | `POST /widgets/{widgetId}` | Path `widgetId`; optional query `name`, `status` |
| `getWidgetById`        | `GET /widgets/{widgetId}`  | Path `widgetId` (seed/setup for tests)           |

`Widget` declares `x-hexkit.persistence` (`table: widgets`, `identity: id`) with columns `id`, `name`, `status` (enum `active` \| `inactive`).

Used by hexagonal, drizzle, shared (if needed), and CLI/plugin tests — **no Petstore strings** in plugin unit tests.

### 5.3 Hexagonal — optional query typing + update action

#### 5.3.1 Optional parameters

In `deriveParameters` → `renderOperationParameter`, when `parameter.required === false`, append `| undefined` to the rendered type expression:

```ts
typeExpression: parameter.required ? rendered.expression : `${rendered.expression} | undefined`;
```

Path parameters remain required (Apical already forces path `required`).

Preserve `location: "path" | "query"` on emitted `ApplicationParameter` (already done for non-body params).

#### 5.3.2 Persistence kind

No new `PersistenceKind`. With `x-hexkit.operation.action: update`, `persistenceKindFromAction` returns `"update"` regardless of HTTP POST.

Use-case / repository method signature for the Petstore op:

```ts
updatePetWithForm(
  petId: number,
  name: string | undefined,
  status: "available" | "pending" | "sold" | undefined,
): Promise<Pet | undefined>
```

Factory stays a thin repository bind (unchanged pattern).

### 5.4 Shared HTTP wiring

No change required to `deriveUseCaseArgumentExpressions` for the happy path:

- No JSON body → path then query expressions:
  `request.value.path.petId`, `request.value.query.name`, `request.value.query.status`
- Controllers already handle `notFoundStatus` when the contract declares 404.

Hono and Next route emitters already multi-method the same path file (`GET` / `DELETE` today; add `POST`).

### 5.5 Drizzle — field-patch update emit

Pass parameter `location` through `PersistenceRepositoryMethodModel.parameters`.

**Entity update** (unchanged): `kind === "update"` and no path/query-located parameters (single body-derived entity param without `location`).

**Field-patch update:** `kind === "update"` and there is exactly one path parameter plus zero or more query parameters.

Emit roughly:

```ts
async updateWidgetWithForm(
  widgetId: string,
  name: string | undefined,
  status: "active" | "inactive" | undefined,
): Promise<Widget | undefined> {
  const patch: { name?: string; status?: "active" | "inactive" } = {};
  if (name !== undefined) patch.name = name;
  if (status !== undefined) patch.status = status;

  if (Object.keys(patch).length === 0) {
    const [existing] = await db
      .select()
      .from(widgets)
      .where(eq(widgets.id, widgetId))
      .limit(1);
    return existing ? mapWidget(existing) : undefined;
  }

  const [row] = await db
    .update(widgets)
    .set(patch)
    .where(eq(widgets.id, widgetId))
    .returning();
  return row ? mapWidget(row) : undefined;
}
```

Rules:

1. Path parameter value is the identity **argument**; SQL column is always `table.identityPropertyName` (same as select/delete today — `petId` arg vs `pets.id` column).
2. Each query parameter must match a non-identity column `propertyName`. Unknown names → generation-time error (never silently ignore).
3. Query params only; additional path params beyond identity → generation-time error in v1.
4. Empty patch (all query args `undefined`) → select-by-id no-op return (successful “form submit with no changes”).
5. Missing row → `undefined` when return type includes `| undefined` (404 contract); otherwise keep today’s throw style for entity updates without 404.

Unsupported: JSONB partial field updates, nested object patches, array-merge query params.

### 5.6 Next.js Route Handlers + server-access

After regenerating `apps/petstore-next` from the expanded PoC contract:

- `app/pet/[petId]/route.ts` gains `POST` calling `runtime.controllers.updatePetWithForm`.
- `ServerAccess` gains `updatePetWithForm` bound through `createUpdatePetWithForm`.
- RSC reads stay in-process; no `fetch` to Route Handlers from Server Actions / RSC (existing dogfood rule).

### 5.7 Next PetShop UI — Quick update (fixture-owned)

**Problem with only regenerating handlers:** the existing `/pets/[petId]/edit` page is a full-entity PUT (`updatePet`) including photo URLs. That does not teach or exercise form-update semantics.

**Design:** add a **Quick update** panel on the pet detail page (`app/pets/[petId]/page.tsx`) that patches name + status via `updatePetWithForm`. Keep **Edit pet** linking to the full PUT form.

#### 5.7.1 Information architecture

| Surface                        | Operation           | Fields                      | Purpose                           |
| ------------------------------ | ------------------- | --------------------------- | --------------------------------- |
| Pet detail → **Quick update**  | `updatePetWithForm` | name, status                | Lightweight shelf change / rename |
| Pet detail → **Edit pet** link | (navigates)         | —                           | Full entity replace               |
| `/pets/[petId]/edit`           | `updatePet`         | id, name, status, photoUrls | Existing full PUT form            |

Detail page layout (one composition, one job per block):

1. **Identity header** — pet id, name, status badge (read-only summary).
2. **Quick update** — plain HTML form → Server Action `updatePetWithFormAction` → `getServerAccess().updatePetWithForm(...)`.
3. **Actions row** — link to full Edit; Delete form (existing).
4. **Debug JSON** — existing `<pre>` dump, demoted below the interactive blocks (optional keep).

#### 5.7.2 Quick update form behavior

- Prefill `name` and `status` from the loaded pet.
- Hidden `petId`.
- Submit label: **Apply quick update** (not “Save pet” — distinguishes from Add / full Edit).
- On success: `revalidatePath` for `/`, `/pets`, `/pets/[id]`; redirect back to detail (same pattern as `updatePetAction`).
- Copy under the heading: one short sentence that this calls `updatePetWithForm` (`POST /pet/{petId}?name&status`) and leaves category / tags / photos unchanged.
- Footer hint with equivalent Route Handler example:
  `POST /pet/{petId}?name=…&status=…`

#### 5.7.3 Visual language

Stay inside the existing PetShop fixture look (stone / amber Tailwind already used on `/pets`). Do not invent a new marketing landing aesthetic. Do not add cards-for-cards’ sake beyond the existing rounded panel pattern used on detail/edit pages.

#### 5.7.4 Why this UI is useful

- Shows the **API product difference** between PUT full replace and POST query patch in one screen.
- Gives store operators a fast path for the most common change (name + availability) without touching photo URLs.
- Dogfoods `server-access.updatePetWithForm` the same way catalog filters dogfood `findPetsBy*`.

### 5.8 Dogfood / acceptance

**Hono (`vp run dogfood`):** Pactum cases in `apps/petstore-sample/tests/api.test.ts`:

1. Add a pet → `POST /pet/{id}?name=Renamed&status=pending` → 200 body reflects both fields; nested category/tags/photoUrls unchanged.
2. `POST` with only `status` → name preserved.
3. `POST` with no query fields → 200 same pet (no-op).
4. Missing id → 404.
5. Invalid status enum → 400 (Apical validation).

**Next (`vp run dogfood-petstore-next`):** regenerate → ESLint + `next build` (CI skips Compose). Manual/local Compose optional; UI proof is the fixture form wiring + typecheck of Server Action against `ServerAccess`.

### 5.9 Tracker update

In the same PR:

| Cell                       | Before  | After   |
| -------------------------- | ------- | ------- |
| `updatePetWithForm` × Hono | missing | partial |
| `updatePetWithForm` × Next | missing | partial |

Notes stay: query `name` / `status`; still need `petstore_auth` (and form-urlencoded if/when that cross-cutting row ships). Refresh Summary tallies + Last updated.

## 6. Testing strategy

| Layer        | What                                                                            |
| ------------ | ------------------------------------------------------------------------------- |
| Hexagonal    | Optional query `                                                                | undefined`; patch-api derive → `persistenceKind: "update"` with path+query params |
| Drizzle      | Field-patch emit + empty-patch select; unknown query column throws              |
| Hono / Next  | Generated `POST` on `[petId]` route; domain-agnostic plugin tests use patch-api |
| Pactum       | Cases in §5.8                                                                   |
| Next fixture | Server Action + detail Quick update form compile under `next build`             |

## 7. Risks & mitigations

| Risk                                    | Mitigation                                                   |
| --------------------------------------- | ------------------------------------------------------------ |
| POST misclassified as insert            | Require `x-hexkit.operation.action: update` on PoC + fixture |
| Empty `.set({})` rejected by Drizzle/PG | Empty patch takes select-by-id branch                        |
| Confusing two update UIs                | Explicit Quick update copy + keep full Edit as separate CTA  |
| Accidental form-urlencoded scope creep  | Non-goal; leave cross-cutting row `missing`                  |
| Optional params still required in TS    | Hexagonal appends `\| undefined` when `required: false`      |

## 8. Success criteria

1. `vp run --filter './packages/*' --filter './apps/cli' test` green with patch-api coverage.
2. `vp run dogfood` green including new Pactum cases.
3. `HEXKIT_SKIP_COMPOSE=1 vp run dogfood-petstore-next` green.
4. Pet detail page offers Quick update wired to `updatePetWithForm`; full Edit still uses `updatePet`.
5. Tracker cells for `updatePetWithForm` are `partial` for Hono and Next.
