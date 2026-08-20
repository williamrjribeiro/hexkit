# Rich Pet JSONB Persistence — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist nested OpenAPI `object` / `array` / bare `$ref` properties as Postgres JSONB columns (default), dogfood a Rich Pet in `openapi.poc.yaml`, and leave relational opt-in for Phase 2.

**Architecture:** Extend `@hexkit/plugin-drizzle` column derivation and SQL/schema emitters so nested structured types map to `jsonb` without new `x-hexkit` keys. Keep Row→domain mappers as Apical `Schema.parse` + `?? undefined` for optionals; insert/update continue to passthrough entity fields. Enrich the Petstore PoC contract with `Category` / `Tag` (no persistence) and nested Pet fields; update generation path lists and Pactum round-trips.

**Tech Stack:** TypeScript, Vite+ (`vp`), Vitest, Drizzle ORM (`jsonb` from `drizzle-orm/pg-core`), Apical craft, Hono dogfood Compose, Pactum.

**Parent plan:** [`docs/superpowers/plans/2026-08-20-rich-pet-nested-persistence.md`](./2026-08-20-rich-pet-nested-persistence.md) (§4–§5 Phase 1 only).

## Global Constraints

- Domain-agnostic plugins (PRD §5.0): no Pet/Category/Tag literals in `@hexkit/plugin-*` production sources; use generic fixtures in unit tests.
- Leave `apps/petstore-sample/openapi.yaml` untouched.
- Phase 1: **no** new `x-hexkit` keys; JSONB is the default for nested structured types.
- Postgres **`jsonb` only** (not `json`); Drizzle helper `jsonb()`.
- Reject `$ref` (`type.kind === "reference"`) combined with `x-hexkit.reference` on the same property.
- Target schema `x-hexkit.persistence` must **not** change embed storage in Phase 1.
- Test-first: failing Vitest → minimal implementation → focused `vp test` / `vp check`.
- Conventional Commits per task.
- Build workspace packages before tests that import `dist/`: `vp run -r build` when needed.

## File map

| Path | Responsibility |
| ---- | -------------- |
| `packages/plugin-drizzle/src/model/derive.ts` | `PersistenceColumnSqlType` + `jsonb` mapping + `$ref`+FK rejection |
| `packages/plugin-drizzle/src/generate/schema.ts` | Emit `jsonb("…")` columns + import |
| `packages/plugin-drizzle/src/generate/migration.ts` | Emit SQL type `jsonb` |
| `packages/plugin-drizzle/src/plugin.test.ts` | Synthetic nested + rejection tests; update Petstore snapshots after contract change |
| `apps/petstore-sample/openapi.poc.yaml` | Rich Pet + Category + Tag |
| `apps/petstore-sample/tests/generation.test.ts` | Required output paths for Category/Tag craft + domain |
| `apps/petstore-sample/tests/api.test.ts` | Three normative nested round-trips |
| `packages/plugin-apical/src/plugin.test.ts` (and other plugin module maps) | Add Category/Tag to virtual Apical schema maps when loading PoC |
| `packages/plugin-architecture-hexagonal/src/plugin.test.ts` | Expect domain files for Category/Tag; Pet type snapshot |
| `apps/cli/src/command.test.ts`, `next-generation.test.ts` | Schema path lists include Category/Tag |
| `apps/petstore-next/**` | Regen via `HEXKIT_SKIP_COMPOSE=1 vp run dogfood-petstore-next` |
| `docs/README.md`, `PRD.md` §11 / parent plan status | Note JSONB default after ship |

---

### Task 1: Failing Drizzle tests for nested JSONB + `$ref`+FK rejection

**Files:**

- Modify: `packages/plugin-drizzle/src/plugin.test.ts`
- Test: `packages/plugin-drizzle/src/plugin.test.ts`

**Interfaces:**

- Consumes: existing `collectGeneratedFiles`, `applicationFromContract`, `ContractArtifact`
- Produces: failing specs that define expected `jsonb` schema/migration output and rejection error text

- [ ] **Step 1: Write the failing tests**

Append two `describe` blocks after the existing “no x-hexkit.reference” suite (before “drizzle production sources”):

```ts
describe("Given a persisted schema with nested object, array, and $ref properties", () => {
  it("when the Drizzle plugin runs, then those columns are jsonb and no child tables are emitted", async () => {
    const contract: ContractArtifact = {
      artifactVersion: 1,
      openapiVersion: "3.1.0",
      application: {
        title: "Nested Embed API",
        version: "1.0.0",
        slug: "nested-embed-api",
      },
      schemas: [
        {
          name: "Label",
          modulePath: "schemas/Label.ts",
          properties: [
            {
              name: "id",
              required: true,
              type: { kind: "integer", nullable: false, format: "int32" },
            },
            {
              name: "name",
              required: true,
              type: { kind: "string", nullable: false },
            },
          ],
        },
        {
          name: "Widget",
          modulePath: "schemas/Widget.ts",
          persistence: { table: "widgets", identity: "id" },
          properties: [
            {
              name: "id",
              required: true,
              type: { kind: "integer", nullable: false, format: "int32" },
            },
            {
              name: "name",
              required: true,
              type: { kind: "string", nullable: false },
            },
            {
              name: "meta",
              required: false,
              type: {
                kind: "object",
                nullable: false,
                properties: [
                  {
                    name: "color",
                    required: true,
                    type: { kind: "string", nullable: false },
                  },
                ],
              },
            },
            {
              name: "aliases",
              required: true,
              type: {
                kind: "array",
                nullable: false,
                items: { kind: "string", nullable: false },
              },
            },
            {
              name: "label",
              required: false,
              type: { kind: "reference", nullable: false, schema: "Label" },
            },
          ],
        },
      ],
      securitySchemes: [],
      globalSecurity: [],
      operations: [
        {
          operationId: "createWidget",
          method: "post",
          path: "/widgets",
          modulePath: "routes/createWidget.ts",
          parameters: [],
          responses: [
            {
              status: "201",
              description: "created",
              media: [
                {
                  mediaType: "application/json",
                  type: { kind: "reference", nullable: false, schema: "Widget" },
                },
              ],
            },
          ],
          security: {
            overridesGlobal: false,
            requirements: [],
            apicalServerHeaderNames: [],
          },
          requestBody: {
            required: true,
            media: [
              {
                mediaType: "application/json",
                type: { kind: "reference", nullable: false, schema: "Widget" },
              },
            ],
          },
        },
      ],
    };

    const { files, artifact } = await collectGeneratedFiles(
      contract,
      applicationFromContract(contract),
    );
    const schema = files.find((file) => file.path === "src/adapters/db/schema.ts")?.contents ?? "";
    const migration =
      files.find((file) => file.path === "drizzle/0000_nested-embed-api.sql")?.contents ?? "";

    expect(schema).toContain('import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core"');
    expect(schema).toContain('meta: jsonb("meta")');
    expect(schema).toContain('aliases: jsonb("aliases").notNull()');
    expect(schema).toContain('label: jsonb("label")');
    expect(schema).not.toContain('pgTable("labels"');
    expect(migration).toContain('"meta" jsonb');
    expect(migration).toContain('"aliases" jsonb NOT NULL');
    expect(migration).toContain('"label" jsonb');
    expect(migration).not.toContain('CREATE TABLE IF NOT EXISTS "labels"');
    expect(artifact.tables).toEqual([
      expect.objectContaining({ schemaName: "Widget", tableName: "widgets" }),
    ]);
  });
});

describe("Given a property that combines $ref with x-hexkit.reference", () => {
  it("when persistence is derived, then generation fails with a clear error", async () => {
    const contract: ContractArtifact = {
      artifactVersion: 1,
      openapiVersion: "3.1.0",
      application: {
        title: "Bad Ref API",
        version: "1.0.0",
        slug: "bad-ref-api",
      },
      schemas: [
        {
          name: "Owner",
          modulePath: "schemas/Owner.ts",
          persistence: { table: "owners", identity: "id" },
          properties: [
            {
              name: "id",
              required: true,
              type: { kind: "integer", nullable: false, format: "int32" },
            },
          ],
        },
        {
          name: "Widget",
          modulePath: "schemas/Widget.ts",
          persistence: { table: "widgets", identity: "id" },
          properties: [
            {
              name: "id",
              required: true,
              type: { kind: "integer", nullable: false, format: "int32" },
            },
            {
              name: "owner",
              required: true,
              type: { kind: "reference", nullable: false, schema: "Owner" },
              reference: { schema: "Owner", property: "id" },
            },
          ],
        },
      ],
      securitySchemes: [],
      globalSecurity: [],
      operations: [
        {
          operationId: "createWidget",
          method: "post",
          path: "/widgets",
          modulePath: "routes/createWidget.ts",
          parameters: [],
          responses: [
            {
              status: "201",
              description: "created",
              media: [
                {
                  mediaType: "application/json",
                  type: { kind: "reference", nullable: false, schema: "Widget" },
                },
              ],
            },
          ],
          security: {
            overridesGlobal: false,
            requirements: [],
            apicalServerHeaderNames: [],
          },
          requestBody: {
            required: true,
            media: [
              {
                mediaType: "application/json",
                type: { kind: "reference", nullable: false, schema: "Widget" },
              },
            ],
          },
        },
      ],
    };

    await expect(
      collectGeneratedFiles(contract, applicationFromContract(contract)),
    ).rejects.toThrow(
      /Schema "Widget" property "owner".*cannot combine \$ref with x-hexkit\.reference/i,
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
vp run -r build
vp test run packages/plugin-drizzle/src/plugin.test.ts
```

Expected: FAIL — nested case throws `type "object"|"array"|"reference" is not supported for Drizzle persistence columns` (or similar); rejection case may also fail for the wrong reason until derive checks the combo first.

- [ ] **Step 3: Commit the failing tests**

```bash
git add packages/plugin-drizzle/src/plugin.test.ts
git commit -m "test(drizzle): add failing cases for jsonb nested columns"
```

---

### Task 2: Map nested types to `jsonb` and reject `$ref` + FK extension

**Files:**

- Modify: `packages/plugin-drizzle/src/model/derive.ts`
- Test: `packages/plugin-drizzle/src/plugin.test.ts`

**Interfaces:**

- Consumes: `ContractProperty.type.kind`, `ContractProperty.reference`
- Produces: `PersistenceColumnSqlType` including `"jsonb"`; derive errors for illegal combo

- [ ] **Step 1: Extend the SQL type union**

In `packages/plugin-drizzle/src/model/derive.ts`, change:

```ts
export type PersistenceColumnSqlType = "boolean" | "integer" | "text" | "enum" | "jsonb";
```

- [ ] **Step 2: Enforce evaluation order in `deriveColumn`**

Replace the body of `deriveColumn` so it follows parent-plan §4.2:

```ts
function deriveColumn(
  schemaName: string,
  property: ContractProperty,
  identity: string,
  schemasByName: ReadonlyMap<string, ContractSchema>,
): PersistenceColumnModel {
  const sqlName = toSnakeCase(property.name);

  if (property.reference !== undefined) {
    if (
      property.type.kind === "reference" ||
      property.type.kind === "object" ||
      property.type.kind === "array"
    ) {
      throw new Error(
        `Schema "${schemaName}" property "${property.name}" cannot combine $ref (or nested object/array) with x-hexkit.reference. Use a scalar FK property, or omit x-hexkit.reference to store JSONB.`,
      );
    }
  }

  const columnType = resolveColumnType(schemaName, property);

  const column: PersistenceColumnModel = {
    propertyName: property.name,
    sqlName,
    sqlType: columnType.sqlType,
    required: property.required && !property.type.nullable,
    isIdentity: property.name === identity,
    ...(columnType.enumExportName === undefined
      ? {}
      : {
          enumExportName: columnType.enumExportName,
          enumSqlName: columnType.enumSqlName,
          enumValues: columnType.enumValues,
        }),
  };

  if (property.reference !== undefined) {
    const target = schemasByName.get(property.reference.schema);
    if (target === undefined) {
      throw new Error(
        `Schema "${schemaName}" property "${property.name}" references unknown schema "${property.reference.schema}".`,
      );
    }
    if (target.persistence === undefined) {
      throw new Error(
        `Schema "${schemaName}" property "${property.name}" references "${property.reference.schema}" which has no x-hexkit.persistence.`,
      );
    }

    column.foreignKey = {
      targetSchemaName: property.reference.schema,
      targetTableExportName: target.persistence.table,
      targetColumnPropertyName: property.reference.property,
      targetColumnSqlName: toSnakeCase(property.reference.property),
    };
  }

  return column;
}
```

- [ ] **Step 3: Map nested kinds to jsonb in `resolveColumnType`**

Replace the throwing branch:

```ts
    case "reference":
    case "array":
    case "object":
      return { sqlType: "jsonb" };
```

Keep `number` throwing as today.

- [ ] **Step 4: Run nested + rejection tests (expect schema/migration still incomplete)**

```bash
vp run --filter @hexkit/plugin-drizzle build
vp test run packages/plugin-drizzle/src/plugin.test.ts
```

Expected: rejection test **PASS**. Nested test may still **FAIL** on missing `jsonb` import/emit until Task 3 (if derive succeeds but emit throws exhaustiveness errors, fix Task 3 next). If TypeScript exhaustiveness errors block the build, proceed immediately to Task 3 without a separate commit, or commit derive + stub emit together.

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-drizzle/src/model/derive.ts
git commit -m "feat(drizzle): map nested OpenAPI types to jsonb columns"
```

---

### Task 3: Emit Drizzle `jsonb()` and migration `jsonb`

**Files:**

- Modify: `packages/plugin-drizzle/src/generate/schema.ts`
- Modify: `packages/plugin-drizzle/src/generate/migration.ts`
- Test: `packages/plugin-drizzle/src/plugin.test.ts`

**Interfaces:**

- Consumes: `column.sqlType === "jsonb"`
- Produces: schema import includes `jsonb`; column `jsonb("sql_name")`; SQL `"col" jsonb`

- [ ] **Step 1: Update `collectColumnHelpers` and `renderColumnConstructor`**

In `schema.ts`:

```ts
        case "jsonb":
          helpers.add("jsonb");
          break;
```

and:

```ts
    case "jsonb":
      return `jsonb(${sqlName})`;
```

- [ ] **Step 2: Update `renderSqlType` in `migration.ts`**

```ts
    case "jsonb":
      return "jsonb";
```

- [ ] **Step 3: Run drizzle plugin tests**

```bash
vp run --filter @hexkit/plugin-drizzle build
vp test run packages/plugin-drizzle/src/plugin.test.ts
```

Expected: nested JSONB suite **PASS**; existing Petstore/Library/Auth suites **PASS**; domain-agnostic production-source scan **PASS**.

- [ ] **Step 4: Commit**

```bash
git add packages/plugin-drizzle/src/generate/schema.ts packages/plugin-drizzle/src/generate/migration.ts
git commit -m "feat(drizzle): emit jsonb columns in schema and migrations"
```

---

### Task 4: Enrich `openapi.poc.yaml` with Rich Pet

**Files:**

- Modify: `apps/petstore-sample/openapi.poc.yaml`
- Modify: virtual schema maps in tests that load the PoC contract (at least):
  - `packages/plugin-drizzle/src/plugin.test.ts` (`petstoreModules.schemas`)
  - `packages/plugin-apical/src/plugin.test.ts` (if it lists schemas)
  - `packages/plugin-architecture-hexagonal/src/plugin.test.ts`
  - `packages/plugin-hono/src/plugin.test.ts` (if applicable)
  - `packages/plugin-next/src/plugin.test.ts` (if applicable)
  - `apps/cli/src/command.test.ts`, `apps/cli/src/next-generation.test.ts`

**Interfaces:**

- Consumes: parent-plan §4.1 normative sketch
- Produces: craft + normalize succeed for Category/Tag/Pet nested fields

- [ ] **Step 1: Write a failing generation expectation**

In `apps/petstore-sample/tests/generation.test.ts`, add to `requiredOutputPaths` (sorted with neighbors):

```ts
  "src/core/domain/category.ts",
  "src/core/domain/tag.ts",
  "src/generated/contracts/schemas/Category.ts",
  "src/generated/contracts/schemas/Tag.ts",
```

- [ ] **Step 2: Run generation test (expect FAIL — paths missing)**

```bash
vp run -r build
vp test run apps/petstore-sample/tests/generation.test.ts
```

Expected: FAIL — generated tree lacks Category/Tag until OpenAPI + craft see them.

- [ ] **Step 3: Update `openapi.poc.yaml`**

Replace the `components.schemas` Pet section with the normative shape from the parent plan (keep Order + parameters unchanged). Ensure:

- `Category` and `Tag` are `type: object` with local properties only (no `x-hexkit.persistence`).
- Pet `required: [id, name, photoUrls]`.
- Pet `category` / `tags` optional; `photoUrls` required array of strings.
- Pet keeps `x-hexkit.persistence: { table: pets, identity: id }`.

Concrete Pet/Category/Tag YAML (paste into `components.schemas`):

```yaml
  schemas:
    Category:
      type: object
      properties:
        id:
          type: integer
          format: int32
        name:
          type: string
    Tag:
      type: object
      properties:
        id:
          type: integer
          format: int32
        name:
          type: string
    Pet:
      type: object
      x-hexkit:
        persistence:
          table: pets
          identity: id
      required:
        - id
        - name
        - photoUrls
      properties:
        id:
          type: integer
          format: int32
        name:
          type: string
        status:
          type: string
          enum:
            - available
            - pending
            - sold
        category:
          $ref: "#/components/schemas/Category"
        photoUrls:
          type: array
          items:
            type: string
        tags:
          type: array
          items:
            $ref: "#/components/schemas/Tag"
    Order:
      # existing Order schema unchanged
```

Keep the existing `Order` block as-is after `Pet`.

- [ ] **Step 4: Update every virtual Apical `schemas` map that loads `openapi.poc.yaml`**

Example for drizzle `petstoreModules`:

```ts
  schemas: new Map([
    ["Category", "schemas/Category.ts"],
    ["Order", "schemas/Order.ts"],
    ["Pet", "schemas/Pet.ts"],
    ["Tag", "schemas/Tag.ts"],
  ]),
```

Apply the same Category/Tag entries wherever PoC schema maps are hardcoded.

- [ ] **Step 5: Refresh Drizzle Petstore inline snapshots**

Run:

```bash
vp run -r build
vp test run packages/plugin-drizzle/src/plugin.test.ts -u
```

Confirm schema snapshot includes:

```ts
photoUrls: jsonb("photo_urls").notNull(),
category: jsonb("category"),
tags: jsonb("tags"),
```

and migration has matching `jsonb` columns. Confirm **no** `categories` / `tags` tables. Confirm Order FK still integer + `.references(() => pets.id)`.

Update `updatePet` `.set({...})` snapshot to include `category`, `photoUrls`, `tags` if the snapshot lists fields explicitly.

- [ ] **Step 6: Fix hexagonal / apical / hono / next / cli tests**

```bash
vp test run packages/plugin-apical packages/plugin-architecture-hexagonal packages/plugin-hono packages/plugin-next apps/cli apps/petstore-sample/tests/generation.test.ts
```

Update snapshots/expectations for:

- `src/core/domain/category.ts`, `tag.ts`
- Pet domain type including `category?`, `photoUrls`, `tags?`
- Craft schema index exports

Expected: all **PASS**.

- [ ] **Step 7: Commit**

```bash
git add apps/petstore-sample/openapi.poc.yaml apps/petstore-sample/tests/generation.test.ts \
  packages/plugin-drizzle packages/plugin-apical packages/plugin-architecture-hexagonal \
  packages/plugin-hono packages/plugin-next apps/cli
git commit -m "feat(petstore): enrich PoC Pet with nested Category, Tag, photoUrls"
```

---

### Task 5: Pactum acceptance for nested round-trips

**Files:**

- Modify: `apps/petstore-sample/tests/api.test.ts`

**Interfaces:**

- Consumes: running dogfood API (`PETSTORE_API_URL`)
- Produces: three normative cases from parent plan §4.1

- [ ] **Step 1: Update pet payloads**

Replace `addedPet` / `updatedPet` with nested variants and add a minimal pet used only if you split cases—or evolve the sequential suite as follows:

```ts
const addedPet = {
  id: petId,
  name: `Hexkit dogfood pet ${String(petId)}`,
  status: "available",
  category: { id: 1, name: "Dogs" },
  photoUrls: [`https://example.test/pets/${String(petId)}.jpg`],
  tags: [{ id: 10, name: "friendly" }],
};

const updatedPet = {
  ...addedPet,
  name: `Updated Hexkit dogfood pet ${String(petId)}`,
  status: "sold",
  category: { id: 2, name: "Working Dogs" },
  photoUrls: [
    `https://example.test/pets/${String(petId)}.jpg`,
    `https://example.test/pets/${String(petId)}-2.jpg`,
  ],
  tags: [
    { id: 10, name: "friendly" },
    { id: 11, name: "trained" },
  ],
};

const minimalPet = {
  id: petId + 1,
  name: `Minimal Hexkit pet ${String(petId + 1)}`,
  photoUrls: [] as string[],
};
```

- [ ] **Step 2: Keep existing sequential flow on `addedPet`/`updatedPet` (full nest)**

Existing add → update → get assertions already cover cases 1 and 3 if payloads include nests.

- [ ] **Step 3: Add minimal-required case before deletes**

Insert before Order tests (or after Pet get):

```ts
  it("when a Pet is added with only required nested fields, then empty photoUrls round-trip", async () => {
    await runAgainstApi(() =>
      spec().post("/pet").withJson(minimalPet).expectStatus(201).expectJson(minimalPet),
    );
    await runAgainstApi(() =>
      spec()
        .get(`/pet/${String(minimalPet.id)}`)
        .expectStatus(200)
        .expectJson(minimalPet),
    );
  });
```

Ensure delete tests still delete `petId` (full nest). Optionally delete `minimalPet.id` too, or leave it (FK Order only references `petId`).

- [ ] **Step 4: Run unit portion without Compose (optional sanity)**

```bash
vp test run apps/petstore-sample/tests/api-fixtures.test.ts apps/petstore-sample/tests/generation.test.ts
```

Expected: PASS (api.test needs Compose).

- [ ] **Step 5: Run Hono dogfood**

```bash
vp run -r build
vp run dogfood
```

Expected: Compose up; all Pactum tests PASS including nested and minimal cases. Generated migration must not create Category/Tag tables.

- [ ] **Step 6: Commit**

```bash
git add apps/petstore-sample/tests/api.test.ts
git commit -m "test(petstore): cover Rich Pet JSONB round-trips in Pactum"
```

---

### Task 6: Regenerate `apps/petstore-next` checked-in tree

**Files:**

- Modify: generated/overlaid files under `apps/petstore-next/` (via dogfood script)
- Modify: any Next overlay that hardcodes Pet form fields (if present under `apps/petstore-next` hand-written UI)

**Interfaces:**

- Consumes: same `openapi.poc.yaml`
- Produces: Next fixture compiles with nested Pet JSON

- [ ] **Step 1: Generate-only Next dogfood into the fixture**

```bash
vp run -r build
HEXKIT_SKIP_COMPOSE=1 HEXKIT_DOGFOOD_OUTPUT="$(pwd)/apps/petstore-next" vp run dogfood-petstore-next
```

If the script refuses to write onto the fixture directory, follow `apps/petstore-next/README.md` for the supported regen path (generate to temp + `overlay-fixture.sh`). Use the repo’s documented flow; do not invent a second overlay.

- [ ] **Step 2: Update hand-written PetShop UI/actions if forms omit new required `photoUrls`**

Search:

```bash
rg -n "photoUrls|addPet|updatePet|readPet" apps/petstore-next --glob '!**/generated/**'
```

Ensure Server Actions / forms supply at least `photoUrls: []` (or inputs) so creates validate.

- [ ] **Step 3: Typecheck / lint Next fixture as documented**

```bash
cd apps/petstore-next && vp node ./node_modules/typescript/bin/tsc --noEmit
```

(or the README’s preferred check). Expected: no errors from nested Pet types.

- [ ] **Step 4: Commit**

```bash
git add apps/petstore-next
git commit -m "chore(petstore-next): regen fixture for Rich Pet JSONB fields"
```

---

### Task 7: Docs + verification gate

**Files:**

- Modify: `docs/superpowers/plans/2026-08-20-rich-pet-nested-persistence.md` (mark Phase 1 delivered checklist items)
- Modify: `docs/README.md` status row for nested persistence
- Modify: `PRD.md` §11 follow-ups — one bullet noting JSONB default for nested embeds (Phase 2 relational opt-in still open)
- Modify: `README.md` project status if it lists OpenAPI coverage

- [ ] **Step 1: Update status docs**

Parent plan §10: check “Ready for a Phase 1 implementation task plan” is done; add “Phase 1 implemented on `main`” when this work merges.

- [ ] **Step 2: Full verification**

```bash
vp run -r build
vp check
vp run -r test
vp run dogfood
```

Expected: all green. Spot-check generated migration from dogfood output: `photo_urls jsonb NOT NULL`, optional `category`/`tags` jsonb, no category/tag tables.

- [ ] **Step 3: Commit**

```bash
git add docs PRD.md README.md
git commit -m "docs: record Rich Pet JSONB Phase 1 delivery"
```

---

## Spec coverage checklist (self-review)

| Parent plan requirement | Task |
| ----------------------- | ---- |
| `jsonb` SQL type + Drizzle `jsonb()` | 2–3 |
| Map object/array/bare `$ref` → JSONB | 2 |
| Reject `$ref` + `x-hexkit.reference` | 1–2 |
| Target persistence does not force relation | 1 (Label has no table) |
| Mapper passthrough / `Schema.parse` | unchanged; snapshots in 4 |
| Rich Pet OpenAPI shape | 4 |
| Category/Tag craft + domain, no tables | 4–5 |
| Three Pactum round-trips | 5 |
| Next fixture regen | 6 |
| Docs | 7 |
| No Phase 2 relational / query filters / XML | out of scope |

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-20-rich-pet-jsonb-phase1.md`. Two execution options:

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — execute tasks in this session with executing-plans checkpoints  

Which approach?
