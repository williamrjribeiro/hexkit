# getInventory map responses + group-count persistence — design

**Status:** Approved 2026-10-16; **implemented** on
`feat/getinventory-group-count` (complete — see
[`../plans/2026-10-18-getinventory-group-count.md`](../plans/2026-10-18-getinventory-group-count.md)
for completion notes).

## Problem

`GET /store/inventory` (full Petstore) returns a **map** — `type: object` with
`additionalProperties: { type: integer, format: int32 }` — and requires header
`api_key`. Walking that shape through the pipeline today breaks in three places:

1. **Silent data loss:** contract normalization drops `additionalProperties`
   (`packages/plugin-apical/src/contract/type-normalize.ts`), so the IR models
   the response as an empty object and ports render `{}` instead of
   `Record<string, number>`.
2. **Codegen failure:** `resolveAggregate` cannot infer an aggregate for a
   parameterless read with an inline (non-`$ref`) response and throws
   (`packages/plugin-architecture-hexagonal/src/model/aggregate.ts`).
3. **Runtime 500:** the Drizzle repository classifies a 0-parameter `GET` as a
   `stub`, whose `return { ok: true }` fails Apical's response-map parse
   (`z.object({}).catchall(z.number().int())`) → HTTP 500.

Apical/Craft already emits map schemas (`z … .catchall(z.number().int())`,
`{ [key: string]: number }`) and header-`apiKey` enforcement is fully derived
from the OpenAPI `security` block (same chain as `getPetById`). No adapter
changes are needed.

## Decision

Generate **real group-by counts** instead of an empty-map stub: an explicit
`x-hexkit.operation.groupBy` hint tells the Drizzle adapter which column to
group, so the generated repository runs `SELECT <column>, COUNT(*) … GROUP BY
<column>` and returns `Record<string, number>`. Pactum E2E seeds pets and
asserts exact inventory deltas — DB read, auth, validation, and serialization
are all proven.

Rejected alternatives: empty-map stub (E2E proves only shape; tracker would
stay `partial`, matching the `loginUser`/`logoutUser` stub precedent);
inferred group-by column (not derivable from OpenAPI; would invent contract
semantics).

## Contract shape

```yaml
/store/inventory:
  get:
    operationId: getInventory
    x-hexkit:
      operation:
        aggregate: Pet # existing required key pair (with action)
        action: get # existing → select classification
        groupBy: status # NEW optional key
    security:
      - api_key: [] # full-spec shape; enforceable (no oauth2 branch)
    responses:
      "200":
        description: Inventory by status
        content:
          application/json:
            schema:
              type: object
              additionalProperties:
                type: integer
                format: int32
      "default":
        description: Unexpected error
```

## Pipeline changes

### 1. Contract IR (`@hexkit/plugin-apical`)

- `ContractObjectType` gains `additionalProperties?: ContractType`.
- `normalizeContractType` object branch reads it: absent / `false` / `true`
  → no map (booleans are ignored, as today — v1 supports schema-valued maps
  only); a schema object normalizes recursively.
- **Guard:** `properties` **and** a schema-valued `additionalProperties` on the
  same object → explicit generation error (no checked-in contract needs the
  combination; partial support would be silent loss again).
- `validateArtifactReferences` recurses into `additionalProperties` (unknown
  `$ref`s inside maps still fail).
- `x-hexkit.operation` accepts optional `groupBy` (`assertOnlyKeys` extended;
  `aggregate` + `action` stay required when the block is present).
- New artifact validation for `groupBy`, reported with the operation id:
  - some 2xx JSON response media must be an object **with** a schema-valued
    `additionalProperties`;
  - that `additionalProperties` must be an **integer** scalar (group counts are
    integers; keeps `COUNT(*)` ↔ type alignment).

### 2. Type rendering (`@hexkit/plugin-architecture-hexagonal`)

`renderContractType` object case: with `additionalProperties` set (and no
properties — enforced at normalization) renders
`Record<string, ${value}>` with the usual nullable suffix. Ports, use cases,
and repository methods all get `Promise<Record<string, number>>`.

### 3. Persistence kind

- `PersistenceKind` gains `"group-count"`.
- `persistenceKindFromAction`: a present `groupBy` returns `group-count` for
  select-classified actions **before** the `parameterCount === 0 → stub`
  branch; a non-select action paired with `groupBy` throws (explicit beats
  silently generating the wrong kind).

### 4. Drizzle adapter (`@hexkit/plugin-drizzle`)

- Method model carries `groupByColumn?`; set from the operation extension.
- Generation-time validation: the column must exist on the aggregate's
  persistence table (missing table already errors today).
- Rendered body (`count` imported from `drizzle-orm`):

  ```ts
  async getInventory(): Promise<Record<string, number>> {
    const rows = await db
      .select({ key: pets.status, value: count() })
      .from(pets)
      .groupBy(pets.status);
    return Object.fromEntries(
      rows.filter((row) => row.key !== null).map((row) => [row.key, row.value]),
    );
  }
  ```

  The null-key filter is emitted only when the group-by column is nullable
  (`required: false` in the contract) — `GROUP BY` yields a `NULL` key that a
  `Record<string, …>` map cannot represent.

### 5. Adapters — unchanged

Hono/Next controllers parse through Apical's response map and serialize
`data: unknown`; `api_key` middleware, 401 mapping, and `requiresAuth` wiring
derive from `security` exactly as for `getPetById`.

## Testing

- **Unit (90% coverage gate):** normalization (map preserved, booleans
  ignored, both-shapes error), extension parsing (`groupBy` accepted, unknown
  keys rejected), artifact validation (all three `groupBy` failures + map
  `$ref` recursion), type rendering (`Record<string, number>`), persistence
  kind (group-count precedence, non-select error), Drizzle model (column
  validation) and rendering (query body, conditional null filter, `count`
  import).
- **Pactum E2E** (`apps/petstore-sample/tests/api/store/inventory.test.ts`):
  401 without `api_key`, 401 with a rejected key, then relative counts — read
  inventory → add one `available` + one `sold` pet → inventory delta is exactly
  `+1` each (robust to pets seeded by other files sharing the database).
- **Generation tests:** exact file lists in
  `apps/petstore-sample/tests/generation.test.ts` and
  `apps/cli/src/command.test.ts` gain the `getInventory` artifacts.
- **Dogfood:** `vp run dogfood:petstore:hono` (Compose + Pactum);
  `HEXKIT_SKIP_COMPOSE=1 vp run dogfood:petstore:nextjs` proves the shared
  repository code builds under Next.

## Tracker

Same PR updates `docs/petstore-openapi-progress.md`: `getInventory` →
Hono `shipped` (map response + `api_key` E2E-proven), Next `partial`
(generation-proven; the Next dogfood runs no API tests).

## Non-goals

- Running the Pactum suite against the Next dogfood (tracked follow-up).
- `properties` + schema-valued `additionalProperties` on one object.
- Boolean (`true`/`false`) `additionalProperties` semantics.
- Any other tracker rows (form-urlencoded, OAuth, webhooks, mutualTLS).
