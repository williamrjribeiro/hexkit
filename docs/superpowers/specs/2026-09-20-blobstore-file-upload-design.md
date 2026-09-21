# Design: BlobStore port + Petstore `uploadFile`

**Status:** Approved — implementation plan ready  
**Date:** 2026-09-20  
**Tracker:** [docs/petstore-openapi-progress.md](../../petstore-openapi-progress.md) (Pet row: `uploadFile`)  
**Implementation plan:** [2026-09-20-blobstore-file-upload.md](../plans/2026-09-20-blobstore-file-upload.md)  
**Companions:** [PRD.md](../../../PRD.md) §5.0 / §11, [updatePetWithForm design](./2026-09-01-update-pet-with-form-design.md), [OpenAPI auth design](./2026-08-05-openapi-auth-design.md) (port pattern precedent), [RFC.md](../../../RFC.md)

## 1. Problem

Hexkit’s Petstore dogfood does not cover classic `uploadFile`
(`POST /pet/{petId}/uploadImage`). The progress tracker marks it **`missing`**
for both Hono and Next:

| operationId  | Method / path                   | Inputs                                                         | Response           |
| ------------ | ------------------------------- | -------------------------------------------------------------- | ------------------ |
| `uploadFile` | `POST /pet/{petId}/uploadImage` | Path `petId`; optional query `additionalMetadata`; binary body | `ApiResponse` JSON |

Official Swagger Petstore OAS 3.1 uses **`application/octet-stream`**
(`type: string`, `format: binary`) — not multipart. That matches the tracker
Notes column.

Today the generator stack cannot ship this operation because:

1. **Non-JSON request bodies are rejected or dropped.** Hexagonal
   `deriveParameters` throws on unsupported request bodies; shared HTTP wiring
   treats “not JSON” as “no body.”
2. **Binary storage must stay swappable.** Apps commonly store blobs in
   Postgres `bytea` _or_ object stores (S3). Baking `bytea` into the domain
   entity couples every upload use case to one backend.
3. **Use cases are single-repository passthroughs.** Upload needs
   orchestration: store bytes → persist metadata → return `ApiResponse`.
4. **Classic Petstore has no download route.** Verification must not invent
   new HTTP operations; dogfood proves the blob via **database assertions**.

## 2. Goals

1. Introduce a domain-agnostic **`BlobStore` port** (Authenticator-style) that
   use cases call when an operation has a binary request body.
2. Ship a **default Postgres `bytea` adapter** behind that port (Drizzle).
3. Persist **metadata only** on a normal aggregate (e.g. `PetImage` /
   fixture `Document`) with a `storageKey` string — not binary columns on the
   domain entity.
4. Generate working **Hono** then **Next** endpoints for `uploadFile` from
   OpenAPI without changing the classic Petstore HTTP surface.
5. Prove end-to-end with unit tests (generic fixture) + Pactum + **direct DB
   reads of the blob table** (no download route).
6. Deliver as **three stacked PRs** so Hono and Next can revert independently.
7. Move tracker `uploadFile` from `missing` → `partial` (binary + query +
   BlobStore; no `petstore_auth`).

## 3. Non-goals (this work)

- S3 / SST object-storage adapter (composition-root swap is the extension
  point; implement later with `@hexkit/plugin-sst` or a hand adapter).
- OAuth2 `petstore_auth` / scopes (Apical still marks oauth2 unenforceable;
  `shipped` bar stays blocked).
- Multipart / `multipart/form-data` uploads.
- `application/x-www-form-urlencoded` or XML.
- Any new classic-Petstore HTTP operation (no GET download / list images API).
- New `x-hexkit` OpenAPI extension keys (derive from media type + schema).
- Changing `apps/petstore-sample/openapi.yaml` (checked-in reference; PRD §3.1).

## 4. Approaches considered

### Approach A — Shared `BlobStore` port + metadata entity (chosen)

Generate one app-wide `BlobStore` port. Default adapter stores bytes in a
Drizzle `bytea` table and returns an opaque `storageKey`. Upload use cases
call `BlobStore.put`, then insert metadata (`storageKey`, FK, optional query
fields) via the aggregate repository, then return stub `ApiResponse`.

| Pros                                      | Cons                                            |
| ----------------------------------------- | ----------------------------------------------- |
| S3/local/DB are adapter swaps             | Use-case factories take two ports (new pattern) |
| Domain entities stay free of binary types | Need detection rules for “binary upload” ops    |
| Mirrors Authenticator port precedent      | Default blob table is infra, not OpenAPI schema |

### Approach B — `bytea` column on the domain entity (rejected)

Map `format: binary` properties to Drizzle `bytea` on `PetImage.content`.

| Pros               | Cons                                            |
| ------------------ | ----------------------------------------------- |
| Fewer moving parts | Locks storage into Postgres; hard to move to S3 |
|                    | Mixes transport bytes with domain persistence   |

### Approach C — Protected hand-written upload use case (rejected for dogfood bar)

Generate `BlobStore` + table only; leave `uploadFile` protected for humans.

| Pros                | Cons                                                  |
| ------------------- | ----------------------------------------------------- |
| Maximum flexibility | Breaks “fully generated adapters” dogfood expectation |

**Recommendation:** Approach A.

## 5. Recommended design

### 5.1 Delivery: three stacked PRs

| PR  | Branch base | Scope                                                                                                                        | Revert independence                                  |
| --- | ----------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | `main`      | `BlobStore` port, default `bytea` adapter, shared/hexagonal binary IR, generic `upload-api` fixture, package tests           | Leaves no Petstore dogfood change                    |
| 2   | PR1 branch  | `openapi.poc.yaml` `uploadFile` + `PetImage` + `ApiResponse`, Hono routes, Pactum + **DB blob assertion**, tracker Hono cell | Reverting drops Hono upload only; foundation remains |
| 3   | PR2 branch  | Next Route Handler / server-access regen (+ optional minimal fixture UI), tracker Next cell                                  | Reverting drops Next only; Hono dogfood stays green  |

Each PR must be independently reviewable and green for its own CI scope
(Quality for PR1; Quality + Dogfood API for PR2; Quality + Dogfood NextJS for PR3).

### 5.2 Architecture

```
HTTP adapter (Hono / Next)
  → uploadFile(petId, additionalMetadata?, body: Uint8Array)
       → BlobStore.put(body) → { key: string }
       → PetImageRepository.<op>(petId, storageKey, additionalMetadata?)
       → ApiResponse  (stub after successful insert)
```

**Ports**

| Port                 | Responsibility                               |
| -------------------- | -------------------------------------------- |
| `BlobStore`          | Opaque binary put/get/delete by `storageKey` |
| `PetImageRepository` | Metadata CRUD for the upload aggregate       |

**Adapters**

| Adapter                        | When                      |
| ------------------------------ | ------------------------- |
| `drizzle-blob-store` (`bytea`) | Default generated adapter |
| Future `s3-blob-store`         | Hand or SST plugin later  |

Composition root binds `BlobStore` like today’s `Authenticator`: one app-wide
instance injected into use-case factories that need it.

### 5.3 `BlobStore` port contract

Emitted at `src/core/ports/blob-store.ts` when **any** operation in the
contract has a binary request body (`application/octet-stream` with
`format: binary`, or equivalent Apical IR).

```ts
export type BlobPutResult = { key: string };

export type BlobStore = {
  put(bytes: Uint8Array): Promise<BlobPutResult>;
  get(key: string): Promise<Uint8Array | undefined>;
  delete(key: string): Promise<boolean>;
};
```

Rules:

- **`key`** is opaque to domain code (UUID string from the default adapter).
- **`put`** always allocates a new key (no overwrite API in v1).
- **`get` / `delete`** exist so adapters are complete and tests can assert
  round-trips **without** exposing HTTP download routes.
- Ownership: **generated** (regenerate-safe), same as `Authenticator`.

### 5.4 Default Postgres adapter

Emitted under `src/adapters/persistence/` (alongside Drizzle repos):

- Table name: `hexkit_blobs` (infra table — **not** derived from OpenAPI
  component schemas; plugins must not treat it as a domain aggregate).
- Columns: `key` (text PK), `content` (`bytea`, Drizzle `bytea(..., { mode: "buffer" })`).
- `put`: generate UUID key, insert `Buffer.from(bytes)`, return `{ key }`.
- `get` / `delete`: by key; map `Buffer` ↔ `Uint8Array`.

Catalog already pins `drizzle-orm@^0.45.2`, which ships first-class `bytea`.

Wire into the existing Drizzle DB client / Compose Postgres — no second
database.

### 5.5 Metadata aggregate (not the blob)

OpenAPI declares a persisted schema for upload **metadata**, e.g. Petstore:

```yaml
PetImage:
  type: object
  x-hexkit:
    persistence:
      table: pet_images
      identity: id
  required: [id, petId, storageKey]
  properties:
    id:
      type: integer
      format: int64
    petId:
      type: integer
      format: int64
      x-hexkit:
        reference: { schema: Pet, property: id }
    storageKey:
      type: string
    additionalMetadata:
      type: string
ApiResponse:
  type: object
  properties:
    code: { type: integer, format: int32 }
    type: { type: string }
    message: { type: string }
```

- **`storageKey`** holds the `BlobStore` key (string). Never `format: binary`
  on this entity.
- **`ApiResponse`** has **no** `x-hexkit.persistence` (response DTO only).
- Fixture mirror: `Document` + `ownerId` FK to `Widget` (or similar) in
  `apps/fixtures/upload-api/`.

### 5.6 Derivation rules (no new `x-hexkit` keys)

Use only existing extensions: `x-hexkit.persistence`,
`x-hexkit.operation.aggregate`, `x-hexkit.reference`.

An operation is a **binary upload use case** when:

1. Request body media includes `application/octet-stream` whose schema is
   `string` + `format: binary` (IR may surface this as a binary scalar media
   entry).
2. `x-hexkit.operation.aggregate` names a **persisted** schema (required
   because the JSON success schema is usually `ApiResponse`, not the entity).

Then:

| Input                      | Mapping                                                            |
| -------------------------- | ------------------------------------------------------------------ |
| Binary body                | First argument to `BlobStore.put` (typed `Uint8Array`)             |
| Path / query params        | Match **by name** to non-identity columns on the aggregate         |
| Implicit `storageKey`      | Filled by the use case from `put`’s result — **not** an HTTP input |
| Identity                   | Generated by DB / Drizzle on insert                                |
| Success schema ≠ aggregate | After successful metadata insert, return **stub** `ApiResponse`    |
| HTTP method POST           | Persistence kind `insert` (existing POST default; `uploadFile` ok) |

Generation-time errors:

- Binary body but aggregate missing or not persisted.
- Path/query name that does not match a column.
- Aggregate declares a `format: binary` property (forbidden — bytes belong in
  `BlobStore` only).
- Multiple octet-stream media entries on one operation.

Parent missing (e.g. unknown `petId`): metadata insert checks FK target exists
(select-by-id) and returns `undefined` when the contract declares **404**, so
controllers map to 404 — same dogfood style as other PoC writes. **Do not**
rely on raw Postgres FK errors for the happy HTTP mapping.

### 5.7 Hexagonal use-case shape (two ports)

Binary upload use cases are **not** thin repository passthroughs.

```ts
export type UploadFile = (
  petId: number,
  additionalMetadata: string | undefined,
  body: Uint8Array,
) => Promise<ApiResponse | undefined>;

export function createUploadFile(blobs: BlobStore, petImages: PetImageRepository): UploadFile {
  return async (petId, additionalMetadata, body) => {
    const { key } = await blobs.put(body);
    const saved = await petImages.uploadFile(petId, key, additionalMetadata);
    if (saved === undefined) return undefined; // 404
    return { code: 200, type: "unknown", message: additionalMetadata ?? "" };
  };
}
```

Notes:

- Repository method performs **metadata insert only** (path/query columns +
  `storageKey` argument). It does not see `Uint8Array`.
- Stub `ApiResponse` literals follow the same defaults as other non-entity
  stubs (`code: 200`, empty/unknown strings) unless/until richer stub object
  emit exists — keep consistent with Drizzle stub helpers.
- `storageKey` is a **use-case-produced** repository argument, not an HTTP
  parameter; shared `deriveUseCaseArgumentExpressions` passes HTTP-derived
  args into the use case; the use case supplies `key` internally.
- Factory signature change is limited to operations classified as binary
  upload; existing single-repo factories stay unchanged.
- Ownership remains **protected** for use-case files (today’s policy): first
  generation writes the orchestrating body; re-generation must not overwrite
  user edits. Plugin tests assert the **initial** generated body matches the
  template above. Dogfood relies on that first-generation output (same as
  other protected skeletons that already match repo passthrough).

### 5.8 Shared HTTP + adapters (binary body)

**Shared**

- Detect octet-stream media (parallel to `findJsonMedia`).
- Controller binding: `hasBinaryRequestBody`; success JSON unchanged.
- Use-case argument expressions: path → query → **binary body**
  (`request.value.body` as `Uint8Array`), never JSON parse.

**Hono**

- New helper: read `arrayBuffer` / raw body when content-type is
  `application/octet-stream` (trim/charset tolerant like JSON helper).
- Empty body → 400 when contract declares 400 / body required.
- Register `POST /pet/{petId}/uploadImage`.

**Next**

- Route Handler: same binary parse into `toApicalRequest` / controller path.
- `ServerAccess` binds `createUploadFile(blobs, petImages)`.
- RSC / form UI for upload is **out of this stack**. Route Handler +
  server-access regen is required in PR3. Generated write forms (including
  binary file inputs) are a separate follow-up:
  [Next Route Handlers design §11](./2026-08-11-nextjs-route-handlers-design.md)
  (POST/PUT/PATCH auto forms).

### 5.9 PoC contract addition (PR2)

Add to `apps/petstore-sample/openapi.poc.yaml` (do **not** edit
`openapi.yaml`):

```yaml
/pet/{petId}/uploadImage:
  post:
    operationId: uploadFile
    x-hexkit:
      operation:
        aggregate: PetImage
    parameters:
      - $ref: "#/components/parameters/PetId"
      - name: additionalMetadata
        in: query
        required: false
        schema:
          type: string
    requestBody:
      required: true
      content:
        application/octet-stream:
          schema:
            type: string
            format: binary
    responses:
      "200":
        description: successful operation
        content:
          application/json:
            schema:
              $ref: "#/components/schemas/ApiResponse"
      "400":
        description: No file uploaded / invalid input
      "404":
        description: Pet not found
```

Plus `PetImage` + `ApiResponse` component schemas as in §5.5.

- **No `petstore_auth`** on PoC (same as other Pet writes) → tracker `partial`.
- **404** is a PoC enrichment for consistent controller mapping.

### 5.10 Generic proof fixture (PR1)

Add `apps/fixtures/upload-api/openapi.yaml`:

| operationId      | Method / path                        | Notes                             |
| ---------------- | ------------------------------------ | --------------------------------- |
| `uploadDocument` | `POST /widgets/{widgetId}/documents` | Binary body; aggregate `Document` |
| `getWidgetById`  | `GET /widgets/{widgetId}`            | Seed/setup                        |

`Document`: `id`, `widgetId` (FK), `storageKey`, optional `additionalMetadata`.  
`Widget`: minimal persisted parent.  
`ApiResponse`-shaped success DTO (fixture-local name allowed, e.g.
`UploadReceipt`, as long as it is non-persisted JSON).

Used by hexagonal, drizzle, shared, Hono/Next unit tests — **no Petstore
strings** in plugin tests (PRD §5.0).

### 5.11 Dogfood / acceptance

**PR1 — package tests only**

- Derive + emit `BlobStore` port when fixture has binary body.
- Default adapter put/get round-trip in unit tests (in-memory DB or mocked
  Drizzle surface as existing plugin tests do).
- Use-case factory takes `(blobs, documents)`.
- Hono/Next plugin tests: binary request helper + route registration against
  fixture (no Compose).

**PR2 — Hono dogfood (`vp run dogfood:petstore:hono`)**

Pactum (HTTP) + DB assertion helper:

1. Create pet → `POST /pet/{id}/uploadImage` with `Content-Type:
application/octet-stream` and a known byte payload (+ optional query) →
   200 `ApiResponse`.
2. Open a SQL/Drizzle client against Compose Postgres → `hexkit_blobs`
   contains those exact bytes for the `storageKey` stored on `pet_images`.
3. Unknown `petId` → 404; empty body → 400.

**PR3 — Next (`vp run dogfood:petstore:nextjs`)**

Regenerate → ESLint + `next build`. Compose optional locally; CI keeps
`HEXKIT_SKIP_COMPOSE=1`.

### 5.12 Tracker update

| PR  | Cell                | Before  | After   |
| --- | ------------------- | ------- | ------- |
| 2   | `uploadFile` × Hono | missing | partial |
| 3   | `uploadFile` × Next | missing | partial |

Notes: binary octet-stream + BlobStore + metadata; still need
`petstore_auth`. Refresh Summary tallies + Last updated in the same PR as
each cell change.

## 6. Testing strategy

| Layer       | What                                                                    |
| ----------- | ----------------------------------------------------------------------- |
| Shared      | Octet-stream detection; body arg ordering; no JSON parse                |
| Hexagonal   | Binary upload classification; two-port factory; param typing            |
| Drizzle     | `bytea` blob adapter; metadata field-insert; missing parent → undefined |
| Hono / Next | Binary request helper; fixture route emit                               |
| Pactum + DB | §5.11 PR2 cases                                                         |
| Tracker     | Cells move only when that PR’s adapter is proven                        |

## 7. Risks & mitigations

| Risk                                      | Mitigation                                                     |
| ----------------------------------------- | -------------------------------------------------------------- |
| Protected use case overwritten / drifted  | Assert initial template in plugin tests; dogfood starts clean  |
| Accidental new HTTP download API          | Non-goal; DB assertion only                                    |
| New `x-hexkit` creep                      | Derivation rules in §5.6 only                                  |
| `bytea` driver encoding surprises         | Prefer Drizzle `mode: "buffer"`; assert byte equality in tests |
| Next broken ⇒ Hono revert                 | Stacked PRs (§5.1)                                             |
| Confusing infra table with domain schemas | Name `hexkit_blobs`; never emit OpenAPI schema for it          |
| Empty binary body accepted                | Required requestBody + 400 mapping                             |

## 8. Success criteria

1. PR1: `vp run --filter './packages/*' --filter './apps/cli' test` + `vp check` green with `upload-api` coverage; no Petstore contract change.
2. PR2: `vp run dogfood:petstore:hono` green; DB proves blob bytes; tracker Hono `uploadFile` = `partial`.
3. PR3: `vp run dogfood:petstore:nextjs` green (generate + lint + build); tracker Next `uploadFile` = `partial`.
4. Plugins contain no Petstore literals (PRD §5.0).
5. Classic Petstore HTTP surface for upload unchanged (no download route).
6. Swapping `BlobStore` binding does not require regenerating use-case **types** (adapter-only change for S3 later).
