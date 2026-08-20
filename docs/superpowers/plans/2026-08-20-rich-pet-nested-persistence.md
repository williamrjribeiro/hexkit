# Rich Pet Nested Persistence — Phased Plan

**Status:** Approved — awaiting plan review on PR (no implementation yet)  
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
| `@hexkit/plugin-architecture-hexagonal` domain | Renders nested types and referenced entity files |
| `@hexkit/plugin-hono` / `@hexkit/plugin-next` | JSON request/response via Apical maps (no special case needed for nested JSON) |
| `@hexkit/plugin-drizzle` | **Fails** in `resolveColumnType` for `reference` / `array` / `object` |
| Scalar FK via property `x-hexkit.reference` | Already works (e.g. `Order.petId` → FK) |

## 4. Functionality to support

### 4.1 Rich Pet (dogfood shape)

Extend `openapi.poc.yaml` **Pet** toward the reference Petstore shape, keeping PoC rules (JSON only, no security, no XML, local `#/components/schemas/...` refs only):

| Field | OpenAPI shape | Phase 1 persistence |
| ----- | ------------- | ------------------- |
| `id` | integer | column (identity) |
| `name` | string | `text` column |
| `status` | string enum | enum column (existing) |
| `category` | `$ref` → `Category` | **jsonb** |
| `photoUrls` | `array` of string | **jsonb** |
| `tags` | `array` of `$ref` → `Tag` | **jsonb** |

Add component schemas `Category` and `Tag` as plain object schemas **without** `x-hexkit.persistence` in Phase 1 (domain types only).

Do **not** import from the reference file: missing `type: object`, absolute/`$id` `$ref`s, `PetDetails`, XML media, or oauth.

### 4.2 Persistence decision tree

```text
Property on a schema that has x-hexkit.persistence
  │
  ├─ scalar boolean / integer / string (± enum)
  │     → typed SQL column (existing)
  │
  ├─ property has x-hexkit.reference { schema, property }
  │     → FK column to target table (existing)
  │
  ├─ type is object | array | $ref, and no relational opt-in
  │     → JSONB column (Phase 1 — NEW DEFAULT)
  │
  └─ relational opt-in (Phase 2 — NEW)
        → separate table(s), FK and/or junction, load/save mapping
```

### 4.3 Extension conventions

Keep the single OpenAPI vendor object **`x-hexkit`** (same as `persistence` / `reference` / `operation`). Do **not** introduce a parallel top-level key such as `x-hexkit-entity`.

| Phase | Marker | Meaning |
| ----- | ------ | ------- |
| 1 | *(absence of relational marker)* | Nested value → JSONB |
| 1 | `x-hexkit.reference` on a **scalar** property | FK (unchanged) |
| 2 | Opt-in under `x-hexkit` (exact key TBD in Phase 2 design spike) | Promote nested shape to relational storage |

Phase 1 explicitly requires **no new extension** for the JSONB default.

### 4.4 Domain-agnostic invariant

Plugins must not hardcode Pet / Category / Tag. Behavior is driven only by OpenAPI + `ContractArtifact` + existing hexagonal ports. Petstore changes live in `apps/petstore-sample/` (and Next dogfood regen as needed). Library/auth fixtures need not gain nested fields in Phase 1, but plugin tests should use **generic** nested fixtures where practical.

## 5. Incremental phases

### Phase 1 — JSONB default for nested fields

**Intent:** Make Rich Pet generate, migrate, run, and dogfood with nested JSON bodies.

**Deliverables**

1. **Drizzle model**
   - Extend `PersistenceColumnSqlType` with `json` (or equivalent).
   - Map `object` / `array` / bare `$ref` (`type.kind === "reference"` without treating it as the scalar `x-hexkit.reference` extension) to JSONB columns.
   - Emit Drizzle `jsonb(...)` (or project-standard JSON column helper) in `schema.ts`.
   - Migration SQL includes JSONB columns for those properties.

2. **Mappers**
   - Row → domain: parse/pass through JSONB values into nested domain shapes (`Category`, `Tag[]`, `string[]`).
   - Domain → row: serialize nested values into JSONB-compatible structures for insert/update.
   - Preserve nullability / optional properties per OpenAPI `required`.

3. **Repository methods**
   - Existing `insert` / `update` / `select` / `delete` keep working; update `.set({...})` includes JSONB fields like other columns.
   - No multi-table transactions in Phase 1.

4. **Apical / hexagonal / HTTP**
   - Expect little or no change if IR and domain already render nested types.
   - Confirm Apical craft + normalize accept the enriched PoC schemas (local `$ref`s, `type: object` on components).

5. **Fixture & dogfood**
   - Update `openapi.poc.yaml` with Rich Pet + `Category` + `Tag`.
   - Update Hono Pactum tests: create / get / update Pet with nested payloads; assert round-trip.
   - Regenerate / align `apps/petstore-next` checked-in output if the shared contract drives it.
   - Update generation path expectations in tests that list required output files (only if new domain files appear).

6. **Docs**
   - Note the JSONB default in PRD follow-ups / README status as appropriate after implementation.
   - Leave reference `openapi.yaml` untouched.

**Success criteria (Phase 1)**

- `vp run -r build` and relevant package tests pass.
- Generating from enriched `openapi.poc.yaml` no longer throws in Drizzle derive.
- Compose dogfood: Pet with `category`, `photoUrls`, and `tags` survives POST → GET and PUT → GET.
- Order FK behavior unchanged.
- Scalar `x-hexkit.reference` path unchanged.
- No new `x-hexkit` keys required for nested embed.

**Explicitly out of Phase 1**

- Relational promotion / junction tables.
- Query filters (`findByStatus` / `findByTags`).
- XML, webhooks, oauth2, multipart/uploads.
- `oneOf` / `allOf` / `anyOf`, `additionalProperties` maps.
- Copying exotic reference-file `$ref` / `$id` / `$anchor` forms.

---

### Phase 2 — Opt-in relational entity storage

**Intent:** When authors opt in, nested (or referenced) schemas become first-class tables with FK (and later M:N) mapping, instead of JSONB.

**Prerequisite:** Phase 1 green; JSONB remains the default when the opt-in is absent.

**Design spike (before coding Phase 2)**

Lock the `x-hexkit` shape, for example (illustrative only—finalize in a short design addendum):

```yaml
# Option A — property-level
category:
  $ref: "#/components/schemas/Category"
  x-hexkit:
    storage: relation

# Option B — schema-level reuse
# Category already has x-hexkit.persistence; Pet.category $ref to a
# persisted schema implies relation (needs clear precedence vs JSONB).
```

Prefer extending the existing `x-hexkit` object over a new vendor key. Document precedence:

1. Scalar `x-hexkit.reference` → FK column (today).
2. Phase 2 relational opt-in → table + FK / joins.
3. Else nested structured type → JSONB (Phase 1).

**Deliverables (after spike)**

1. **IR** — carry storage mode on properties or schemas through Apical normalize / `ContractArtifact`.
2. **Drizzle**
   - Create/ensure target table from schema `x-hexkit.persistence`.
   - For to-one embeds (Category): FK column on parent + join (or select+hydrate) on read; split embed on write.
   - For to-many (tags): junction table strategy; transactional insert/update/delete.
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
| `plugin-apical` | Likely unchanged (verify normalize) | Extension parse + IR field |
| `plugin-architecture-hexagonal` | Likely unchanged (domain already nested) | Possibly unchanged at ports |
| `plugin-hono` / `plugin-next` | Likely unchanged | Likely unchanged |
| `plugin-drizzle` | **Primary** — JSONB columns + mappers | **Primary** — tables, FK, junctions, tx |
| `apps/petstore-sample` | Rich Pet OpenAPI + Pactum | Optional relation opt-in |
| `apps/petstore-next` | Regen / align if contract shared | As needed |
| `apps/fixtures/library-api` | Optional nested JSONB example | Optional relation example |
| `PRD` / `docs` | Follow-up notes after ship | Authoring guide |

## 7. Testing strategy

**Phase 1**

- Unit: Drizzle derive/generate snapshots for a schema with nested object/array/`$ref` → JSONB SQL + mapper output.
- Unit: existing FK fixture still produces integer FK, not JSONB.
- Negative: unsupported scalars (e.g. `number` if still rejected) unchanged.
- Dogfood: Pactum nested Pet round-trip on Hono Compose.
- `vp check` / package tests for touched packages.

**Phase 2**

- Unit: opt-in relation vs default JSONB precedence.
- Dogfood: create/get/update/delete with relational nested field; assert DB shape (FK/junction) where practical.

## 8. Risks and decisions

| Risk | Mitigation |
| ---- | ---------- |
| Authors expect nested `$ref` to always mean FK | Document default JSONB; Phase 2 opt-in for relations |
| JSONB not query-friendly for find-by-tag | Accept in Phase 1; filters are a later capability |
| Apical craft rejects enriched schemas | Validate craft early; keep local `#/` refs and `type: object` |
| Next checked-in tree drifts | Include regen in Phase 1 dogfood checklist |
| Phase 2 M:N complexity | Spike Category to-one first; tags junction as second slice inside Phase 2 |

## 9. Proposed sequencing

1. Review and approve this plan.  
2. Write a short Phase 1 implementation task plan (TDD-style) from this document.  
3. Implement Phase 1 only.  
4. Design addendum for Phase 2 `x-hexkit` shape → implement Phase 2.  
5. Revisit backlog (query filters, etc.) as separate plans.

## 10. Review checklist

- [x] Phase 1 default (JSONB with no new extension) is accepted  
- [x] Phase 2 opt-in stays under `x-hexkit` (no `x-hexkit-entity` key)  
- [x] Rich Pet dogfood shape (Category / Tag / photoUrls) is accepted  
- [x] Out-of-scope list is accepted (no PATCH, no query filters, no XML in this plan)  
- [ ] Plan review on PR complete  
- [ ] Ready for a Phase 1 implementation task plan (still no code until that lands)
