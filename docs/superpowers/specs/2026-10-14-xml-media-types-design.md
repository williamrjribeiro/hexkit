# Design: XML request/response media types (`application/xml`)

**Status:** Approved — implementation underway
**Date:** 2026-10-14
**Stack:** 3 stacked PRs — PR1 (capability, base `main`) → PR2 (Hono Petstore dogfood) → PR3 (Next dogfood + tracker)
**Implementation plan:** [2026-10-14-xml-media-types.md](../plans/2026-10-14-xml-media-types.md)
**Companions:** [Binary content-types design](./2026-09-20-binary-content-types-design.md), [PRD.md](../../../PRD.md) §5.0, [Petstore tracker](../../petstore-openapi-progress.md)

## 1. Problem

Three Petstore operations in `apps/petstore-sample/openapi.yaml` declare
`application/xml` alongside `application/json` on the same request/response
bodies (`PUT /pet`, `POST /pet`, `GET /pet/{petId}`), but Hexkit's HTTP
adapters are JSON-only:

- `@hexkit/shared` `deriveRequestBodyTransport` throws on an XML-only body and
  has no notion of XML media; `findJsonMedia` ignores `application/xml` entries.
- Hono/Next request helpers hardcode JSON (`jsonRequest`) or binary
  (`binaryRequest`); a mixed JSON+XML body has no helper at all.
- `respond` / `handleControllerResult` always serialize success data as JSON —
  an `Accept: application/xml` request silently gets JSON.
- No XML library exists anywhere in the repo or in emitted app manifests.

Verified: Apical Craft already keys `requestMap` / `responseMap` by the exact
media type string, so `requestMap["application/xml"]` validation works with
**zero contract-layer changes**. All the JSON assumptions live in shared +
architectural + adapter plugins.

## 2. Goals

1. Accept `application/xml` request bodies wherever the contract declares them
   (XML-only **and** JSON+XML alternate media on one body), validating the
   request `Content-Type` against the declared list and forwarding the exact
   declared key to the Apical wrapper.
2. Serialize success responses as XML when (and only when) the contract
   declares `application/xml` on that response **and** the request `Accept`
   header prefers it; JSON stays the default (`*/*` or absent → JSON).
3. Keep everything **domain-agnostic**: the XML root element name derives from
   the contract schema `$ref` name — no Petstore literals in plugins (the
   banned-literal scanners enforce this).
4. Prove with a new `apps/fixtures/xml-api` fixture, package unit tests, CLI
   generation tests, a generated-app `tsc` type check, and (PR2) Pactum E2E
   tests against the dogfood app.
5. Emit `fast-xml-parser` into every generated app manifest (pinned) and add it
   to the workspace catalog for repo-side type checks.

## 3. Non-goals

- Schema-level `xml:` object features (`name`, `wrapped`, namespaces,
  attribute mapping). XML documents are a faithful rendering of the contract's
  **JSON shape**: objects nest, arrays repeat the element, scalars become text.
- XML-only **success** responses (no JSON media on the response). Return-type
  derivation keeps using JSON media; without JSON the use case stays `void`.
- `text/xml`, `multipart/form-data`, `application/x-www-form-urlencoded`.
- Error bodies as XML — error envelopes stay JSON (`400`/`401`/`500`).
- `Accept` header q-factor weighting / media-range parsing beyond a
  comma-separated type list (see §8).
- Changes to `apps/petstore-next/**` (CI only stays green on regeneration).
- The auto mutation-form requirement in
  [Next Route Handlers design §11](./2026-08-11-nextjs-route-handlers-design.md).

## 4. Approaches considered

### Approach A — Extend `RequestBodyTransport` with XML kinds (chosen)

```ts
type RequestBodyTransport =
  | { kind: "none" }
  | { kind: "json"; contentTypes: readonly string[]; xmlContentTypes?: readonly string[] }
  | { kind: "xml"; contentTypes: readonly [string, ...string[]] }
  | { kind: "binary"; contentTypes: readonly [string, ...string[]] };
```

XML is detected by **media type** (`application/xml`, parameters stripped,
case-insensitive) on typed entries; binary keeps detection by **schema shape**
(`string` + `format: binary`). JSON+XML on one body stays one transport
(`kind: "json"` + `xmlContentTypes`) so the mixed case shares the JSON use-case
and response derivation.

### Approach B — Separate `xmlContentTypes` side-channel per adapter

Rejected: repeats the leaky-boolean history of `hasJson`/`hasBinary` that the
binary design already replaced with a single derived transport.

### Approach C — Always-on XML runtime in every generated app

Rejected: JSON-only apps would import `fast-xml-parser` for dead code. The XML
runtime statements, helpers, types, and import are emitted only when at least
one operation `usesXmlMedia`.

## 5. Recommended design

### 5.1 Contract rules

| OpenAPI media entry                                  | Hexkit behavior                                           |
| ---------------------------------------------------- | --------------------------------------------------------- |
| `application/xml` typed, alone                       | XML transport (`kind: "xml"`)                             |
| `application/json` + `application/xml` on one body   | JSON transport + `xmlContentTypes` (mixed `typedRequest`) |
| `application/xml; charset=utf-8` / `Application/XML` | Detected case-insensitively; raw key kept for validation  |
| JSON or XML + binary on one body                     | **Generation error** (unchanged binary mixing rule)       |
| `application/xml: {}` (no schema)                    | Ignored (no typed entry → not XML transport)              |
| Success response with `application/xml` + `$ref`     | `successXmlRootName` = schema name (root element)         |
| Success response with inline object schema           | No XML serialization for that operation (no name)         |
| Response `4xx`/`5xx`                                 | Always JSON error envelope                                |

No new `x-hexkit` keys.

### 5.2 Shared (`@hexkit/shared`)

- `media-type.ts` — `isXmlMediaType(mediaType)` (type/subtype before `;`,
  trimmed, lowercased, exactly `application/xml`). Own module so
  `media.ts` → `request-body-transport.ts` does not cycle.
- `media.ts` — `findXmlMedia`, `hasXmlRequestBody`, re-export
  `isXmlMediaType`.
- `request-body-transport.ts` — rules from §5.1; XML+binary and JSON+binary
  both throw; error message names all three transports.
- `controller-binding.ts` — new binding fields:
  - `hasXmlRequestBody` (XML-only or mixed),
  - `successXmlRootName` (first typed XML success media whose type is a
    `reference` → `type.schema`),
  - transport passed through unchanged; `deriveUseCaseArgumentExpressions`
    gains `hasXmlRequestBody` so XML-only bodies emit `request.value.body`.
- `render-controllers.ts` — validation branch also requires the body when
  `hasXmlRequestBody`; success results gain `xmlRoot: "<Schema>"` when bound.
- `render-xml.ts` — `renderXmlRuntimeStatements()` emits the shared runtime
  (parser/builder instances, `parseXmlPayload`, `serializeXmlPayload`,
  `prefersXmlResponse`), `XML_RUNTIME_IMPORT` (fast-xml-parser), and
  `usesXmlMedia(binding)` (the single adapter-facing predicate).

`parseXmlPayload` strips the document's root element (first own key) so the
Apical wrapper receives the bare object; `serializeXmlPayload(data, rootName)`
wraps the success data in the root element. `prefersXmlResponse(accept)`
returns true only when `application/xml` appears in the comma-separated list
**and** before `application/json` (absent header, `*/*`, or wildcard → JSON).

### 5.3 Hexagonal (`@hexkit/plugin-architecture-hexagonal`)

- `parameters.ts` — body type derives from `findXmlMedia` for `kind: "xml"`
  (was JSON-only); path/query/body argument order unchanged; binary
  `contentType` parameter untouched.
- Return type derivation, blob-store wiring, and repository persistence kinds
  are unchanged (XML is a transport concern only).

### 5.4 Hono adapter

- `routes.ts` renders `hasXmlRuntime = operations.some(usesXmlMedia)`; adds the
  fast-xml-parser import and the shared XML statements only then.
- New request helpers (emitted only when `hasXmlRuntime`):
  - `xmlRequest(context, contentTypes, arrayQueryKeys)` — xml-only bodies:
    allowlist-match the normalized Content-Type, read text, reject empty,
    `parseXmlPayload`, return `XmlApicalRequest<ContentTypes[number]>`.
  - `typedRequest(context, jsonContentTypes, xmlContentTypes, arrayQueryKeys)` —
    mixed bodies: JSON branch parses `context.req.json()`, XML branch parses
    text; both forward the matched declared key.
- `registrations.ts` selects the helper from the transport
  (`binary` → `binaryRequest`, mixed json+xml → `typedRequest`, `xml` →
  `xmlRequest`, json → `jsonRequest`, else `request`) and passes
  `context.req.header("accept")` to `respond`.
- `respond(result, accept?)` — widens `contentType` to
  `"application/json" | "application/xml"` (Craft's response union), and when
  `result.xmlRoot` is set and `prefersXmlResponse(accept)` holds, serializes
  `result.data` to XML with `content-type: application/xml`; otherwise the
  JSON path is byte-for-byte unchanged.

### 5.5 Next adapter

- `helpers.ts` — same `hasXmlRuntime` gate: fast-xml-parser import, `XmlApicalRequest`
  type, shared XML statements, plus `toApicalRequest` overloads
  (`xmlBody: true; contentTypes` for XML-only, `xmlContentTypes` for mixed) and
  the parse branches in the implementation. `handleControllerResult(result, accept?)`
  mirrors `respond`'s negotiation.
- `routes.ts` — `renderRequestOptions` picks the option shape from the
  transport; every handler passes `request.headers.get("accept")`.

### 5.6 Packaging

- `apps/cli/src/packaging/model/manifests.ts` — both Hono and Next manifests
  pin `"fast-xml-parser": "5.11.2"`.
- `pnpm-workspace.yaml` catalog gains `fast-xml-parser: 5.11.2` and the root
  `package.json` devDependencies reference it (repo-side `tsc` of generated
  apps resolves the import).

### 5.7 Fixture proof

New `apps/fixtures/xml-api/openapi.yaml` (Widget/Label, domain-agnostic):

- `POST /widgets` — JSON+XML request **and** response (`$ref: Widget`),
- `GET /widgets/{widgetId}` — JSON+XML response + `404`,
- `PUT /widgets/{widgetId}/label` — **XML-only** request body (`$ref: Label`),
  `204` response.

### 5.8 Tracker

`docs/petstore-openapi-progress.md` XML row moves `missing` → `partial` in PR2
(Hono) and PR3 (Next) — `partial` rather than `shipped` because `petstore_auth`
is still missing on these Pet ops.

## 6. Testing strategy

| Layer        | What                                                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared       | media-type/transport/binding/use-case-args/render-controllers/render-xml unit matrix                                                                       |
| Hexagonal    | XML-only body type derivation; updated error-message assertions                                                                                            |
| Hono         | registration helper selection; static-runtime on/off emission; `respond` negotiation; **generated-app `tsc` type check** on `xml-api`                      |
| Next         | `toApicalRequest` option shapes; `handleControllerResult` negotiation; helpers on/off                                                                      |
| CLI          | `xml-generation.test.ts` — full `generateApplication` on `xml-api` for Hono **and** Next                                                                   |
| Pactum (PR2) | XML addPet/updatePet/getPetById, Accept negotiation, JSON regression, malformed XML → 400, unsupported CT → 400, nested category/tags/photoUrls round-trip |

## 7. Delivery

| PR  | Base   | Scope                                                                                                      |
| --- | ------ | ---------------------------------------------------------------------------------------------------------- |
| 1   | `main` | Shared + hexagonal + Hono + Next capability, `xml-api` fixture, CLI tests                                  |
| 2   | PR1    | `openapi.poc.yaml` XML entries for the 3 Pet ops, Apical test flip, Pactum E2E, tracker (Hono → `partial`) |
| 3   | PR2    | `next-generation.test.ts` proof, tracker (Next → `partial`)                                                |

## 8. Risks & mitigations

| Risk                                                                                 | Mitigation                                                                                                       |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| fast-xml-parser collapses single-element arrays (`<tag>x</tag>` → string, not `[…]`) | Known v1 limitation; E2E round-trip uses ≥2 repeated elements; follow-up: contract-derived array-field hints     |
| Text values auto-coerced to numbers/booleans by the parser                           | Acceptable for typed schemas (integer fields validate); document; tune parser options in a follow-up if needed   |
| Root/child element names come from JSON keys (not `xml: name`)                       | Documented non-goal; the contract's `poc.yaml` has no `xml:` schema objects, so JSON-shape XML is the contract   |
| Craft response union widened `contentType` typing                                    | `respond`/`handleControllerResult` accept `"application/json"                                                    | "application/xml"`; controller still always emits JSON `contentType` |
| Accept parsing ignores q-factors and wildcards                                       | Documented: `*/*`/absent → JSON, first-listed wins; E2E pins both explicit and default behaviors                 |
| Stacked-PR drift                                                                     | Each PR opens against its base branch and merges bottom-up; tracker updated in the same PR that changes coverage |

## 9. Success criteria

1. `xml-api` generates for Hono and Next, and the generated Hono runtime
   type-checks (`tsc` clean against Craft wrappers).
2. XML-only and JSON+XML bodies validate through `requestMap["application/xml"]`
   with the exact declared key; wrong/missing Content-Type → 400.
3. `Accept: application/xml` on an XML-declared success →
   `content-type: application/xml` with the schema name as root element;
   default/no Accept → JSON byte-for-byte unchanged.
4. JSON-only contracts emit **no** fast-xml-parser import and no XML helpers.
5. Pactum E2E (PR2) proves add/update/get round-trip fidelity including nested
   `category`/`tags`/`photoUrls`.
6. No Petstore literals in `packages/**`; no changes to `apps/petstore-next/**`;
   `vp check`, full tests, and 90% coverage floors stay green.
