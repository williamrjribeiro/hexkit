# Rich Pet Nested Persistence — Phased Plan

**Status:** Phase 1 implemented (JSONB default); Phase 2 relational opt-in still open  
**Date:** 2026-08-20  
**Companion:** [PRD.md](../../../PRD.md) §3.1 / §11, [RFC.md](../../../RFC.md)  
**Fixture contract:** `apps/petstore-sample/openapi.poc.yaml` (normative dogfood)  
**Reference (do not edit for this work):** `apps/petstore-sample/openapi.yaml`

## 1. Goal

Expand Hexkit so OpenAPI schemas with **nested objects, arrays, and `$ref` values** can persist through the generated Drizzle adapter—starting with a **Rich Pet** in the Petstore PoC—without forcing every nested shape into relational tables.

**Default rule:** nested structure without an explicit relational `x-hexkit` marker is stored as **JSONB**.  
**Later rule:** an opt-in `x-hexkit` marker promotes a nested shape into **tables / FKs / joins**.

## 2. Why this capability

CRUD HTTP methods (GET/POST/PUT/DELETE) are already method-agnostic in the generators. The PoC Pet is deliberately flat. The checked-in Petstore 3.1 reference uses a richer Pet (`Category`, `Tag[]`, `photoUrls[]`), and Drizzle today **throws** on `object` / `array` / bare `$ref` columns.

Closing that gap improves OpenAPI fidelity where it currently breaks generation, while staying domain-agnostic (Petstore is a fixture, not plugin logic).

## 3. Current behavior (baseline)

| Layer | Nested `object` / `array` / `$ref` |
| ----- | ---------------------------------- |
| `@hexkit/plugin-apical` IR | Supported in `ContractType` (`normalizeContractType`) |
| `@hexkit/plugin-architecture-hexagonal` domain | Renders nested types and referenced entity files (one domain file per component schema) |
| `@hexkit/plugin-hono` / `@hexkit/plugin-next` | JSON request/response via Apical maps (no special case needed for nested JSON) |
| `@hexkit/plugin-drizzle` | **Fails** in `resolveColumnType` for `reference` / `array` / `object` |
| Scalar FK via property `x-hexkit.reference` | Already works (e.g. `Order.petId` → FK); FK attach runs after column type resolution |
| Schemas without `x-hexkit.persistence` | No Drizzle table (filtered out of `derivePersistenceModel`); still must appear in Apical craft `schemas/index.ts` and get hexagonal domain files |

## 4. Functionality to support

### 4.1 Rich Pet (dogfood shape)

Extend `openapi.poc.yaml` **Pet** toward the reference Petstore shape, keeping PoC rules (JSON only, no security, no XML, local `#/components/schemas/...` refs only):

| Field | OpenAPI shape | `required` on Pet | Phase 1 persistence |
| ----- | ------------- | ----------------- | ------------------- |
| `id` | integer | yes | column (identity) |
| `name` | string | yes | `text` column |
| `status` | string enum | no | enum column (existing) |
| `category` | `$ref` → `Category` | no | **jsonb** (omit → SQL NULL → domain `undefined`) |
| `photoUrls` | `array` of string | **yes** (Petstore-shaped) | **jsonb** (empty `[]` allowed) |
| `tags` | `array` of `$ref` → `Tag` | no | **jsonb** (omit → NULL/`undefined`; empty `[]` allowed when present) |

Normative fixture sketch (illustrative):

```yaml
Category:
  type: object
  properties:
    id: { type: integer, format: int32 }
    name: { type: string }
Tag:
  type: object
  properties:
    id: { type: integer, format: int32 }
    name: { type: string }
Pet:
  type: object
  x-hexkit:
    persistence: { table: pets, identity: id }
  required: [id, name, photoUrls]
  properties:
    id: { type: integer, format: int32 }
    name: { type: string }
    status:
      type: string
      enum: [available, pending, sold]
    category:
      $ref: "#/components/schemas/Category"
    photoUrls:
      type: array
      items: { type: string }
    tags:
      type: array
      items:
        $ref: "#/components/schemas/Tag"
```

`Category` and `Tag` are plain object schemas **without** `x-hexkit.persistence` in Phase 1 (domain types + Apical craft modules only — **no** tables/migrations).

Do **not** import from the reference file: missing `type: object`, absolute/`$id` `$ref`s, `PetDetails`, XML media, or oauth.

**Normative round-trip cases (dogfood):**

1. Full nest — `category`, non-empty `photoUrls`, non-empty `tags`  
2. Minimal required — omit `category` / `tags` / `status`; `photoUrls: []`  
3. Update — PUT changes nested fields and round-trips on GET  

### 4.2 Persistence decision tree (Phase 1 evaluation order)

Evaluate **in this order** for each property on a schema that has `x-hexkit.persistence`:

1. **Scalar FK** — If `property.reference` (`x-hexkit.reference`) is set:  
   - Require a **scalar** column type (`boolean` / `integer` / `string` ± enum).  
   - Emit FK column (existing behavior).  
   - **Reject** combining `$ref` (`type.kind === "reference"`) with `x-hexkit.reference` on the same property (fail at derive with a clear error).  

2. **Nested JSONB** — Else if `type.kind` is `object`, `array`, or `reference` (bare `$ref`):  
   - Emit **jsonb** column.  
   - Target schema `x-hexkit.persistence` (if any) does **not** change this — embed stays JSONB until Phase 2 property-level opt-in.  

3. **Scalars** — Else map `boolean` / `integer` / `string` (± enum) as today (`number` still unsupported).

Phase 2 adds a relational opt-in branch **before** step 2 (see §5 Phase 2). Until then, absence of a relational marker always means JSONB for nested structured types.

### 4.3 Extension conventions

Keep the single OpenAPI vendor object **`x-hexkit`** (same as `persistence` / `reference` / `operation`). Do **not** introduce a parallel top-level key such as `x-hexkit-entity`.

| Phase | Marker | Meaning |
| ----- | ------ | ------- |
| 1 | *(absence of relational marker)* | Nested value → JSONB |
| 1 | `x-hexkit.reference` on a **scalar** property | FK (unchanged) |
| 2 | Property-level opt-in under `x-hexkit` (exact key TBD in Phase 2 spike; requires `assertOnlyKeys` allowlist update in Apical) | Promote nested shape to relational storage |

Phase 1 explicitly requires **no new extension** for the JSONB default.

### 4.4 Domain-agnostic invariant

Plugins must not hardcode Pet / Category / Tag. Behavior is driven only by OpenAPI + `ContractArtifact` + existing hexagonal ports. Petstore changes live in `apps/petstore-sample/` (and Next dogfood regen as needed). Library/auth fixtures stay unchanged in Phase 1 (Petstore-only dogfood); plugin unit tests should use **generic** nested fixtures where practical.

## 5. Incremental phases

### Phase 1 — JSONB default for nested fields

**Intent:** Make Rich Pet generate, migrate, run, and dogfood with nested JSON bodies.

**Deliverables**

1. **Drizzle model**
   - Extend `PersistenceColumnSqlType` with **`jsonb`** (Postgres JSONB only — not `json`).
   - Map `object` / `array` / bare `$ref` per §4.2 to JSONB columns.
   - Emit Drizzle `jsonb(...)` in `schema.ts` and migration column type `jsonb`.
   - Reject `$ref` + `x-hexkit.reference` on the same property.

2. **Mappers & write path**
   - Keep today’s shape: **Row → domain** via Apical `Schema.parse` (with `?? undefined` for optional/nullable columns, including JSONB nulls).  
   - **Insert/update:** passthrough nested objects/arrays into `jsonb` columns (same `.values(entity)` / `.set({...})` pattern as scalars). Add a cast/helper **only if** Drizzle/`$infer*` typing requires it — do not invent a separate domain→row serializer layer in Phase 1.  
   - No `JSON.parse`/`JSON.stringify` unless runtime evidence shows the driver returns strings.

3. **Repository methods**
   - Existing `insert` / `update` / `select` / `delete` keep working; `.set({...})` includes JSONB fields like other columns.
   - No multi-table transactions in Phase 1.

4. **Apical / hexagonal / HTTP**
   - Expect little or no plugin logic change if IR and domain already render nested types.
   - Confirm Apical craft + normalize accept the enriched PoC schemas (local `$ref`s, `type: object` on components).
   - **Required outputs for Category/Tag:** craft schema modules in `schemas/index.ts`, hexagonal `src/core/domain/category.ts` and `tag.ts` (or kebab equivalents). **No** Category/Tag tables or migrations.
   - Update `apps/petstore-sample/tests/generation.test.ts` (and Next path lists if applicable) for new domain/craft paths.

5. **Fixture & dogfood**
   - Update `openapi.poc.yaml` per §4.1.
   - Update Hono Pactum tests for the three normative round-trip cases.
   - Regenerate / align `apps/petstore-next` checked-in output if the shared contract drives it.

6. **Docs**
   - Note the JSONB default in PRD follow-ups / README status as appropriate after implementation.
   - Leave reference `openapi.yaml` untouched.

**Success criteria (Phase 1)**

- `vp run -r build` and relevant package tests pass; generated app typechecks with nested columns.
- Generating from enriched `openapi.poc.yaml` no longer throws in Drizzle derive.
- Compose dogfood: all three normative Pet cases survive POST → GET and PUT → GET.
- No `categories` / `tags` tables in generated migration.
- Order FK behavior unchanged; FK fixtures still emit integer FK columns (not JSONB).
- `$ref` + `x-hexkit.reference` on one property fails loudly in unit tests.
- No new `x-hexkit` keys required for nested embed.

**Explicitly out of Phase 1**

- Relational promotion / junction tables.
- Query filters (`findByStatus` / `findByTags`).
- XML, webhooks, oauth2, multipart/uploads.
- `oneOf` / `allOf` / `anyOf`, `additionalProperties` maps.
- Copying exotic reference-file `$ref` / `$id` / `$anchor` forms.
- Nested JSONB examples in `library-api` (optional follow-up, not required).

---

### Phase 2 — Opt-in relational entity storage

**Intent:** When authors opt in, nested (or referenced) schemas become first-class tables with FK (and later M:N) mapping, instead of JSONB.

**Prerequisite:** Phase 1 green; JSONB remains the default when the opt-in is absent.

**Design spike (before coding Phase 2)**

Lock a **property-level** `x-hexkit` shape (illustrative — finalize in a short design addendum). Schema-level “`$ref` to a persisted schema implies relation” (**Option B**) is **rejected as a default**: it conflicts with Phase 1’s JSONB default and creates a dual-write footgun (Category table exists while `Pet.category` remains JSONB).

```yaml
# Property-level opt-in only (preferred)
category:
  $ref: "#/components/schemas/Category"
  x-hexkit:
    storage: relation   # exact key TBD; must extend Apical assertOnlyKeys allowlists
```

If authors add `x-hexkit.persistence` to `Category` **without** a property-level relation opt-in on `Pet.category`, Phase 1/2 behavior is: **JSONB embed unchanged**; Category may also get an unused table if some other aggregate uses it — spike should decide warn vs allow.

Document precedence (evaluation order):

1. Scalar `x-hexkit.reference` → FK column (today; scalar only).  
2. Phase 2 **property-level** relational opt-in → table + FK / joins.  
3. Else nested structured type → JSONB (Phase 1).

**Deliverables (after spike)**

1. **IR** — parse new property-level key(s); update `assertOnlyKeys` allowlists; carry storage mode on `ContractArtifact`.
2. **Drizzle**
   - Create/ensure target table from schema `x-hexkit.persistence`.
   - For to-one embeds (Category): FK column on parent + join (or select+hydrate) on read; split embed on write.
   - For to-many (tags): junction table strategy; transactional insert/update/delete (second slice inside Phase 2).
3. **Dogfood** — at least one nested field promoted to relation in a fixture (Petstore or library-api), with Pactum coverage.
4. **Docs** — authoring guide: when to use JSONB vs relation.

**Success criteria (Phase 2)**

- Same contract can mix JSONB fields and relational fields without ambiguity.
- Deleting a parent respects declared FK / junction rules (define cascade vs restrict in the spike).
- Domain types still match OpenAPI nested shapes at the HTTP boundary (adapters map storage ↔ API).

**Explicitly out of Phase 2 (unless spike says otherwise)**

- Full classic Petstore surface (Users, inventory, uploads, find-by-\*).
- OAuth scope enforcement.
- Soft deletes / JSON Patch partial updates.

---

### Phase 3+ (backlog only — not scheduled here)

Tracked so this plan does not silently expand:

| Theme | Notes |
| ----- | ----- |
| Query parameters + filtered lists | Separate capability; may query JSONB or relational tags later |
| form-urlencoded / multipart / files | Separate capability |
| Webhooks | Present only on reference YAML; separate capability |
| Composition keywords / `additionalProperties` | Separate capability |

## 6. Package impact map

| Package / app | Phase 1 | Phase 2 |
| ------------- | ------- | ------- |
| `plugin-apical` | Verify normalize; likely unchanged logic | Extension parse + IR field + `assertOnlyKeys` |
| `plugin-architecture-hexagonal` | Domain files for Category/Tag (existing path) | Possibly unchanged at ports |
| `plugin-hono` / `plugin-next` | Likely unchanged | Likely unchanged |
| `plugin-drizzle` | **Primary** — JSONB columns + passthrough writes | **Primary** — tables, FK, junctions, tx |
| `apps/petstore-sample` | Rich Pet OpenAPI + Pactum + generation path lists | Optional relation opt-in |
| `apps/petstore-next` | Regen / align if contract shared | As needed |
| `apps/fixtures/library-api` | Unchanged in Phase 1 | Optional relation example |
| `PRD` / `docs` | Follow-up notes after ship | Authoring guide |

## 7. Testing strategy

**Phase 1**

- Unit: Drizzle derive/generate — nested object / array / `$ref` → `jsonb` SQL + schema emit.
- Unit: FK fixture still produces integer FK, not JSONB.
- Unit: no Category/Tag tables when those schemas lack `persistence`.
- Unit: `$ref` + `x-hexkit.reference` on one property → derive error.
- Unit: optional omit + empty arrays map through mappers (`?? undefined` for null JSONB).
- Negative: unsupported scalars (e.g. `number` if still rejected) unchanged.
- Dogfood: three normative Pactum cases on Hono Compose; generated app typecheck.
- `vp check` / package tests for touched packages.

**Phase 2**

- Unit: property-level opt-in vs default JSONB precedence.
- Dogfood: create/get/update/delete with relational nested field; assert DB shape (FK/junction) where practical.

## 8. Risks and decisions

| Risk | Mitigation |
| ---- | ---------- |
| Authors expect nested `$ref` to always mean FK | Document default JSONB; Phase 2 property-level opt-in only |
| Category gains `persistence` while Pet still embeds | Embed stays JSONB; spike decides warn vs allow unused table |
| JSONB not query-friendly for find-by-tag | Accept in Phase 1; filters are a later capability |
| Apical craft rejects enriched schemas | Validate craft early; keep local `#/` refs and `type: object` |
| Next checked-in tree drifts | Include regen in Phase 1 dogfood checklist |
| Phase 2 M:N complexity | Spike Category to-one first; tags junction as second slice inside Phase 2 |
| New `x-hexkit` keys blocked by `assertOnlyKeys` | Phase 2 spike must update Apical allowlists (not YAML-only) |

## 9. Proposed sequencing

1. ~~Review and approve this plan.~~ (content approved; plan-review fixes applied)  
2. Re-review / merge this docs PR.  
3. Write a short Phase 1 implementation task plan (TDD-style) from this document.  
4. Implement Phase 1 only.  
5. Design addendum for Phase 2 `x-hexkit` shape → implement Phase 2.  
6. Revisit backlog (query filters, etc.) as separate plans.

## 10. Review checklist

- [x] Phase 1 default (JSONB with no new extension) is accepted  
- [x] Phase 2 opt-in stays under `x-hexkit` (no `x-hexkit-entity` key)  
- [x] Rich Pet dogfood shape (Category / Tag / photoUrls) is accepted  
- [x] Out-of-scope list is accepted (no PATCH, no query filters, no XML in this plan)  
- [x] Plan review findings addressed in this document (decision tree, fixture shape, mappers, jsonb lock-in, tests)  
- [x] Phase 1 implemented (JSONB nested columns + Rich Pet dogfood)  
- [ ] Phase 2 design spike for property-level relational opt-in
