# updatePetWithForm Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add domain-agnostic query field-patch updates and ship Petstore `updatePetWithForm` on Hono + Next dogfood (JSON response, query inputs, tracker `partial`), including a Quick update UI on the Next pet detail page.

**Architecture:** Mark the POST operation with `x-hexkit.operation.action: update`, teach hexagonal to type optional query params as `| undefined`, extend Drizzle `update` to emit conditional SET when parameters are path identity + query columns, and wire a fixture-owned Next Quick update form to `server-access.updatePetWithForm`. Prove with `apps/fixtures/patch-api` then expand `openapi.poc.yaml` + Pactum.

**Tech Stack:** TypeScript, Vite+ (`vp`), Vitest, Apical craft, Drizzle ORM, Hono, Next App Router (Server Actions + Route Handlers), PactumJS, Docker Compose.

**Spec:** [2026-09-01-update-pet-with-form-design.md](../specs/2026-09-01-update-pet-with-form-design.md)

## Global Constraints

- Plugins stay domain-agnostic (PRD §5.0). Petstore paths/strings live in `apps/petstore-sample/` and fixture-owned Next UI only; plugin unit tests use `apps/fixtures/patch-api/`.
- Query parameters for form fields (official OAS 3.1 shape). No `petstore_auth`, XML, or `application/x-www-form-urlencoded` in this slice.
- TDD: failing test → minimal implementation → focused package test → commit.
- Do not combine `vp --filter` with `-r`. Build packages before tests: `vp run --filter './packages/*' --filter './apps/cli' build`.
- Conventional Commits per task.
- Update `docs/petstore-openapi-progress.md` in the same PR when adapter support changes.
- Do not edit `apps/petstore-sample/openapi.yaml` (checked-in reference).

## File structure (planned touch list)

| Path                                                             | Role                                  |
| ---------------------------------------------------------------- | ------------------------------------- |
| `apps/fixtures/patch-api/openapi.yaml`                           | Generic Widget field-patch contract   |
| `packages/plugin-architecture-hexagonal/src/model/parameters.ts` | Optional query → `\| undefined`       |
| `packages/plugin-drizzle/src/model/repository.ts`                | Pass parameter `location` through     |
| `packages/plugin-drizzle/src/generate/field-patch.ts`            | Field-patch update emit helper        |
| `packages/plugin-drizzle/src/generate/repository.ts`             | Dispatch entity vs field-patch update |
| `apps/cli/src/patch-generation.test.ts`                          | End-to-end generate on patch-api      |
| `apps/petstore-sample/openapi.poc.yaml`                          | Add `POST /pet/{petId}`               |
| `apps/petstore-sample/tests/api.test.ts`                         | Pactum acceptance                     |
| `apps/petstore-next/app/pets/[petId]/page.tsx`                   | Quick update panel                    |
| `apps/petstore-next/app/pets/actions.ts`                         | `updatePetWithFormAction`             |
| `docs/petstore-openapi-progress.md`                              | `missing` → `partial`                 |

---

### Task 1: Generic `patch-api` fixture contract

**Files:**

- Create: `apps/fixtures/patch-api/openapi.yaml`

**Interfaces:**

- Produces: OpenAPI 3.1 contract with `Widget` (`x-hexkit.persistence`), `POST /widgets/{widgetId}` `updateWidgetWithForm` (action `update`, optional query `name` / `status`), and `GET /widgets/{widgetId}` `getWidgetById`.

- [ ] **Step 1:** Create the fixture:

```yaml
openapi: 3.1.0
info:
  title: Patch API Fixture
  version: 1.0.0
paths:
  /widgets/{widgetId}:
    parameters:
      - name: widgetId
        in: path
        required: true
        schema:
          type: string
    get:
      operationId: getWidgetById
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Widget"
        "404":
          description: missing
    post:
      operationId: updateWidgetWithForm
      x-hexkit:
        operation:
          aggregate: Widget
          action: update
      parameters:
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
            enum: [active, inactive]
      responses:
        "200":
          description: ok
          content:
            application/json:
              schema:
                $ref: "#/components/schemas/Widget"
        "400":
          description: invalid
        "404":
          description: missing
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

- [ ] **Step 2:** Commit `feat(fixtures): add patch-api OpenAPI for field-patch updates`.

---

### Task 2: Hexagonal — optional query parameter typing

**Files:**

- Modify: `packages/plugin-architecture-hexagonal/src/model/parameters.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/model/parameters.test.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/model/repository.test.ts` (add case: action `update` + POST → `update`)
- Modify: `packages/plugin-architecture-hexagonal/src/plugin.test.ts` (optional: assert patch-api use-case signature after Task 5 wiring)

**Interfaces:**

- Consumes: `ContractParameter.required`.
- Produces: `ApplicationParameter.typeExpression` with `| undefined` when `required === false`; `location` unchanged.

- [ ] **Step 1:** Add failing tests in `parameters.test.ts`:

```ts
it("when a query parameter is optional, then the type expression includes undefined", () => {
  expect(
    deriveParameters(
      operation({
        operationId: "updateWidgetWithForm",
        method: "post",
        path: "/widgets/{widgetId}",
        parameters: [
          {
            name: "widgetId",
            location: "path",
            required: true,
            type: { kind: "string", nullable: false },
          },
          {
            name: "name",
            location: "query",
            required: false,
            type: { kind: "string", nullable: false },
          },
          {
            name: "status",
            location: "query",
            required: false,
            type: {
              kind: "string",
              nullable: false,
              enum: ["active", "inactive"],
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
                type: { kind: "reference", nullable: false, schema: "Widget" },
              },
            ],
          },
          { status: "404", description: "missing", media: [] },
        ],
      }),
    ),
  ).toEqual({
    parameters: [
      { name: "widgetId", typeExpression: "string", location: "path" },
      { name: "name", typeExpression: "string | undefined", location: "query" },
      {
        name: "status",
        typeExpression: '"active" | "inactive" | undefined',
        location: "query",
      },
    ],
    referencedSchemas: ["Widget"],
  });
});
```

Also add to `repository.test.ts` cases:

```ts
{
  action: "update",
  httpMethod: "post",
  resultCardinality: "one",
  parameterCount: 3,
  expected: "update",
},
```

- [ ] **Step 2:** Run focused tests — expect FAIL on optional typing:

```bash
vp run --filter './packages/*' --filter './apps/cli' build
vp run --filter @hexkit/plugin-architecture-hexagonal test
```

Expected: FAIL — optional query still typed as required `string`.

- [ ] **Step 3:** Implement in `renderOperationParameter` (`parameters.ts`):

```ts
function renderOperationParameter(parameter: ContractParameter): {
  parameter: ApplicationParameter;
  referencedSchemas: readonly string[];
} {
  const rendered = renderContractType(parameter.type);
  const typeExpression = parameter.required
    ? rendered.expression
    : `${rendered.expression} | undefined`;
  return {
    parameter: {
      name: parameter.name,
      typeExpression,
      location: parameter.location === "query" ? "query" : "path",
    },
    referencedSchemas: rendered.referencedSchemas,
  };
}
```

- [ ] **Step 4:** Re-run hexagonal tests — expect PASS.

- [ ] **Step 5:** Commit `feat(hexagonal): type optional query parameters as undefined`.

---

### Task 3: Drizzle — field-patch update generation

**Files:**

- Create: `packages/plugin-drizzle/src/generate/field-patch.ts`
- Create: `packages/plugin-drizzle/src/generate/field-patch.test.ts`
- Modify: `packages/plugin-drizzle/src/model/repository.ts` (keep `location` on method parameters)
- Modify: `packages/plugin-drizzle/src/generate/repository.ts` (dispatch)
- Modify: `packages/plugin-drizzle/src/model/repository.test.ts` if location assertions needed
- Modify: `packages/plugin-drizzle/src/plugin.test.ts` (generate patch-api; assert emit)

**Interfaces:**

- Consumes: `PersistenceRepositoryMethodModel` with `kind: "update"` and parameters carrying `location?: "path" | "query"`.
- Produces: repository method source that conditionally sets query-mapped columns and returns `undefined` when no row.

- [ ] **Step 1:** Extend persistence method parameter type in `model/repository.ts`:

```ts
parameters: readonly {
  name: string;
  typeExpression: string;
  location?: "path" | "query";
}[];
```

Map `location` from hexagonal `ApplicationParameter` in `deriveRepository`.

- [ ] **Step 2:** Add failing unit tests in `field-patch.test.ts` covering:
  - Happy path emit contains `if (name !== undefined) patch.name = name` and `.set(patch)`.
  - Empty patch branch uses `.select()` not `.update()`.
  - Unknown query column name throws at generate time.
  - Entity update (single param, no `location`) still uses existing full `.set({ ... })` path.

Example assertion sketch:

```ts
it("when update has path + query params, then it emits a conditional field patch", () => {
  const body = renderFieldPatchUpdateMethod(repository, method);
  expect(body).toContain("const patch");
  expect(body).toContain("if (name !== undefined) patch.name = name");
  expect(body).toContain("if (status !== undefined) patch.status = status");
  expect(body).toContain(".set(patch)");
  expect(body).toContain("return row ? mapWidget(row) : undefined");
});
```

- [ ] **Step 3:** Run `vp run --filter @hexkit/plugin-drizzle test` — expect FAIL.

- [ ] **Step 4:** Implement `renderFieldPatchUpdateMethod` in `field-patch.ts`:

Detection helper:

```ts
export function isFieldPatchUpdate(method: PersistenceRepositoryMethodModel): boolean {
  if (method.kind !== "update") return false;
  const pathParams = method.parameters.filter((p) => p.location === "path");
  const queryParams = method.parameters.filter((p) => p.location === "query");
  return (
    pathParams.length === 1 &&
    queryParams.length >= 0 &&
    method.parameters.every((p) => p.location === "path" || p.location === "query")
  );
}
```

For each query param, resolve `table.columns.find(c => c.propertyName === param.name && !c.isIdentity)`; throw if missing.

Wire `repository.ts` `case "update"`:

```ts
case "update": {
  if (isFieldPatchUpdate(method)) {
    return renderFieldPatchUpdateMethod(repository, method);
  }
  // existing entity update…
}
```

- [ ] **Step 5:** Add plugin test that loads `apps/fixtures/patch-api/openapi.yaml` through the drizzle plugin (mirror filter-api / library patterns) and asserts generated `widget-repository.ts` contains field-patch logic for `updateWidgetWithForm`.

- [ ] **Step 6:** Run drizzle tests — expect PASS.

- [ ] **Step 7:** Commit `feat(drizzle): emit field-patch updates for path+query params`.

---

### Task 4: CLI integration test for patch-api

**Files:**

- Create: `apps/cli/src/patch-generation.test.ts` (mirror `filter-generation.test.ts`)

**Interfaces:**

- Consumes: `apps/fixtures/patch-api/openapi.yaml`, full generate pipeline.
- Produces: assertions that use case + drizzle repository + HTTP route for `updateWidgetWithForm` exist.

- [ ] **Step 1:** Copy structure from `apps/cli/src/filter-generation.test.ts`; point at patch-api; assert:

```ts
expect(useCase).toContain("updateWidgetWithForm");
expect(useCase).toContain("string | undefined");
expect(repository).toContain("updateWidgetWithForm");
expect(repository).toContain("const patch");
expect(files).toContain("src/generated/contracts/routes/updateWidgetWithForm.ts");
```

- [ ] **Step 2:**

```bash
vp run --filter './packages/*' --filter './apps/cli' build
vp run --filter @hexkit/cli test
```

Expected: PASS for new file (or FAIL only if generate path broken — fix before continuing).

- [ ] **Step 3:** Commit `test(cli): patch-api generate integration`.

---

### Task 5: Expand Petstore PoC contract

**Files:**

- Modify: `apps/petstore-sample/openapi.poc.yaml`
- Modify: `apps/petstore-sample/tests/generation.test.ts` (add expected generated paths for `updatePetWithForm`)

**Interfaces:**

- Produces: `POST /pet/{petId}` operationId `updatePetWithForm` per design §5.1.

- [ ] **Step 1:** Under `/pet/{petId}`, add:

```yaml
post:
  operationId: updatePetWithForm
  x-hexkit:
    operation:
      aggregate: Pet
      action: update
  parameters:
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
        enum:
          - available
          - pending
          - sold
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

(`PetId` path parameter remains on the path item or operation — follow existing `get`/`delete` style in the file.)

- [ ] **Step 2:** Extend `generation.test.ts` expected file lists with:

```ts
"src/generated/contracts/routes/updatePetWithForm.ts",
"src/generated/contracts/schemas/updatePetWithFormParameters.ts",
"src/generated/contracts/server/updatePetWithForm.ts",
"src/core/application/update-pet-with-form.ts",
```

- [ ] **Step 3:** Regenerate Hono sample via dogfood script’s generate step or the same command `dogfood.sh` uses (inspect `apps/petstore-sample/scripts/dogfood.sh`). Confirm `src/adapters/db/pet-repository.ts` includes field-patch `updatePetWithForm`.

- [ ] **Step 4:** Commit `feat(petstore): add updatePetWithForm to PoC contract`.

---

### Task 6: Hono Pactum acceptance

**Files:**

- Modify: `apps/petstore-sample/tests/api.test.ts`
- Modify: `apps/petstore-sample/tests/api-fixtures.ts` if a dedicated id is needed

**Interfaces:**

- Consumes: running Compose API from dogfood.
- Produces: Pactum coverage for design §5.8.

- [ ] **Step 1:** Add tests (adapt ids to fixture helpers):

```ts
it("when POST /pet/{petId} patches name and status, then nested fields are preserved", async () => {
  await spec()
    .post(`/pet/${petId}`)
    .withQueryParams({ name: `Form-updated ${petId}`, status: "pending" })
    .expectStatus(200)
    .expectJsonLike({
      id: petId,
      name: `Form-updated ${petId}`,
      status: "pending",
      category: addedPet.category,
      photoUrls: addedPet.photoUrls,
      tags: addedPet.tags,
    });
});

it("when POST /pet/{petId} omits name, then the existing name is kept", async () => {
  await spec()
    .post(`/pet/${petId}`)
    .withQueryParams({ status: "sold" })
    .expectStatus(200)
    .expectJsonLike({ id: petId, status: "sold" });
});

it("when POST /pet/{petId} has no query fields, then the pet is unchanged", async () => {
  await spec().post(`/pet/${petId}`).expectStatus(200).expectJsonLike({ id: petId });
});

it("when POST /pet/{petId} targets a missing pet, then it returns 404", async () => {
  await spec().post(`/pet/${missingPetId}`).withQueryParams({ name: "nope" }).expectStatus(404);
});

it("when POST /pet/{petId} has an invalid status, then it returns 400", async () => {
  await spec().post(`/pet/${petId}`).withQueryParams({ status: "not-a-status" }).expectStatus(400);
});
```

Place them after the pet is created (and preferably before destructive delete), or use a dedicated form-update pet id from `createAcceptanceIds`.

- [ ] **Step 2:** Run `vp run dogfood` — expect PASS.

- [ ] **Step 3:** Commit `test(petstore): Pactum coverage for updatePetWithForm`.

---

### Task 7: Regenerate Next dogfood + Server Access

**Files:**

- Regenerate under `apps/petstore-next/` (generated Route Handlers, contracts, core application, drizzle repo, `server-access.ts`, controllers)
- Fixture-owned UI files are Task 8 (do not hand-edit generated files)

**Interfaces:**

- Produces: `ServerAccess.updatePetWithForm` and `POST` export on `app/pet/[petId]/route.ts`.

- [ ] **Step 1:** Run Next dogfood generate path (`apps/petstore-next/scripts/dogfood.sh` or the generate invocation it wraps) with `HEXKIT_SKIP_COMPOSE=1` first if you only need generate+build.

- [ ] **Step 2:** Verify generated artifacts:

```bash
rg -n "updatePetWithForm" apps/petstore-next/src/adapters/http-next/server-access.ts
rg -n "export async function POST" apps/petstore-next/app/pet/\[petId\]/route.ts
rg -n "const patch" apps/petstore-next/src/adapters/db/pet-repository.ts
```

Expected: all three match.

- [ ] **Step 3:** Commit regenerated Next outputs: `feat(petstore-next): regenerate updatePetWithForm handlers`.

---

### Task 8: Next PetShop Quick update UI

**Files:**

- Modify: `apps/petstore-next/app/pets/actions.ts`
- Modify: `apps/petstore-next/app/pets/[petId]/page.tsx`

**Interfaces:**

- Consumes: `getServerAccess().updatePetWithForm(petId, name | undefined, status | undefined)`.
- Produces: detail-page Quick update form; existing Edit link + Delete unchanged.

- [ ] **Step 1:** Add Server Action:

```ts
export async function updatePetWithFormAction(formData: FormData) {
  const petId = readRequiredInteger(formData, "petId");
  const nameRaw = readText(formData, "name");
  const statusRaw = readText(formData, "status");

  const name = nameRaw.length === 0 ? undefined : nameRaw;
  let status: "available" | "pending" | "sold" | undefined;
  if (statusRaw.length === 0) {
    status = undefined;
  } else if (petStatuses.includes(statusRaw as (typeof petStatuses)[number])) {
    status = statusRaw as (typeof petStatuses)[number];
  } else {
    throw new Error("status must be available, pending, or sold.");
  }

  const pet = await getServerAccess().updatePetWithForm(petId, name, status);
  if (pet == null) {
    throw new Error(`Pet ${String(petId)} was not found.`);
  }
  revalidatePath("/");
  revalidatePath("/pets");
  revalidatePath(`/pets/${pet.id}`);
  redirect(`/pets/${pet.id}`);
}
```

- [ ] **Step 2:** Update pet detail page — insert Quick update section after the summary header and before the Edit/Delete row:

```tsx
<section className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
  <h2 className="text-lg font-semibold">Quick update</h2>
  <p className="mt-2 text-sm text-stone-600">
    Patch name and status via{" "}
    <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">updatePetWithForm</code> (
    <code className="rounded bg-stone-100 px-1 py-0.5 text-xs">POST /pet/{"{petId}"}</code>
    ). Category, tags, and photos stay unchanged.
  </p>
  <form action={updatePetWithFormAction} className="mt-4 grid gap-4 md:grid-cols-2">
    <input type="hidden" name="petId" value={pet.id} />
    <label className="grid gap-2 text-sm font-medium text-stone-700">
      Name
      <input
        name="name"
        defaultValue={pet.name}
        className="rounded-xl border border-stone-300 px-3 py-2"
      />
    </label>
    <label className="grid gap-2 text-sm font-medium text-stone-700">
      Status
      <select
        name="status"
        defaultValue={pet.status ?? "available"}
        className="rounded-xl border border-stone-300 px-3 py-2"
      >
        <option value="available">available</option>
        <option value="pending">pending</option>
        <option value="sold">sold</option>
      </select>
    </label>
    <div className="md:col-span-2">
      <button className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700">
        Apply quick update
      </button>
    </div>
  </form>
  <p className="mt-3 text-xs text-stone-500">
    Equivalent Route Handler:{" "}
    <code className="rounded bg-stone-100 px-1 py-0.5">POST /pet/{pet.id}?name=…&amp;status=…</code>
  </p>
</section>
```

Import `updatePetWithFormAction` from `../actions`. Keep the existing **Edit pet** link (full PUT) and Delete form.

- [ ] **Step 3:** Run `HEXKIT_SKIP_COMPOSE=1 vp run dogfood-petstore-next` — expect PASS (ESLint + `next build`).

- [ ] **Step 4:** Commit `feat(petstore-next): Quick update UI for updatePetWithForm`.

---

### Task 9: Tracker + design status

**Files:**

- Modify: `docs/petstore-openapi-progress.md`
- Modify: `docs/superpowers/specs/2026-09-01-update-pet-with-form-design.md` (Status → Implemented when done)

- [ ] **Step 1:** Set `updatePetWithForm` Hono + Next cells to `partial`. Notes remain: query `name` / `status`; still need `petstore_auth`. Update Summary tallies (`missing` −2, `partial` +2 per plugin). Set **Last updated** to the change date.

- [ ] **Step 2:** Mark design Status `Implemented`.

- [ ] **Step 3:** Commit `docs: mark updatePetWithForm partial on Petstore tracker`.

---

### Task 10: Final verification

- [ ] **Step 1:**

```bash
vp run --filter './packages/*' --filter './apps/cli' build
vp check
vp run --filter './packages/*' --filter './apps/cli' test
vp run coverage
vp run dogfood
HEXKIT_SKIP_COMPOSE=1 vp run dogfood-petstore-next
```

Expected: all green.

- [ ] **Step 2:** If any step fails, fix forward with focused commits (do not amend).

---

## Spec coverage self-review

| Spec section                              | Tasks                                                  |
| ----------------------------------------- | ------------------------------------------------------ |
| §5.1 PoC contract                         | 5                                                      |
| §5.2 patch-api fixture                    | 1, 4                                                   |
| §5.3 optional typing + action update      | 2, 5                                                   |
| §5.4 shared HTTP wiring                   | covered by existing query arg support; verified in 4–7 |
| §5.5 Drizzle field-patch                  | 3                                                      |
| §5.6 Next handlers / server-access        | 7                                                      |
| §5.7 Quick update UI                      | 8                                                      |
| §5.8 Pactum                               | 6                                                      |
| §5.9 Tracker                              | 9                                                      |
| Non-goals (OAuth / form-urlencoded / XML) | not implemented                                        |

## Placeholder / consistency check

- No TBD/TODO steps.
- Field-patch detection uses parameter `location` consistently across Tasks 2–3.
- Operation extension `action: update` required on both patch-api and PoC contracts.
- UI copy references `updatePetWithForm` / `POST /pet/{petId}` to match generated operationId.
