# Petstore query-parameter list operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add domain-agnostic query-parameter support and ship `findPetsByStatus` + `findPetsByTags` on Petstore dogfood (JSON-only, DB-filtered, tracker `partial`).

**Architecture:** Extend hexagonal `ApplicationParameter` with `location`, teach `@hexkit/shared` to wire `request.value.query.*` into controllers, and extend Drizzle `list` to emit SQL `inArray` filters for enum/scalar columns plus a v1 JSONB tag-name heuristic. Prove with a generic `filter-api` fixture; expand `openapi.poc.yaml` + Pactum last.

**Tech Stack:** TypeScript, Vite+ (`vp`), Vitest, Apical craft, Drizzle ORM, Hono, Next Route Handlers, PactumJS, Docker Compose.

**Spec:** [2026-08-28-petstore-query-list-operations-design.md](../specs/2026-08-28-petstore-query-list-operations-design.md)

## Global Constraints

- Plugins stay domain-agnostic (PRD §5.0). Petstore paths/strings live in `apps/petstore-sample/` only; plugin unit tests use `apps/fixtures/filter-api/`.
- JSON only on the PoC contract. No `petstore_auth`, XML, or form-urlencoded in this slice.
- TDD: failing test → minimal implementation → `vp check` / focused package test → commit.
- Do not combine `vp --filter` with `-r`. Build packages before tests: `vp run --filter './packages/*' --filter './apps/cli' build`.
- Conventional Commits per task.
- Update `docs/petstore-openapi-progress.md` in the same PR when adapter support changes.

---

### Task 1: Generic `filter-api` fixture contract

**Files:**

- Create: `apps/fixtures/filter-api/openapi.yaml`

**Interfaces:**

- Produces: OpenAPI 3.1 contract with `Widget` (`x-hexkit.persistence`), `GET /widgets/findByStatus` query `status: string[]` (enum items), array JSON response.

- [ ] **Step 1:** Create the fixture:

```yaml
openapi: 3.1.0
info:
  title: Filter API Fixture
  version: 1.0.0
paths:
  /widgets/findByStatus:
    get:
      operationId: findWidgetsByStatus
      parameters:
        - name: status
          in: query
          required: true
          schema:
            type: array
            items:
              type: string
              enum: [active, inactive]
          style: form
          explode: true
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Widget"
        "400":
          description: invalid
components:
  schemas:
    Widget:
      type: object
      x-hexkit:
        persistence:
          table: widgets
          identity: id
      required: [id, name, status]
      properties:
        id: { type: string }
        name: { type: string }
        status:
          type: string
          enum: [active, inactive]
```

- [ ] **Step 2:** Commit `feat(fixtures): add filter-api OpenAPI for query list tests`.

---

### Task 2: Hexagonal — accept query parameters

**Files:**

- Modify: `packages/plugin-architecture-hexagonal/src/artifact.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/model/parameters.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/model/parameters.test.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/generate/use-case.ts` (if parameter rendering needs `location`)
- Modify: `packages/plugin-architecture-hexagonal/src/plugin.test.ts`

**Interfaces:**

- Consumes: `ContractOperation.parameters` with `location: "query"`.
- Produces: `ApplicationParameter` with `{ name, typeExpression, location: "path" | "query" }`.

- [ ] **Step 1:** Add failing tests in `parameters.test.ts`:

```ts
it("when query parameters are declared, then they are appended after path parameters", () => {
  expect(
    deriveParameters(
      operation({
        operationId: "findWidgetsByStatus",
        path: "/widgets/findByStatus",
        parameters: [
          {
            name: "status",
            location: "query",
            required: true,
            type: {
              kind: "array",
              nullable: false,
              items: {
                kind: "string",
                nullable: false,
                enum: ["active", "inactive"],
              },
            },
          },
        ],
        responses: [
          {
            status: "200",
            description: "ok",
            media: [
              {
                mediaType: "application/json",
                type: {
                  kind: "array",
                  nullable: false,
                  items: { kind: "reference", nullable: false, schema: "Widget" },
                },
              },
            ],
          },
        ],
      }),
    ),
  ).toEqual({
    parameters: [
      {
        name: "status",
        typeExpression: 'Array<"active" | "inactive">',
        location: "query",
      },
    ],
    referencedSchemas: ["Widget"],
  });
});

it("when a header parameter is declared, then the calculation still throws", () => {
  expect(() =>
    deriveParameters(
      operation({
        operationId: "badOp",
        parameters: [{ name: "X-Trace", location: "header", required: false, type: stringType }],
      }),
    ),
  ).toThrow('unsupported header parameter "X-Trace"');
});
```

- [ ] **Step 2:** Run `vp run --filter @hexkit/plugin-architecture-hexagonal test` — expect FAIL.

- [ ] **Step 3:** Implement in `parameters.ts`:
  - Add `location` to returned parameters (`"path"` for path params).
  - Replace query throw with query param derivation via `renderContractType`.
  - Keep throw for `header` / `cookie`.
  - Update `artifact.ts` `ApplicationParameter` type.

- [ ] **Step 4:** Update `plugin.test.ts` `createQueryOnlyContract` expectation — generation should succeed and publish use case with query param. Add snapshot assertion for `findWidgetsByStatus` use-case signature if applicable.

- [ ] **Step 5:** Run `vp run --filter @hexkit/plugin-architecture-hexagonal test` — expect PASS.

- [ ] **Step 6:** Commit `feat(hexagonal): accept query parameters on operations`.

---

### Task 3: Shared — wire query args into controllers

**Files:**

- Modify: `packages/shared/src/use-case-args.ts`
- Modify: `packages/shared/src/use-case-args.test.ts`
- Modify: `packages/shared/src/controller-binding.test.ts` (if fixtures need `location` on parameters)

**Interfaces:**

- Consumes: `UseCaseArgumentInput.parameters[].location`.
- Produces: expressions like `request.value.query.status` after path expressions.

- [ ] **Step 1:** Add failing tests:

```ts
it("when query parameters are present, then query expressions follow path expressions", () => {
  expect(
    deriveUseCaseArgumentExpressions(
      {
        requiresAuth: false,
        parameters: [
          { name: "widgetId", location: "path" },
          { name: "status", location: "query" },
        ],
      },
      false,
    ),
  ).toEqual(["request.value.path.widgetId", "request.value.query.status"]);
});

it("when only query parameters exist, then only query expressions are emitted", () => {
  expect(
    deriveUseCaseArgumentExpressions(
      { requiresAuth: false, parameters: [{ name: "status", location: "query" }] },
      false,
    ),
  ).toEqual(["request.value.query.status"]);
});
```

- [ ] **Step 2:** Run `vp run --filter @hexkit/shared test` — expect FAIL.

- [ ] **Step 3:** Update `deriveUseCaseArgumentExpressions` to partition parameters by `location` and emit path then query expressions. Update existing tests to include `location: "path"` on path params.

- [ ] **Step 4:** Run `vp run --filter @hexkit/shared test` — expect PASS.

- [ ] **Step 5:** Commit `feat(shared): derive query parameter controller arguments`.

---

### Task 4: Drizzle — filtered `list` persistence

**Files:**

- Create: `packages/plugin-drizzle/src/generate/list-filter.ts`
- Create: `packages/plugin-drizzle/src/generate/list-filter.test.ts`
- Modify: `packages/plugin-drizzle/src/generate/repository.ts`
- Modify: `packages/plugin-drizzle/src/model/repository.test.ts`
- Modify: `packages/plugin-drizzle/src/plugin.test.ts`

**Interfaces:**

- Consumes: `PersistenceRepositoryMethodModel` with `kind: "list"` and query parameters; `PersistenceTableModel.columns`.
- Produces: generated method body lines + extra imports (`inArray` from `drizzle-orm`).

- [ ] **Step 1:** Add failing unit tests in `list-filter.test.ts` for:
  - enum column + `status` param → emits `.where(inArray(table.status, status))`.
  - jsonb array column + `tags` param → emits select-all + `.filter` on `tag.name`.
  - unknown param name → throws.

- [ ] **Step 2:** Run `vp run --filter @hexkit/plugin-drizzle test` — expect FAIL.

- [ ] **Step 3:** Implement `renderListMethodBody(table, method)` in `list-filter.ts`. Update `repository.ts` `case "list"` to delegate when `method.parameters.length > 0`.

- [ ] **Step 4:** Extend `plugin.test.ts` with filter-api pipeline snapshot — generated repo contains `inArray` for `findWidgetsByStatus`.

- [ ] **Step 5:** Run `vp run --filter @hexkit/plugin-drizzle test` — expect PASS.

- [ ] **Step 6:** Commit `feat(drizzle): filtered list queries for query parameters`.

---

### Task 5: CLI integration test for filter-api

**Files:**

- Create: `apps/cli/src/filter-generation.test.ts`

**Interfaces:**

- Consumes: `apps/fixtures/filter-api/openapi.yaml`, full generate pipeline.
- Produces: assertions that generated tree includes `find-widgets-by-status` use case, route, and Drizzle repo with `inArray`.

- [ ] **Step 1:** Add failing integration test mirroring `library-generation.test.ts` pattern — generate to temp dir, read key files, assert no Petstore strings, assert query wiring present.

- [ ] **Step 2:** Run `vp run --filter @hexkit/cli test` — expect FAIL until prior tasks complete (may PASS if already wired).

- [ ] **Step 3:** Fix any cross-package gaps surfaced by full pipeline (hexagonal → hono → drizzle).

- [ ] **Step 4:** Run `vp run --filter @hexkit/cli test` — expect PASS.

- [ ] **Step 5:** Commit `test(cli): filter-api generate integration`.

---

### Task 6: Expand PoC contract + generation expectations

**Files:**

- Modify: `apps/petstore-sample/openapi.poc.yaml`
- Modify: `apps/petstore-sample/tests/generation.test.ts`

- [ ] **Step 1:** Add paths from spec §5.4 to `openapi.poc.yaml`.

- [ ] **Step 2:** Extend `requiredOutputPaths` in `generation.test.ts`:

```ts
"src/core/application/find-pets-by-status.ts",
"src/core/application/find-pets-by-tags.ts",
"src/generated/contracts/routes/findPetsByStatus.ts",
"src/generated/contracts/routes/findPetsByTags.ts",
"src/generated/contracts/server/findPetsByStatus.ts",
"src/generated/contracts/server/findPetsByTags.ts",
```

- [ ] **Step 3:** Run `vp run --filter @hexkit/cli build` then generation test — expect PASS.

- [ ] **Step 4:** Commit `feat(petstore): add findPetsByStatus and findPetsByTags to PoC contract`.

---

### Task 7: Petstore Pactum acceptance tests

**Files:**

- Modify: `apps/petstore-sample/tests/api.test.ts`
- Modify: `apps/petstore-sample/tests/api-fixtures.ts` (if extra deterministic IDs needed)
- Modify: `apps/petstore-sample/README.md`

**Interfaces:**

- Consumes: running Compose app at `PETSTORE_API_URL`.

- [ ] **Step 1:** Add describe block `findPetsByStatus`:
  - POST three pets (`available`, `pending`, `sold`) with distinct IDs.
  - GET ` /pet/findByStatus?status=available` → 200, array length 1, matching id.
  - GET `?status=available&status=sold` → 2 results.
  - GET without `status` → 400.

- [ ] **Step 2:** Add describe block `findPetsByTags`:
  - POST pets with tags `[{id:1,name:"friendly"}]`, `[{id:2,name:"quiet"}]`, both tags.
  - GET `?tags=friendly` → 2 pets (friendly-only + both).
  - GET `?tags=missing` → 200 `[]`.
  - GET without `tags` → 400.

- [ ] **Step 3:** Document new endpoints in README.

- [ ] **Step 4:** Commit `test(petstore): Pactum coverage for findByStatus and findByTags`.

---

### Task 8: Docs + progress tracker

**Files:**

- Modify: `docs/petstore-openapi-progress.md`
- Modify: `docs/README.md`
- Modify: `docs/superpowers/specs/2026-08-28-petstore-query-list-operations-design.md` (status → Implemented after ship)

- [ ] Set `findPetsByStatus` / `findPetsByTags` to `partial` for Hono and Next.
- [ ] Notes: JSON + DB filter proven; `petstore_auth` / XML still missing.
- [ ] Refresh Summary tallies. Set Last updated to change date.
- [ ] Add spec + plan rows to `docs/README.md` Specs & plans table.
- [ ] Commit `docs: track findPets query list operations`.

---

### Task 9: Regenerate Next fixture + full verification

**Files:**

- Regenerated: `apps/petstore-next/app/**/route.ts`, `apps/petstore-next/src/**` (dogfood merge algorithm)

- [ ] **Step 1:** Build CLI: `vp run --filter './packages/*' --filter './apps/cli' build`.

- [ ] **Step 2:** Generate Next output and merge onto fixture per `apps/petstore-next/README.md`.

- [ ] **Step 3:** Run full validation:

```bash
vp run ready
vp run dogfood
HEXKIT_SKIP_COMPOSE=1 vp run dogfood-petstore-next
```

- [ ] **Step 4:** Commit regenerated Next fixture + any fixups.

---

## Spec coverage

| Spec section                         | Task                            |
| ------------------------------------ | ------------------------------- |
| §5.1 Parameter location on artifacts | 2                               |
| §5.2 HTTP query arg wiring           | 3                               |
| §5.3 Persistence kind (list)         | 2, 4                            |
| §5.4 PoC contract paths              | 6                               |
| §5.5 filter-api fixture              | 1, 5                            |
| §5.6 Drizzle filtered list           | 4                               |
| §5.7 Next Route Handlers             | 9                               |
| §5.8 Pactum dogfood                  | 7                               |
| §5.9 Progress tracker                | 8                               |
| §3 Non-goals (OAuth/XML)             | no task — intentionally omitted |
| §6 Error handling                    | 4, 7                            |
| §7 Testing strategy                  | 2–7, 9                          |
| §8 Success criteria                  | 9                               |

## Execution options

After you approve this plan:

1. **Subagent-driven (recommended)** — one fresh subagent per task with review between tasks.
2. **Inline** — execute tasks sequentially in one session with checkpoints.

Which approach do you prefer?
