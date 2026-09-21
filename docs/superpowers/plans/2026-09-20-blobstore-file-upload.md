# BlobStore + Petstore `uploadFile` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a swappable `BlobStore` port (default Postgres `bytea` adapter), generate binary-upload use cases that store bytes then metadata, and ship Petstore `uploadFile` on Hono then Next as stacked PRs (tracker `partial`).

**Architecture:** Mirror `Authenticator`: emit `BlobStore` when any operation has `application/octet-stream` + `format: binary`. Default Drizzle adapter uses infra table `hexkit_blobs`. Upload use cases take `(blobs, aggregateRepo)`, call `put` → metadata insert with `storageKey` → stub `ApiResponse`. No new `x-hexkit` keys; no classic download HTTP route; prove blobs via DB assertions.

**Tech Stack:** TypeScript, Vite+ (`vp`), Vitest, Apical craft, Drizzle ORM (`bytea` / Buffer mode), Hono, Next App Router, PactumJS, Docker Compose, `psql`/`pg` for DB asserts.

**Spec:** [2026-09-20-blobstore-file-upload-design.md](../specs/2026-09-20-blobstore-file-upload-design.md)

## Global Constraints

- Plugins stay domain-agnostic (PRD §5.0). Plugin unit tests use `apps/fixtures/upload-api/` only — never Petstore strings.
- No new `x-hexkit` OpenAPI extension keys. Use existing `persistence`, `operation.aggregate`, `reference`.
- Classic Petstore HTTP surface unchanged: only `POST …/uploadImage`. No download/list image routes.
- No `petstore_auth`, multipart, XML, or form-urlencoded in this work.
- **Stacked PRs (mandatory):** PR1 foundation → PR2 Hono Petstore → PR3 Next. Each PR’s base is the previous branch. Reverting PR3 must leave Hono green; reverting PR2 must leave foundation usable.
- TDD: failing test → minimal implementation → focused package test → commit.
- Do not combine `vp --filter` with `-r`. Build before tests:
  `vp run --filter './packages/*' --filter './apps/cli' build`
- Conventional Commits per task.
- Update `docs/petstore-openapi-progress.md` in the **same PR** that changes Hono/Next upload support.
- Do not edit `apps/petstore-sample/openapi.yaml` (checked-in reference).

## Stacked PR map

| PR  | Branch (suggested)                  | Base       | Delivers                                                                 |
| --- | ----------------------------------- | ---------- | ------------------------------------------------------------------------ |
| 1   | `cursor/blobstore-foundation-7f96`  | `main`     | Fixture + shared/hex/drizzle/hono/next binary + BlobStore; package tests |
| 2   | `cursor/blobstore-hono-upload-7f96` | PR1 branch | `openapi.poc.yaml` + Hono dogfood + DB assert + tracker Hono cell        |
| 3   | `cursor/blobstore-next-upload-7f96` | PR2 branch | Next regen (Route Handlers + DAL; no form UI) + tracker Next cell        |

Open each PR against its base branch (not all against `main`). Merge bottom-up.

## File structure (planned touch list)

| Path                                                                     | Role                                            | PR    |
| ------------------------------------------------------------------------ | ----------------------------------------------- | ----- |
| `apps/fixtures/upload-api/openapi.yaml`                                  | Generic Widget/Document binary upload contract  | 1     |
| `packages/shared/src/media.ts`                                           | `findOctetStreamMedia` / `hasBinaryRequestBody` | 1     |
| `packages/shared/src/use-case-args.ts`                                   | Append binary body expression                   | 1     |
| `packages/shared/src/controller-binding.ts`                              | `hasBinaryRequestBody` on binding               | 1     |
| `packages/plugin-architecture-hexagonal/src/generate/blob-store-port.ts` | Emit `BlobStore` port                           | 1     |
| `packages/plugin-architecture-hexagonal/src/generate/use-case.ts`        | Two-port binary upload factory                  | 1     |
| `packages/plugin-architecture-hexagonal/src/model/parameters.ts`         | Allow binary body → `Uint8Array` param          | 1     |
| `packages/plugin-drizzle/src/generate/blob-store.ts`                     | Default `hexkit_blobs` adapter                  | 1     |
| `packages/plugin-drizzle/src/generate/repository.ts`                     | Metadata insert (path/query + storageKey)       | 1     |
| `packages/plugin-hono/src/generate/routes/static-runtime.ts`             | Binary request helper                           | 1     |
| `packages/plugin-hono/src/generate/runtime.ts`                           | Bind `BlobStore` like authenticator             | 1     |
| `packages/plugin-next/src/generate/helpers.ts`                           | Binary body into `toApicalRequest`              | 1     |
| `packages/plugin-next/src/generate/runtime.ts`                           | Bind `BlobStore`                                | 1     |
| `apps/cli/src/upload-generation.test.ts`                                 | E2E generate on upload-api                      | 1     |
| `apps/petstore-sample/openapi.poc.yaml`                                  | `uploadFile` + `PetImage` + `ApiResponse`       | 2     |
| `apps/petstore-sample/tests/api/pet/post-upload.test.ts`                 | Pactum upload cases                             | 2     |
| `apps/petstore-sample/tests/api/helpers/blob-db.ts`                      | Compose DB blob assertion                       | 2     |
| `docs/petstore-openapi-progress.md`                                      | Hono then Next `partial`                        | 2 / 3 |
| `apps/petstore-next/**` (generated; form UI is a later follow-up)        | Route Handler / server-access                   | 3     |

---

# PR 1 — Foundation (`BlobStore` + fixture)

### Task 1: Generic `upload-api` fixture contract

**Files:**

- Create: `apps/fixtures/upload-api/openapi.yaml`

**Interfaces:**

- Produces: OpenAPI 3.1 with persisted `Widget` + `Document` (`storageKey` string, FK `widgetId`), non-persisted `UploadReceipt`, `POST /widgets/{widgetId}/documents` (`uploadDocument`, aggregate `Document`), `GET /widgets/{widgetId}`.

- [ ] **Step 1: Write the fixture**

```yaml
openapi: 3.1.0
info:
  title: Upload API Fixture
  version: 1.0.0
paths:
  /widgets/{widgetId}:
    get:
      operationId: getWidgetById
      parameters:
        - name: widgetId
          in: path
          required: true
          schema: { type: string }
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Widget"
        "404":
          description: missing
  /widgets/{widgetId}/documents:
    post:
      operationId: uploadDocument
      x-hexkit:
        operation:
          aggregate: Document
      parameters:
        - name: widgetId
          in: path
          required: true
          schema: { type: string }
        - name: additionalMetadata
          in: query
          required: false
          schema: { type: string }
      requestBody:
        required: true
        content:
          application/octet-stream:
            schema:
              type: string
              format: binary
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/UploadReceipt"
        "400":
          description: empty or invalid
        "404":
          description: widget missing
components:
  schemas:
    Widget:
      type: object
      x-hexkit:
        persistence:
          table: widgets
          identity: id
      required: [id, name]
      properties:
        id: { type: string }
        name: { type: string }
    Document:
      type: object
      x-hexkit:
        persistence:
          table: documents
          identity: id
      required: [id, widgetId, storageKey]
      properties:
        id: { type: string }
        widgetId:
          type: string
          x-hexkit:
            reference: { schema: Widget, property: id }
        storageKey: { type: string }
        additionalMetadata: { type: string }
    UploadReceipt:
      type: object
      properties:
        code: { type: integer }
        type: { type: string }
        message: { type: string }
```

- [ ] **Step 2: Commit**

```bash
git add apps/fixtures/upload-api/openapi.yaml
git commit -m "test(fixture): add upload-api binary body contract"
```

---

### Task 2: Shared — detect octet-stream media

**Files:**

- Modify: `packages/shared/src/media.ts`
- Modify: `packages/shared/src/media.test.ts`
- Modify: `packages/shared/src/index.ts` (re-export)
- Modify: `packages/shared/src/controller-binding.ts`
- Modify: `packages/shared/src/use-case-args.ts`
- Test: `packages/shared/src/use-case-args.test.ts` (create or extend)
- Test: `packages/shared/src/controller-binding.test.ts` (extend if present)

**Interfaces:**

- Produces:
  - `findOctetStreamMedia(media): ContractMedia | undefined`
  - `hasBinaryRequestBody(operation): boolean`
  - `deriveUseCaseArgumentExpressions(useCase, { hasJsonRequestBody, hasBinaryRequestBody })` appends body when binary
  - `HttpControllerBinding.hasBinaryRequestBody: boolean`

- [ ] **Step 1: Write failing tests in `media.test.ts`**

```ts
it("finds application/octet-stream media with binary schema", () => {
  const media = findOctetStreamMedia([
    {
      mediaType: "application/octet-stream",
      type: { kind: "string", format: "binary" },
    },
  ]);
  expect(media?.mediaType).toBe("application/octet-stream");
});

it("hasBinaryRequestBody is true for octet-stream operations", () => {
  expect(
    hasBinaryRequestBody({
      operationId: "uploadDocument",
      method: "post",
      path: "/widgets/{widgetId}/documents",
      requestBody: {
        required: true,
        media: [
          {
            mediaType: "application/octet-stream",
            type: { kind: "string", format: "binary" },
          },
        ],
      },
      responses: [],
      // ...minimal required ContractOperation fields per existing test helpers
    } as ContractOperation),
  ).toBe(true);
});
```

Adapt the operation fixture to match existing `ContractOperation` builders in shared tests.

- [ ] **Step 2: Run test — expect FAIL**

```bash
vp run --filter './packages/*' --filter './apps/cli' build
vp run --filter @hexkit/shared test
```

Expected: `findOctetStreamMedia` / `hasBinaryRequestBody` not found.

- [ ] **Step 3: Implement media helpers**

```ts
export function findOctetStreamMedia(
  media: readonly ContractMedia[] | undefined,
): ContractMedia | undefined {
  return media?.find(
    (entry) =>
      entry.mediaType === "application/octet-stream" &&
      entry.type?.kind === "string" &&
      entry.type.format === "binary",
  );
}

export function hasBinaryRequestBody(operation: ContractOperation): boolean {
  return findOctetStreamMedia(operation.requestBody?.media) !== undefined;
}
```

- [ ] **Step 4: Extend argument + binding**

In `deriveUseCaseArgumentExpressions`, after path/query (and auth if any), when `hasBinaryRequestBody` and not JSON:

```ts
expressions.push("request.value.body");
```

In `deriveHttpControllerBinding`, set `hasBinaryRequestBody: hasBinaryRequestBody(operation)` (never both JSON and binary on one op — throw if both).

- [ ] **Step 5: Re-run shared tests — expect PASS; commit**

```bash
vp run --filter @hexkit/shared test
git add packages/shared
git commit -m "feat(shared): detect octet-stream binary request bodies"
```

---

### Task 3: Hexagonal — binary body params + `BlobStore` port + two-port use case

**Files:**

- Modify: `packages/plugin-architecture-hexagonal/src/model/parameters.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/model/derive.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/artifact.ts` (BlobStore port type)
- Create: `packages/plugin-architecture-hexagonal/src/generate/blob-store-port.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/generate/files.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/generate/use-case.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/model/use-case.ts` (flag `usesBlobStore`)
- Test: `packages/plugin-architecture-hexagonal/src/model/parameters.test.ts`
- Test: `packages/plugin-architecture-hexagonal/src/generate/use-case` / `plugin.test.ts`

**Interfaces:**

- Consumes: `findOctetStreamMedia` / `hasBinaryRequestBody` from `@hexkit/shared`
- Produces:
  - Binary body parameter: `{ name: "body", typeExpression: "Uint8Array", location: "body" }`
  - `blobStorePort?: { name: "BlobStore"; filePath: "src/core/ports/blob-store.ts" }` when any op needs it
  - Use-case factory: `createUploadDocument(blobs: BlobStore, documents: DocumentRepository)`
  - Initial protected body orchestrates put → repo → stub receipt

- [ ] **Step 1: Failing test — binary body no longer throws**

```ts
it("when request body is octet-stream binary, then body param is Uint8Array", () => {
  const { parameters } = deriveParameters(uploadDocumentOperation);
  expect(parameters.some((p) => p.name === "body" && p.typeExpression === "Uint8Array")).toBe(true);
});
```

- [ ] **Step 2: Run — expect FAIL (unsupported request body)**

```bash
vp run --filter @hexkit/plugin-architecture-hexagonal test
```

- [ ] **Step 3: Fix `deriveParameters`**

Replace JSON-only gate with:

```ts
const jsonMedia = findJsonMedia(operation.requestBody?.media);
const binaryMedia = findOctetStreamMedia(operation.requestBody?.media);

if (operation.requestBody !== undefined && jsonMedia === undefined && binaryMedia === undefined) {
  throw new Error(
    `Operation "${operation.operationId}" declares an unsupported request body. Hexagonal generation supports application/json or application/octet-stream (format: binary).`,
  );
}

if (jsonMedia !== undefined && binaryMedia !== undefined) {
  throw new Error(
    `Operation "${operation.operationId}" declares both JSON and octet-stream request bodies.`,
  );
}

// existing JSON body → entity/schema param path when jsonMedia
// when binaryMedia: push { name: "body", typeExpression: "Uint8Array", location: "body" }
```

Reject aggregates that declare any `format: binary` property (generation error citing BlobStore).

- [ ] **Step 4: Emit BlobStore port file**

`blob-store-port.ts`:

```ts
export function renderBlobStorePortFile(): GeneratedFile {
  return {
    path: "src/core/ports/blob-store.ts",
    ownership: "generated",
    contents: `export type BlobPutResult = { key: string };

export type BlobStore = {
  put(bytes: Uint8Array): Promise<BlobPutResult>;
  get(key: string): Promise<Uint8Array | undefined>;
  delete(key: string): Promise<boolean>;
};
`,
  };
}
```

Wire in `deriveApplicationModel` when any use case `usesBlobStore` (binary body + persisted aggregate).

- [ ] **Step 5: Two-port use-case render**

When `useCase.usesBlobStore`:

```ts
export function createUploadDocument(
  blobs: BlobStore,
  documents: DocumentRepository,
): UploadDocument {
  return async (widgetId, additionalMetadata, body) => {
    const { key } = await blobs.put(body);
    const saved = await documents.uploadDocument(widgetId, key, additionalMetadata);
    if (saved === undefined) return undefined;
    return { code: 200, type: "unknown", message: additionalMetadata ?? "" };
  };
}
```

Parameter order: path → query → body (match HTTP arg expressions). Repository method args: path/query columns + `storageKey` (`key`) — **not** raw `body`.

Mark `usesBlobStore` use cases so repository method signature is metadata insert (see Task 4), not entity-body insert.

- [ ] **Step 6: Tests PASS; commit**

```bash
vp run --filter @hexkit/plugin-architecture-hexagonal test
git add packages/plugin-architecture-hexagonal
git commit -m "feat(hexagonal): BlobStore port and binary upload use cases"
```

---

### Task 4: Drizzle — `hexkit_blobs` adapter + metadata insert

**Files:**

- Create: `packages/plugin-drizzle/src/generate/blob-store.ts`
- Modify: `packages/plugin-drizzle/src/generate/files.ts` (or plugin entry that emits adapters)
- Modify: `packages/plugin-drizzle/src/generate/repository.ts`
- Create: `packages/plugin-drizzle/src/generate/metadata-insert.ts` (or extend repository)
- Modify: `packages/plugin-drizzle/src/model/column.ts` only if needed for domain columns (domain must NOT use bytea)
- Test: `packages/plugin-drizzle/src/plugin.test.ts` / new `blob-store.test.ts`

**Interfaces:**

- Consumes: hexagonal artifact `blobStorePort` presence
- Produces:
  - `src/adapters/persistence/drizzle-blob-store.ts` with `createDrizzleBlobStore(db)`
  - Schema snippet / migration SQL for `hexkit_blobs(key text PK, content bytea NOT NULL)`
  - Metadata insert method: path identity/FK + `storageKey` + optional query fields; parent missing → `undefined` when return allows it

- [ ] **Step 1: Failing test — blob adapter put/get**

```ts
it("emits drizzle blob store with bytea content column", () => {
  const file = renderDrizzleBlobStoreFile();
  expect(file.contents).toContain("bytea");
  expect(file.contents).toContain("hexkit_blobs");
  expect(file.contents).toContain("createDrizzleBlobStore");
});
```

- [ ] **Step 2: Implement adapter emit**

```ts
// illustrative emitted shape
import { pgTable, text, bytea } from "drizzle-orm/pg-core";

export const hexkitBlobs = pgTable("hexkit_blobs", {
  key: text("key").primaryKey(),
  content: bytea("content", { mode: "buffer" }).notNull(),
});

export function createDrizzleBlobStore(db: /* existing db type */): BlobStore {
  return {
    async put(bytes) {
      const key = crypto.randomUUID();
      await db.insert(hexkitBlobs).values({ key, content: Buffer.from(bytes) });
      return { key };
    },
    async get(key) {
      const [row] = await db.select().from(hexkitBlobs).where(eq(hexkitBlobs.key, key)).limit(1);
      return row ? new Uint8Array(row.content) : undefined;
    },
    async delete(key) {
      const deleted = await db.delete(hexkitBlobs).where(eq(hexkitBlobs.key, key)).returning();
      return deleted.length > 0;
    },
  };
}
```

Follow existing Drizzle plugin patterns for `db` typing and SQL migration emission (extend packaging migration list to include `hexkit_blobs` when BlobStore is present).

- [ ] **Step 3: Metadata insert emit**

Detect methods where parameters are: located path/query params + `storageKey: string` (no entity body, no `Uint8Array`). Emit:

```ts
async uploadDocument(
  widgetId: string,
  storageKey: string,
  additionalMetadata: string | undefined,
): Promise<UploadReceipt | undefined> { // or Document | undefined per return type
  const [parent] = await db.select().from(widgets).where(eq(widgets.id, widgetId)).limit(1);
  if (!parent) return undefined;
  await db.insert(documents).values({
    id: /* identity strategy already used by plugin */,
    widgetId,
    storageKey,
    ...(additionalMetadata !== undefined ? { additionalMetadata } : {}),
  });
  // For non-aggregate JSON return (UploadReceipt), return stub object OR void and let use case stub.
  // Prefer: repository returns Document | undefined; use case maps to UploadReceipt.
}
```

Align with design: repository returns entity `| undefined`; use case stubs `UploadReceipt` / `ApiResponse`. Adjust return type derivation so binary-upload repo methods return `Aggregate | undefined` when 404 is declared (even if HTTP success schema is receipt).

If current hexagonal return type is `UploadReceipt`, either:

- Override persistence method return to `Document | undefined` for blob uploads, or
- Keep receipt return and stub inside repository after insert.

**Prefer:** repository returns `Document | undefined`; use case stubs receipt (cleaner). Update hexagonal `deriveReturnType` / repository method model for `usesBlobStore` ops accordingly.

- [ ] **Step 4: Tests PASS; commit**

```bash
vp run --filter @hexkit/plugin-drizzle test
git add packages/plugin-drizzle
git commit -m "feat(drizzle): bytea BlobStore adapter and metadata insert"
```

---

### Task 5: Hono + Next — binary helpers and BlobStore runtime bind

**Files:**

- Modify: `packages/plugin-hono/src/generate/routes/static-runtime.ts`
- Modify: `packages/plugin-hono/src/generate/routes/registrations.ts`
- Modify: `packages/plugin-hono/src/generate/runtime.ts`
- Modify: `packages/plugin-hono/src/artifact.ts` / `model/derive.ts`
- Modify: `packages/plugin-next/src/generate/helpers.ts`
- Modify: `packages/plugin-next/src/generate/runtime.ts`
- Modify: `packages/plugin-next/src/generate/routes.ts` (if needed)
- Tests: Hono/Next plugin tests using `upload-api`

**Interfaces:**

- Produces: `binaryRequest` helper; `createApp(repos, authenticator?, blobStore = createDrizzleBlobStore(db))` pattern; Next `composeRuntime` default blob store

- [ ] **Step 1: Failing Hono test — registration uses binary helper for upload-api**

Assert generated route file contains `octet-stream` / `arrayBuffer` / `Uint8Array` handling for `uploadDocument`.

- [ ] **Step 2: Implement Hono binary helper**

```ts
async function binaryRequest(context: Context, /* schemas */): Promise<ApicalRequest> {
  const contentType = context.req.header("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/octet-stream")) {
    // map to 400 content-type error consistent with jsonRequest
  }
  const buffer = await context.req.arrayBuffer();
  const body = new Uint8Array(buffer);
  if (body.byteLength === 0) {
    // 400 empty body when required
  }
  return request(context, /* path/query/headers */, body);
}
```

Wire `ApicalRequest` body typing beyond `"application/json"`-only if currently constrained.

- [ ] **Step 3: Runtime bind BlobStore**

Mirror authenticator optional arg on `createApp` / `composeRuntime`. Pass `blobs` into `createUploadDocument(blobs, documents)`.

- [ ] **Step 4: Next `toApicalRequest`**

```ts
options: { jsonBody: boolean; binaryBody?: boolean; arrayQueryKeys?: ... }
// when binaryBody: body = new Uint8Array(await request.arrayBuffer())
```

- [ ] **Step 5: Tests PASS; commit**

```bash
vp run --filter @hexkit/plugin-hono test
vp run --filter @hexkit/plugin-next test
git add packages/plugin-hono packages/plugin-next
git commit -m "feat(http): binary request helpers and BlobStore runtime binding"
```

---

### Task 6: CLI generate proof on `upload-api` + PR1 gate

**Files:**

- Create: `apps/cli/src/upload-generation.test.ts`

- [ ] **Step 1: Test generate Hono + Next from fixture**

Assert output includes:

- `src/core/ports/blob-store.ts`
- `src/adapters/persistence/drizzle-blob-store.ts` (path as implemented)
- `createUploadDocument` taking `BlobStore` + `DocumentRepository`
- Route for `POST /widgets/{widgetId}/documents`

- [ ] **Step 2: Run**

```bash
vp run --filter './packages/*' --filter './apps/cli' build
vp run --filter @hexkit/cli test
vp check
vp run --filter './packages/*' --filter './apps/cli' test
```

- [ ] **Step 3: Open PR1** against `main` with title/body noting foundation-only (no Petstore tracker change yet). Commit any fixes.

```bash
git commit -m "test(cli): prove upload-api generation emits BlobStore"
```

---

# PR 2 — Hono Petstore `uploadFile`

Base branch: PR1. Create `cursor/blobstore-hono-upload-7f96`.

### Task 7: Expand `openapi.poc.yaml`

**Files:**

- Modify: `apps/petstore-sample/openapi.poc.yaml`

- [ ] **Step 1: Add schemas `PetImage` + `ApiResponse` and path `POST /pet/{petId}/uploadImage`** exactly as design §5.9 / §5.5 (aggregate `PetImage`, no oauth, 400/404).

- [ ] **Step 2: Commit**

```bash
git add apps/petstore-sample/openapi.poc.yaml
git commit -m "feat(petstore): add uploadFile and PetImage to PoC contract"
```

---

### Task 8: Pactum + DB blob assertion

**Files:**

- Create: `apps/petstore-sample/tests/api/helpers/blob-db.ts`
- Create: `apps/petstore-sample/tests/api/pet/post-upload.test.ts`
- Modify: dogfood/`package.json` deps if `pg` client needed for asserts
- Modify: generation expectation tests under `apps/petstore-sample/tests/` and `apps/cli` as required

- [ ] **Step 1: DB helper**

```ts
import pg from "pg";

export async function readBlobByPetImagePetId(
  databaseUrl: string,
  petId: number,
): Promise<Uint8Array | undefined> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const meta = await client.query(
      `select storage_key from pet_images where pet_id = $1 order by id desc limit 1`,
      [petId],
    );
    const key = meta.rows[0]?.storage_key as string | undefined;
    if (!key) return undefined;
    const blob = await client.query(`select content from hexkit_blobs where key = $1`, [key]);
    const content = blob.rows[0]?.content as Buffer | undefined;
    return content ? new Uint8Array(content) : undefined;
  } finally {
    await client.end();
  }
}
```

Use actual snake_case column names emitted by Drizzle plugin.

- [ ] **Step 2: Pactum cases**

1. Add pet → upload known bytes (`Buffer.from("hexkit-upload-fixture")`) with `Content-Type: application/octet-stream` → 200 `ApiResponse`.
2. `readBlobByPetImagePetId` equals those bytes.
3. Optional query `additionalMetadata` reflected in `ApiResponse.message`.
4. Unknown petId → 404.
5. Empty body → 400.

- [ ] **Step 3: Run dogfood**

```bash
vp run --filter './packages/*' --filter './apps/cli' build
vp run dogfood:petstore:hono
```

- [ ] **Step 4: Tracker + commit + open PR2** (base = PR1 branch)

Update `docs/petstore-openapi-progress.md`: Hono `uploadFile` `missing` → `partial`; refresh tallies + Last updated.

```bash
git add apps/petstore-sample docs/petstore-openapi-progress.md
git commit -m "feat(petstore): Hono uploadFile dogfood with DB blob proof"
```

---

# PR 3 — Next Petstore `uploadFile`

Base branch: PR2. Create `cursor/blobstore-next-upload-7f96`.

### Task 9: Regenerate Next dogfood + tracker

**Files:**

- Regenerate: `apps/petstore-next` Route Handlers / server-access / runtime (via dogfood script)
- Optional: small fixture-owned file input on pet detail (no new API routes)
- Modify: `docs/petstore-openapi-progress.md` Next cell
- Modify: `apps/cli/src/next-generation.test.ts` expectations if needed

- [ ] **Step 1: Run Next dogfood**

```bash
vp run --filter './packages/*' --filter './apps/cli' build
HEXKIT_SKIP_COMPOSE=1 vp run dogfood:petstore:nextjs
```

- [ ] **Step 2: Assert generated `app/pet/[petId]/uploadImage/route.ts` (or nested path) exists and binds BlobStore**

- [ ] **Step 3: Tracker Next `uploadFile` → `partial`; commit; open PR3** (base = PR2)

```bash
git add apps/petstore-next docs/petstore-openapi-progress.md apps/cli
git commit -m "feat(petstore-next): regenerate uploadFile Route Handlers"
```

---

## Self-review checklist (agents)

- [ ] Spec §5.1 stacked PRs honored (three PRs, correct bases)
- [ ] No download HTTP route added
- [ ] No new `x-hexkit` keys
- [ ] No Petstore literals in `packages/**` tests
- [ ] Tracker updated only in PR2/PR3 for the matching adapter
- [ ] `vp check` + filtered tests green before each PR open

## Execution handoff

**Plan complete.** Implement with stacked PRs:

1. **Subagent-Driven (recommended)** — one subagent per task; merge/open PR after Task 6, 8, 9
2. **Inline Execution** — same task order in-session with checkpoints at each PR boundary

Start at Task 1 on branch `cursor/blobstore-foundation-7f96` from latest `main` (after this docs PR merges, or stack docs→foundation if still open).
