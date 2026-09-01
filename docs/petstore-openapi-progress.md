# Pet Store OpenAPI — Hono & Next.js progress

**Goal:** Hexkit’s HTTP adapters (`@hexkit/plugin-hono` and `@hexkit/plugin-next`)
support the **complete** Swagger Petstore OpenAPI surface — every operation,
media type, and security scheme the full Petstore contract uses — not only the
trimmed PoC slice.

This file is the **canonical progress tracker** for that goal. Keep it current
whenever Hono/Next OpenAPI support changes (see [Keeping this tracker current](#keeping-this-tracker-current)).

| Field        | Value                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------- |
| Last updated | 2026-09-01                                                                                      |
| Target spec  | Full Swagger Petstore (classic 19 operations + OAS 3.1 extras in the checked-in reference)      |
| PoC contract | [`apps/petstore-sample/openapi.poc.yaml`](../apps/petstore-sample/openapi.poc.yaml)             |
| OAS 3.1 ref  | [`apps/petstore-sample/openapi.yaml`](../apps/petstore-sample/openapi.yaml) (Pet-focused slice) |

## Status values

Use exactly these four statuses per feature and per plugin:

| Status        | Meaning                                                                                            |
| ------------- | -------------------------------------------------------------------------------------------------- |
| `missing`     | Not generated or not usable for this feature yet                                                   |
| `in progress` | Work started (design, partial emit, or fixture) but not yet proven end-to-end for Petstore         |
| `partial`     | Works for some formats or capabilities, but not the full Petstore surface for this feature         |
| `shipped`     | Full Petstore needs for this feature are met and validated (media types, params, **and** security) |

**Strict bar:** `shipped` means the feature completes the full Petstore contract —
not the PoC slice. Missing required security (e.g. `api_key`, OAuth2 scopes),
alternate media types, query/header params, or other contract requirements →
`partial` (or `missing` / `in progress` if nothing usable yet).

Generator support proven only on a non-Petstore fixture (e.g. auth-api) does
**not** make a Petstore cross-cutting row `shipped`.

Examples of `partial`: JSON works but XML / form-urlencoded do not; CRUD works
but the full contract’s `petstore_auth` / `api_key` is not enforced; apiKey
works in the auth fixture but is not applied on Petstore dogfood.

Statuses are **independent per plugin**. Hono and Next may diverge.

## Summary

Counts treat each (feature × plugin) cell. Update the tallies when rows change.

| Plugin                | `shipped` | `partial` | `in progress` | `missing` |
| --------------------- | --------- | --------- | ------------- | --------- |
| `@hexkit/plugin-hono` | 3         | 9         | 0             | 14        |
| `@hexkit/plugin-next` | 2         | 10        | 0             | 14        |

Almost all PoC Pet / Order routes are **partial** (JSON-only and/or missing
Petstore security). **Shipped:** `deleteOrder`, JSON media type, and Hono header
`apiKey` (Petstore `getPetById` dogfood). Most of the remaining surface is still
**missing**.

## Operations

Target operations match the classic full Swagger Petstore. Rows marked
“PoC slice” are present in `openapi.poc.yaml` and proven by dogfood today.

Operation-specific needs (query params, array bodies, map responses, response
headers, binary upload, nested Pet JSONB, and so on) live in **Notes** on the
row — not in [Cross-cutting capabilities](#cross-cutting-capabilities).

### Pet

| operationId         | Method / path                   | Hono    | Next    | Notes                                                                       |
| ------------------- | ------------------------------- | ------- | ------- | --------------------------------------------------------------------------- |
| `addPet`            | `POST /pet`                     | partial | partial | PoC JSON works; still need XML, form-urlencoded, and `petstore_auth`        |
| `updatePet`         | `PUT /pet`                      | partial | partial | PoC JSON works; still need XML, form-urlencoded, and `petstore_auth`        |
| `getPetById`        | `GET /pet/{petId}`              | partial | partial | PoC JSON + Hono `api_key` dogfood; still need XML and `petstore_auth`       |
| `deletePet`         | `DELETE /pet/{petId}`           | partial | partial | PoC delete works; still need `petstore_auth` (+ optional `api_key` header)  |
| `findPetsByStatus`  | `GET /pet/findByStatus`         | partial | partial | PoC JSON + DB filter; still need XML and `petstore_auth`                    |
| `findPetsByTags`    | `GET /pet/findByTags`           | partial | partial | PoC JSON + DB filter (JSONB tag names); still need XML and `petstore_auth`  |
| `updatePetWithForm` | `POST /pet/{petId}`             | partial | partial | Query `name` / `status`; still need `petstore_auth`                         |
| `uploadFile`        | `POST /pet/{petId}/uploadImage` | missing | missing | Binary `application/octet-stream`; optional query metadata; `petstore_auth` |

Nested Pet fields (`category`, `tags`, `photoUrls`) already persist as JSONB in
the PoC slice (Phase 1); that is covered by the Pet rows above, not as a
separate cross-cutting HTTP capability.

### Store

| operationId    | Method / path                   | Hono    | Next    | Notes                                                                           |
| -------------- | ------------------------------- | ------- | ------- | ------------------------------------------------------------------------------- |
| `placeOrder`   | `POST /store/order`             | partial | partial | PoC JSON works; still need XML + form-urlencoded (no security in full Petstore) |
| `getOrderById` | `GET /store/order/{orderId}`    | partial | partial | PoC JSON works; still need XML (no security in full Petstore)                   |
| `deleteOrder`  | `DELETE /store/order/{orderId}` | shipped | shipped | Full Petstore: no alternate media types and no security scheme                  |
| `getInventory` | `GET /store/inventory`          | missing | missing | Map response (`additionalProperties` → int); requires `api_key`                 |

### User

| operationId                | Method / path               | Hono    | Next    | Notes                                                                             |
| -------------------------- | --------------------------- | ------- | ------- | --------------------------------------------------------------------------------- |
| `createUser`               | `POST /user`                | missing | missing | User schema + persistence; JSON (+ XML / form-urlencoded in full)                 |
| `createUsersWithListInput` | `POST /user/createWithList` | missing | missing | Array request body (`User[]`)                                                     |
| `loginUser`                | `GET /user/login`           | missing | missing | Query `username` / `password`; response headers `X-Rate-Limit`, `X-Expires-After` |
| `logoutUser`               | `GET /user/logout`          | missing | missing | Session-style no-body success                                                     |
| `getUserByName`            | `GET /user/{username}`      | missing | missing | String path identity; JSON (+ XML in full Petstore)                               |
| `updateUser`               | `PUT /user/{username}`      | missing | missing | JSON (+ XML / form-urlencoded in full Petstore)                                   |
| `deleteUser`               | `DELETE /user/{username}`   | missing | missing |                                                                                   |

## Cross-cutting capabilities

Only capabilities that apply **across many operations** or at the **document /
adapter** level. Anything that is unique to one (or a couple of) routes belongs
in that operation’s Notes.

| Capability                          | Hono    | Next    | Notes                                                                                                                                                  |
| ----------------------------------- | ------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| JSON request/response               | shipped | shipped | Default media type; proven on Petstore PoC dogfood                                                                                                     |
| XML request/response                | missing | missing | Alternate media type on many Pet / Store / User ops                                                                                                    |
| `application/x-www-form-urlencoded` | missing | missing | Alternate request media type on several Pet / Order / User writes                                                                                      |
| Header `apiKey` security            | shipped | partial | Hono: Petstore `getPetById` dogfood (`api_key` / `test-key`). Next: shared contract emits Route Handler auth; RSC is in-process (no HTTP header proof) |
| OAuth2 `petstore_auth` + scopes     | missing | missing | Required on most Pet ops; Apical marks oauth2 unenforceable today                                                                                      |
| mutualTLS                           | missing | missing | Document-level scheme on checked-in OAS 3.1 reference                                                                                                  |
| Webhooks (`newPet`)                 | missing | missing | Document-level OAS 3.1 surface (not a `paths` operation)                                                                                               |

## Contract map

| Contract                                | Role                                                                                 |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `apps/petstore-sample/openapi.poc.yaml` | Current generation/dogfood slice (Rich Pet + Order, JSON; `api_key` on `getPetById`) |
| `apps/petstore-sample/openapi.yaml`     | Checked-in OAS 3.1 Pet-focused reference (leave untouched for PoC edits)             |
| Full Swagger Petstore (classic 19 ops)  | Progress target for this tracker                                                     |

Expanding dogfood toward the full surface means growing `openapi.poc.yaml` (or
a successor full-contract fixture) and moving rows from `missing` →
`in progress` → `partial` → `shipped` — without hardcoding Petstore domain into
plugins (PRD §5.0).

## Keeping this tracker current

**This file must stay accurate.** Treat drift as a docs defect.

Update it in the **same PR** when any of the following happen:

1. Hono or Next generation gains, loses, or partially implements a Petstore
   operation or cross-cutting capability.
2. `openapi.poc.yaml` (or a full-Petstore dogfood contract) adds/removes
   operations or media types / security.
3. Dogfood or acceptance tests newly prove (or regress) a feature for either
   adapter.
4. Auth, media-type, webhook, or other OpenAPI support changes in
   `@hexkit/plugin-apical` that unblock or block Hono/Next Petstore fidelity.

Checklist for every such change:

- [ ] Set each affected cell to exactly `missing`, `in progress`, `partial`, or `shipped`
- [ ] Use `partial` when only some formats or capabilities work — including when
      required **security** is absent (do not mark `shipped`)
- [ ] Do not mark a Petstore cross-cutting row `shipped` from a non-Petstore fixture alone
- [ ] Keep Hono and Next columns honest (do not copy status across plugins)
- [ ] Put operation-specific needs in that row’s Notes — not in Cross-cutting
- [ ] Refresh the [Summary](#summary) tallies
- [ ] Set **Last updated** to the change date (`YYYY-MM-DD`)
- [ ] Add a short Notes clarification when status is non-obvious

Do **not** mark `shipped` until the HTTP adapter covers the **full** Petstore
needs for that feature (all required media types, params, **and** security) and
Petstore-relevant validation exists. Incomplete but working support is
`partial`. Partial emit without runtime proof stays `in progress`.

## Related docs

- [PRD §3.1](../PRD.md) — PoC contract slice; §11 follow-up to expand toward full Petstore
- [README — Project status](../README.md#project-status) — package-level PoC status
- [OpenAPI auth design](./superpowers/specs/2026-08-05-openapi-auth-design.md)
- [Next.js Route Handlers design](./superpowers/specs/2026-08-11-nextjs-route-handlers-design.md)
- [Rich Pet nested persistence plan](./superpowers/plans/2026-08-20-rich-pet-nested-persistence.md)
