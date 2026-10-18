# getInventory group-count — implementation notes (paused)

**Branch:** `feat/getinventory-group-count` (cut from `main` @ `f689d59`)
**Status:** Paused mid-implementation. Design approved and committed
([`../specs/2026-10-16-getinventory-group-count-design.md`](../specs/2026-10-16-getinventory-group-count-design.md));
production code done, test suite partially updated. **No PR yet** (per user).

## Done (all verified building: `vp run -F './packages/*' -F './apps/cli' build` ✅)

- **`apps/petstore-sample/openapi.poc.yaml`** — `GET /store/inventory` with
  `x-hexkit.operation {aggregate: Pet, action: get, groupBy: status}`,
  `security: [api_key]`, 200 → JSON object with
  `additionalProperties: {type: integer, format: int32}`.
- **`plugin-apical`** (`src/contract/`):
  - `types.ts` — `ContractObjectType.additionalProperties?: ContractType`;
    `ContractOperationExtension.groupBy?: string`.
  - `type-normalize.ts` — object branch reads schema-valued
    `additionalProperties` (booleans ignored); error when `properties` **and**
    a schema-valued map coexist; helper `readAdditionalProperties`.
  - `extensions.ts` — `x-hexkit.operation` accepts optional `groupBy`
    (`assertOnlyKeys` + `optionalString`).
  - `validate-artifact.ts` — `validateType` recurses into
    `additionalProperties`; new `validateGroupBy(operation)`: group-by ops
    must have **no parameters**, a **2xx `application/json`** response typed as
    object-with-map, and **integer** map values.
- **`plugin-architecture-hexagonal`**:
  - `artifact.ts` — `PersistenceKind` += `"group-count"`.
  - `model/repository.ts` — `PersistenceKindOptions.groupBy?`;
    `persistenceKindFromAction` returns `group-count` for select actions
    **before** the 0-parameter→stub branch; throws for group-by + non-select
    action; `deriveRepositoryMethod` passes `operation.extension?.groupBy`.
  - `model/type-render.ts` — object case with `additionalProperties` renders
    `Record<string, ${V}>` + nullable suffix (value rendered without parent
    `enumTypeName` to avoid alias collisions).
- **`plugin-drizzle`**:
  - `model/repository.ts` — `PersistenceRepositoryMethodModel.groupByColumn?`;
    `resolveGroupByColumn` validates extension presence + column-on-table.
  - `generate/repository.ts` — `count` added to `drizzle-orm` imports when any
    method is `group-count`; `case "group-count"` renders select-projection +
    `groupBy` + `Object.fromEntries(... as const)`; null-key `.filter` emitted
    **only when the column is nullable** (`!column.required`).
- **`docs/superpowers/specs/2026-10-16-getinventory-group-count-design.md`** —
  design doc (status line still says "implemented"; update when done).

**Smoke-checked:** standalone `vp node apps/cli/dist/index.mjs generate
apps/petstore-sample/openapi.poc.yaml /tmp/hexkit-gi-debug` → exit 0;
`src/adapters/db/pet-repository.ts` renders the group-count body; real craft
emits `routes/getInventory.ts`, `schemas/GetInventory200Response.ts`,
`schemas/getInventoryParameters.ts`, `server/getInventory.ts` plus index
entries (incl. `getInventoryHeadersSchema` — api_key header schema).
`/tmp/hexkit-gi-debug` may still exist as a reference; regenerate if not.

## Test status (last full run)

| Suite                                                                     | State               | Fix needed                                                                                                                                                          |
| ------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `plugin-apical`                                                           | ✅ 93/93            | — (snapshot + `expectedOperations` updated)                                                                                                                         |
| `plugin-architecture-hexagonal`                                           | ❌ 1                | **Snapshot 2** mismatched → `vp test run -u` in the package, review diff = only `getInventory` additions (modules map + file-list entry already added)              |
| `plugin-hono`                                                             | ❌ 1                | `src/plugin.test.ts` `petstoreModules` map: add `["getInventory", "routes/getInventory.ts"]` (same pattern as hexagonal, between `findPetsByTags` and `placeOrder`) |
| `plugin-next`                                                             | ❌ 1                | Same `petstoreModules` map fix as hono                                                                                                                              |
| `@hexkit/cli`                                                             | ❌ 5                | See below                                                                                                                                                           |
| `plugin-drizzle`, `shared`, `core`, `plugin-api`, `codegen`, `plugin-sst` | ✅                  | —                                                                                                                                                                   |
| `apps/petstore-sample` tests                                              | not yet run/updated | see step 3 + 4                                                                                                                                                      |

### `apps/cli` failures — root cause identified

Both `src/command.test.ts` and `src/next-generation.test.ts` inject
**hand-maintained craft-output fixtures**; normalization then throws
"OpenAPI operation getInventory has no matching entry in Apical routes/index.ts"
→ generation exits 1 (and later assertions see missing `package.json` →
`SyntaxError: Unexpected end of JSON input`). Update, using real craft output
above as the source of truth:

1. `petstoreApicalContractPaths` (**both files**): add `routes/getInventory.ts`,
   `schemas/GetInventory200Response.ts`, `schemas/getInventoryParameters.ts`,
   `server/getInventory.ts` (keep sorted).
2. Routes-index fixture (`petstoreRoutesIndex` in `command.test.ts`; check
   `next-generation.test.ts` for its own): add the export line, the
   `import { serverRoute as getInventoryRoute } …`, and
   `getInventory: getInventoryRoute,` (mirror `routes/index.ts:10,31,53` of the
   real output).
3. Schemas-index fixture (`petstoreSchemasIndex`): add
   `getInventoryHeadersSchema` import from `./getInventoryParameters.ts` and
   the `GetInventory200Response` export (mirror real `schemas/index.ts:23-24,76`).
4. Expected generated-output lists (`command.test.ts` ~lines 40/71/91 and
   ~638/669/689): add the 4 craft files + `src/core/application/get-inventory.ts`.
5. Re-run `vp run -F @hexkit/cli test`; fix remaining exact-list assertions.

## Remaining work (in order)

1. **Green tests** — apply the table fixes above + CLI fixture updates; re-run
   `vp run -F './packages/*' -F './apps/cli' test`.
2. **`apps/petstore-sample/tests/generation.test.ts`** — `requiredOutputPaths`
   is an **exact** file list (`toEqual`): add
   `src/core/application/get-inventory.ts`, `src/generated/contracts/routes/getInventory.ts`,
   `src/generated/contracts/schemas/GetInventory200Response.ts`,
   `src/generated/contracts/schemas/getInventoryParameters.ts`,
   `src/generated/contracts/server/getInventory.ts` (sorted position). Consider
   content assertions mirroring neighbors (e.g. pet-repository contains
   `groupBy(pets.status)` / `Object.fromEntries`).
3. **New Pactum test** — `apps/petstore-sample/tests/api/store/inventory.test.ts`
   (pattern: `tests/api/pet/get.test.ts` for auth, `tests/api/store/get.test.ts`
   for seeding):
   - 401 without `api_key`; 401 with rejected key (`runAgainstApi`,
     `goodApiKey` from `tests/api/helpers.ts`).
   - Relative counts: read `/store/inventory` → `POST /pet` one `available` +
     one `sold` pet → inventory delta exactly `+1` each (other test files seed
     the shared DB, so never assert absolute totals).
   - Runs only against a live stack (dogfood) or `PETSTORE_API_URL`.
4. **New unit tests** (90% gate: `vp run coverage`):
   - `plugin-apical`: map preserved through normalize; boolean
     `additionalProperties` ignored; properties+map error; `groupBy` extension
     read + unknown-key rejection; `validateGroupBy` error cases (params
     present / no 2xx JSON map / non-integer values) + `$ref` inside map
     validated.
   - hexagonal: `type-render` `Record<string, number>` (+ nullable +
     referencedSchemas); `persistenceKindFromAction` group-count precedence
     over 0-param stub and non-select error.
   - drizzle: `resolveGroupByColumn` happy/missing-column/missing-extension;
     generate case body, conditional null filter, `count` import.
5. **Tracker** — `docs/petstore-openapi-progress.md` (same PR): `getInventory`
   row → Hono **`shipped`**, Next **`partial`** (Next dogfood runs no API
   tests); notes = map response + `api_key` E2E-proven / generation-proven;
   Summary tallies (Hono shipped 3→4, missing 5→4; Next partial 19→20,
   missing 6→5); `Last updated` → change date.
6. **Gates** — `vp check --fix` → build → all tests → `vp run coverage` →
   dogfood: `vp run dogfood:petstore:hono` (Docker; Pactum incl. new test) →
   `HEXKIT_SKIP_COMPOSE=1 vp run dogfood:petstore:nextjs`.
7. **PR** — user said: push branch now, **create PR only when done**.

## Invariants to preserve (from the design doc)

- No Petstore literals in `packages/**` (`apps/cli/src/domain-agnostic.test.ts`
  scans production sources; e.g. banned words include `Pet`, `Order`,
  `pending`).
- Group-by ops: no parameters, integer map values, select-classified action —
  all fail fast at generation with operation-id-bearing errors.
- Null-key filter only for nullable group-by columns; `as const` tuples keep
  `Object.fromEntries` typed (`{ [k: string]: number }`, not `any`).
- Hono `shipped` / Next `partial` for the tracker row (approved judgment call).
- Commit hook runs `vp staged` → `vp check --fix` on staged files (format +
  lint autofix); expect it to rewrap long lines.
