# XML media types implementation plan (stacked PRs)

Implements [2026-10-14-xml-media-types-design.md](../specs/2026-10-14-xml-media-types-design.md).

## Global Constraints

- **TDD where a test can express the behavior first**; every PR lands with its
  tests in the same commit set.
- Conventional Commits; stacked PRs open **against their base branch** and merge
  bottom-up.
- `vp run --filter './packages/*' --filter './apps/cli' build` before tests
  (workspace packages export from `dist/`).
- `vp check` (format + lint + types) and `vp run coverage` (90% floors) must be
  green per PR.
- **No Petstore literals in `packages/**`** (banned-literal scanners);
  everything derives from contract schema names / media types.
- No changes to `apps/petstore-next/**`.
- Update `docs/petstore-openapi-progress.md` in the same PR that changes
  Petstore-relevant OpenAPI coverage.
- Errors stay JSON; `*/*`/absent `Accept` stays JSON.

## Stacked PR map

| PR  | Branch                      | Base   | Scope                                                                                            |
| --- | --------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| 1   | `feat/xml-request-response` | `main` | Shared + hexagonal + Hono + Next capability, `xml-api` fixture, CLI tests, docs                  |
| 2   | `feat/xml-petstore-hono`    | PR1    | `openapi.poc.yaml` XML on 3 Pet ops, Apical assertion flip, Pactum E2E, tracker Hono → `partial` |
| 3   | `feat/xml-petstore-next`    | PR2    | `next-generation.test.ts` proof, tracker Next → `partial`                                        |

## File structure (planned touch list)

```
pnpm-workspace.yaml                                catalog: fast-xml-parser
package.json                                       root devDependency
docs/superpowers/specs/2026-10-14-xml-media-types-design.md
docs/superpowers/plans/2026-10-14-xml-media-types.md
apps/fixtures/xml-api/openapi.yaml                 NEW fixture
apps/cli/src/packaging/model/manifests.ts          fast-xml-parser pin (Hono + Next)
apps/cli/src/xml-generation.test.ts                NEW CLI e2e (Hono + Next)
packages/shared/src/media-type.ts                  NEW isXmlMediaType
packages/shared/src/media.ts                       findXmlMedia / hasXmlRequestBody
packages/shared/src/request-body-transport.ts      xml kinds + xmlContentTypes
packages/shared/src/controller-binding.ts          hasXmlRequestBody / successXmlRootName
packages/shared/src/use-case-args.ts               hasXmlRequestBody flag
packages/shared/src/render-controllers.ts          body validation + xmlRoot emit
packages/shared/src/render-xml.ts                  NEW runtime statements / usesXmlMedia
packages/shared/src/index.ts                       exports
packages/plugin-architecture-hexagonal/src/model/parameters.ts   XML body type
packages/plugin-hono/src/generate/routes/static-runtime.ts       xml/typed helpers + respond
packages/plugin-hono/src/generate/routes/registrations.ts        helper selection + accept
packages/plugin-hono/src/generate/routes.ts                      hasXmlRuntime gate + import
packages/plugin-next/src/generate/helpers.ts                     toApicalRequest xml + negotiate
packages/plugin-next/src/generate/routes.ts                      request options + accept
docs/petstore-openapi-progress.md                  PR2 + PR3 rows
apps/petstore-sample/openapi.poc.yaml              PR2: 3 Pet ops gain application/xml
packages/plugin-apical/src/plugin.test.ts          PR2: flip the "no application/xml" assertion
apps/petstore-sample/tests/api/pet/*.ts            PR2: Pactum XML suites
apps/cli/src/next-generation.test.ts               PR3: XML generation proof
```

# PR 1 — Capability (base `main`)

### Task 1: Design + plan docs

- [x] `docs/superpowers/specs/2026-10-14-xml-media-types-design.md`
- [x] `docs/superpowers/plans/2026-10-14-xml-media-types.md` (this file)

### Task 2: Shared — XML media detection and transport

- [x] `media-type.ts` + tests (`isXmlMediaType`, parameters/case handling)
- [x] `media.ts`: `findXmlMedia`, `hasXmlRequestBody` + tests
- [x] `request-body-transport.ts`: `{ kind: "xml" }`, `xmlContentTypes` on the
      JSON kind, XML+binary mixed error, updated message + tests
- [x] `controller-binding.ts`: `hasXmlRequestBody`, `successXmlRootName`
      (reference schemas only), transport pass-through + tests
- [x] `use-case-args.ts`: `hasXmlRequestBody` flag; XML-only body emits
      `request.value.body` + tests
- [x] `render-controllers.ts`: validation branch for XML-only bodies;
      `xmlRoot: "<Schema>"` in success results + tests
- [x] `render-xml.ts` + tests: `renderXmlRuntimeStatements()`,
      `XML_RUNTIME_IMPORT`, `usesXmlMedia()`
- [x] Barrel exports; `vp run --filter @hexkit/shared test` green (95+ tests)

### Task 3: Hexagonal — XML-only body type derivation

- [x] `parameters.ts` derives the body parameter from `findXmlMedia` for
      `kind: "xml"` (JSON path unchanged for mixed bodies)
- [x] Error-message assertions updated in `parameters.test.ts`

### Task 4: Hono — request helpers, negotiation, gating

- [x] `static-runtime.ts`: `XmlApicalRequest`, `xmlRequest`, `typedRequest`,
      `respond(result, accept?)` with `xmlRoot` serialization — all gated on
      `hasXmlRuntime` (types, statements, and the respond branch included)
- [x] `registrations.ts`: transport-driven helper selection +
      `context.req.header("accept")`; content-type list renderers
- [x] `routes.ts`: `hasXmlRuntime` computation, fast-xml-parser import,
      statement gate
- [x] Unit matrix: `static-runtime.test.ts` (on/off emission + negotiation),
      `registrations.test.ts` (typedRequest/xmlRequest/no-change cases)

### Task 5: Next — overloads, negotiation, gating

- [x] `helpers.ts`: `hasXmlRuntime` gate; `XmlApicalRequest`; shared XML
      statements; `toApicalRequest` overloads for `xmlBody`/`xmlContentTypes`
      with parse branches; `handleControllerResult(result, accept?)`
- [x] `routes.ts`: `renderRequestOptions` (binary / xml-only / mixed / json) +
      Accept passed on every handler
- [x] Unit matrix in `plugin.test.ts` (helpers + all three route shapes +
      JSON-only negative case)

### Task 6: Fixture, packaging, and proofs

- [x] `apps/fixtures/xml-api/openapi.yaml` (Widget: JSON+XML request+response;
      Label: XML-only request; `201`/`200`/`404`/`204`)
- [x] Manifests pin `fast-xml-parser: 5.11.2`; catalog + root devDependency
- [x] Hono `plugin.test.ts`: full-pipeline generation assertions for `xml-api`,
      JSON-only negative case, and a **`tsc` type-check** of the generated
      runtime (proves Craft `requestMap["application/xml"]` typing)
- [x] Next `plugin.test.ts`: helpers/routes generation assertions
- [x] `apps/cli/src/xml-generation.test.ts`: `generateApplication` end-to-end
      for Hono and Next (routes, controllers `xmlRoot`, use-case signatures,
      manifest dependency)
- [x] `vp check` + full test suite + `vp run coverage` (90% floors) green

# PR 2 — Hono Petstore dogfood (base PR1)

### Task 7: Contract + contract-layer assertion

- [ ] Add `application/xml` entries (same `$ref` schemas) to
      `apps/petstore-sample/openapi.poc.yaml` for `PUT /pet`, `POST /pet`,
      `GET /pet/{petId}` request/response content maps — **only** the three
      ops that already declare XML in `openapi.yaml`
- [ ] Flip `packages/plugin-apical/src/plugin.test.ts` (~line 170) from
      `not.toContain("application/xml")` to a positive assertion

### Task 8: Pactum E2E (user-required)

- [ ] `apps/petstore-sample/tests/api/pet/` XML suites: - `POST /pet` add with `content-type: application/xml` (nested
      `category`/`tags`/`photoUrls` round-trip, ≥2 repeated elements) - `PUT /pet` update over XML - `GET /pet/{petId}` with `Accept: application/xml` → XML body +
      schema-name root element; `Accept` absent → JSON; JSON requests
      unchanged (regression) - malformed XML body → 400; declared-free Content-Type on these ops → 400
- [ ] Dogfood gates: `vp run --filter './packages/*' --filter './apps/cli'
build`, `vp run --filter @hexkit/plugin-apical test`,
      `vp run dogfood:petstore:hono` (lint + types + Compose + Pactum)

### Task 9: Tracker (same PR)

- [ ] `docs/petstore-openapi-progress.md` XML row, **Hono cell** → `partial`
      (`petstore_auth` still missing on these Pet ops); refresh tallies

# PR 3 — Next dogfood (base PR2)

### Task 10: Generation-level proof + tracker (same PR)

- [ ] `apps/cli/src/next-generation.test.ts`: assert the regenerated Next app
      emits the XML runtime helpers, `xmlContentTypes`/`xmlBody` route options,
      Accept wiring, and the `fast-xml-parser` manifest dependency for the
      Petstore contract
- [ ] Tracker XML row, **Next cell** → `partial` with an honest note
- [ ] `vp run dogfood:petstore:nextjs` stays green; **no**
      `apps/petstore-next/**` changes

## Self-review checklist (agents)

- [ ] Each PR builds first, then `vp check`, package tests, `vp run coverage`
- [ ] No Petstore literals in `packages/**` (domain-agnostic scanners pass)
- [ ] JSON-only contracts emit no fast-xml-parser import / XML helpers
- [ ] Error envelopes remain JSON in every path
- [ ] Tracker updated in the same PR as the coverage/capability change
- [ ] Stacked PRs opened against their base branch, merged bottom-up

## Execution handoff

PR1 is implemented and green on branch `feat/xml-request-response`. Continue
with Task 7 on a new branch cut from PR1's tip.
