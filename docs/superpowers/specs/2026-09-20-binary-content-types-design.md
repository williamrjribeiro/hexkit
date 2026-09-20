# Design: Binary request Content-Types (typed union)

**Status:** Approved — implementation plan ready  
**Date:** 2026-09-20  
**Stack:** Follow-up on BlobStore tip ([#51](https://github.com/williamrjribeiro/hexkit/pull/51) / `cursor/blobstore-next-upload-7f96`) — **do not rebase** #49–#51  
**Implementation plan:** [2026-09-20-binary-content-types.md](../plans/2026-09-20-binary-content-types.md)  
**Companions:** [BlobStore upload design](./2026-09-20-blobstore-file-upload-design.md), [PRD.md](../../../PRD.md) §5.0, [Next Route Handlers design](./2026-08-11-nextjs-route-handlers-design.md)

## 1. Problem

Hexkit’s BlobStore upload path only treats **`application/octet-stream`** +
`format: binary` as a binary request body. Apical Craft already:

- Preserves arbitrary OpenAPI media-type keys in `requestMap`
- Maps `type: string` + `format: binary` → `z.instanceof(Blob)` for any media type

but Hexkit shared/hexagonal/Hono/Next/drizzle still hardcode the octet-stream
predicate and pass a literal `"application/octet-stream"` into Apical wrappers.
Use cases receive only `Uint8Array` — no typed Content-Type.

Empty schemas such as `image/png: {}` appear in IR without a `type`, and Apical
omits them from `requestMap`, so they cannot be validated.

## 2. Goals

1. Treat **any** request media entry with `string` + `format: binary` as binary
   upload transport (png/jpeg/webp/octet-stream/…).
2. Derive a single **`RequestBodyTransport`** view in `@hexkit/shared` and
   consume it everywhere (replace leaky `hasJson` / `hasBinary` booleans over
   time, or map booleans from it for a small transition).
3. Pass a **typed `contentType` union** into hexagonal use cases alongside
   `body: Uint8Array`.
4. HTTP adapters validate the request `Content-Type` against the declared list
   and forward the **exact** declared key to Apical.
5. Prove with a domain-agnostic fixture (multi-CT binary) + package/CLI tests.
6. Keep `BlobStore.put(bytes)` MIME-agnostic (no persistence of MIME in this
   slice).

## 3. Non-goals

- Empty `content: { "image/png": {} }` (reject at generate time).
- XML, `application/x-www-form-urlencoded`, `multipart/form-data`.
- Persisting MIME on `BlobStore` / `hexkit_blobs` (follow-up when serving).
- PetShop fixture UI / generated RSC form pages for binary POST (defer until
  upload path is stable — see §7).
- Rebasing or rewriting BlobStore PRs #49–#51.

## 4. Approaches considered

### Approach A — Derived `RequestBodyTransport` in shared (chosen)

```ts
type RequestBodyTransport =
  | { kind: "none" }
  | { kind: "json"; contentTypes: readonly string[] /* schema via existing findJsonMedia */ }
  | { kind: "binary"; contentTypes: readonly [string, ...string[]] };
```

Binary = every `ContractMedia` with `type.kind === "string"` &&
`type.format === "binary"`. Multiple entries → union of keys.

### Approach B — Widen `findOctetStreamMedia` only

Drop the octet-stream equality check; bolt `contentType` onto adapters ad hoc.

Rejected: booleans stay leaky; multi-CT typing is second-class.

### Approach C — New media plugin

Rejected: YAGNI; data already lives on `ContractMedia[]`.

## 5. Recommended design

### 5.1 Delivery placement

| Order | PR              | Role                                                    |
| ----- | --------------- | ------------------------------------------------------- |
| 1–3   | #49 → #50 → #51 | BlobStore stack (octet-stream-only) — merge as-is       |
| **4** | **This work**   | Binary Content-Type generalization + typed use-case arg |

Base branch: tip of #51 (`cursor/blobstore-next-upload-7f96`) or `main` after
the stack merges.

### 5.2 Contract rules

| OpenAPI media entry                                       | Hexkit behavior                         |
| --------------------------------------------------------- | --------------------------------------- |
| `image/png: { schema: { type: string, format: binary } }` | Binary CT `"image/png"`                 |
| Multiple binary media entries                             | Allowed; `contentTypes` union           |
| `image/png: {}` (no schema)                               | **Generation error** with clear message |
| JSON + binary on one operation                            | **Generation error** (unchanged)        |
| `application/json` with schema                            | JSON transport (unchanged)              |

No new `x-hexkit` keys.

### 5.3 Shared derivation

Add in `packages/shared` (e.g. `request-body-transport.ts`):

```ts
export function deriveRequestBodyTransport(operation: ContractOperation): RequestBodyTransport;
```

Rules:

1. Collect binary media (string + format binary).
2. Collect JSON media via existing `findJsonMedia` / all typed JSON entries.
3. If both non-empty → throw.
4. If binary non-empty → `{ kind: "binary", contentTypes }`.
5. Else if JSON → `{ kind: "json", contentTypes }`.
6. Else → `{ kind: "none" }` (including typeless-only media → throw if
   `requestBody` present but no typed JSON/binary entry).

Deprecate direct use of `hasBinaryRequestBody` / `hasJsonRequestBody` in new
code; implement them as thin wrappers over `deriveRequestBodyTransport` for
compatibility during the transition, or update all call sites in the same PR
(preferred if the call-site set stays small).

### 5.4 Hexagonal use case / parameters

For `kind: "binary"`:

- Parameters include:
  - `contentType: "<ct1>" | "<ct2>" | …` (string literal union from
    `contentTypes`)
  - `body: Uint8Array`
- Path/query order unchanged: path → query → **contentType** → **body**
  (contentType before body so HTTP arg expressions stay obvious).
- `usesBlobStore` remains true for binary transport.
- Initial protected factory:

```ts
export function createUploadDocument(
  blobs: BlobStore,
  documents: DocumentRepository,
): UploadDocument {
  return async (widgetId, additionalMetadata, contentType, body) => {
    // contentType available for domain logic; BlobStore ignores MIME in v1
    void contentType;
    const { key } = await blobs.put(body);
    const saved = await documents.uploadDocument(widgetId, key, additionalMetadata);
    if (saved === undefined) return undefined;
    return { code: 200, type: "unknown", message: additionalMetadata ?? "" };
  };
}
```

Repository metadata insert unchanged (still path + `storageKey` + query).

### 5.5 HTTP adapters (Hono / Next)

- Replace hardcoded `contentType: "application/octet-stream"` with validation:
  normalize header (strip `;charset=…`), require membership in
  `contentTypes` (exact match after normalize; `startsWith` only if we document
  it — **prefer exact match** of the type/subtype).
- Pass the matched declared type into Apical `contentType` so `requestMap[ct]`
  hits.
- Empty body → 400 when required (unchanged).
- Generated helper types: `contentType` union of declared binary types (or
  `string` narrowed per operation in emitted source).

### 5.6 Drizzle

Replace local `isBinaryUploadOperation` octet-stream check with shared
`deriveRequestBodyTransport(...).kind === "binary"` (or `hasBinaryRequestBody`
wrapper). No schema/MIME column changes.

### 5.7 Fixture proof

Extend `apps/fixtures/upload-api/openapi.yaml` (or add a sibling media list on
`uploadDocument`):

```yaml
requestBody:
  required: true
  content:
    application/octet-stream:
      schema: { type: string, format: binary }
    image/png:
      schema: { type: string, format: binary }
    image/jpeg:
      schema: { type: string, format: binary }
```

Plugin + CLI tests assert:

- Use-case signature includes
  `contentType: "application/octet-stream" | "image/png" | "image/jpeg"`
- Generated Hono/Next binary helper accepts those headers and rejects
  `image/gif` / missing CT
- Empty-schema binary media fails normalize/derive with a clear error

Petstore `openapi.poc.yaml` may stay octet-stream-only in this PR; optional
follow-up to add image/* for dogfood realism.

### 5.8 Tracker

Only update `docs/petstore-openapi-progress.md` if the PoC contract gains
alternate binary media types. Otherwise a one-line note under uploadFile Notes
that Hono/Next accept any contract-declared binary CT (generator capability)
is enough when PoC still lists octet-stream alone.

## 6. Testing strategy

| Layer       | What                                                                        |
| ----------- | --------------------------------------------------------------------------- |
| Shared      | `deriveRequestBodyTransport` unit tests (multi-CT, empty `{}`, JSON+binary) |
| Hexagonal   | Param order + contentType union; load upload-api fixture                    |
| Hono / Next | Header allowlist; exact CT forwarded to Apical request shape                |
| Drizzle     | Still detects binary upload via shared helper                               |
| CLI         | Generate upload-api; assert signature + route helper strings                |

## 7. Deferred: Next showcase UI → subsumed by auto mutation forms

PetShop dogfood uses `--next-surface routes` + fixture overlay: Route Handlers
at literal OpenAPI paths; RSC resource pages are **GET-only** today.

A one-off binary upload page is **not** the follow-up. Instead, see the
normative requirement in
[Next Route Handlers design §11](./2026-08-11-nextjs-route-handlers-design.md):
auto-generate scaffold forms for **POST / PUT / PATCH** from contract inputs
(including `format: binary` → file input + Content-Type allowlist). Binary
upload UI is one media case of that generator.

This Content-Type / BlobStore stack does **not** implement that requirement.

## 8. Risks & mitigations

| Risk                            | Mitigation                                                                             |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| Break BlobStore dogfood         | Keep octet-stream as a valid binary CT; Petstore contract unchanged                    |
| Charset / parameter suffixes    | Strip `;…` before allowlist check                                                      |
| `void contentType` looks unused | Accept in v1 stub; domain may use later; avoid lint noise with explicit void or prefix |
| Large boolean→transport rewrite | Same PR if call sites are few; else thin wrappers                                      |

## 9. Success criteria

1. Multi-CT binary fixture generates and typechecks (Hono + Next).
2. Use case receives typed `contentType` + `Uint8Array`.
3. Undeclared Content-Type → 400 / Apical unsupported CT path.
4. Empty `{}` binary media → clear generation error.
5. Existing Petstore octet-stream upload dogfood remains green after stack merge.
6. No Petstore literals in plugin tests; no new `x-hexkit` keys.
