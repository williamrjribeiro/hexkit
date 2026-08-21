# Pet Store OpenAPI — Hono & Next.js progress

**Goal:** Hexkit’s HTTP adapters (`@hexkit/plugin-hono` and `@hexkit/plugin-next`)
support the **complete** Swagger Petstore OpenAPI surface — every operation,
media type, and security scheme the full Petstore contract uses — not only the
trimmed PoC slice.

This file is the **canonical progress tracker** for that goal. Keep it current
whenever Hono/Next OpenAPI support changes (see [Keeping this tracker current](#keeping-this-tracker-current)).

| Field        | Value                                                                                          |
| ------------ | ---------------------------------------------------------------------------------------------- |
| Last updated | 2026-08-21                                                                                     |
| Target spec  | Full Swagger Petstore (classic 19 operations + OAS 3.1 extras in the checked-in reference)     |
| PoC contract | [`apps/petstore-sample/openapi.poc.yaml`](../apps/petstore-sample/openapi.poc.yaml)            |
| OAS 3.1 ref  | [`apps/petstore-sample/openapi.yaml`](../apps/petstore-sample/openapi.yaml) (Pet-focused slice) |

## Status values

Use exactly these three statuses per feature and per plugin:

| Status         | Meaning                                                                                                      |
| -------------- | ------------------------------------------------------------------------------------------------------------ |
| `missing`      | Not generated or not usable for this feature yet                                                             |
| `in progress`  | Work started (design, partial emit, or fixture) but not yet proven end-to-end for Petstore                   |
| `shipped`      | Generated correctly for this HTTP adapter and validated (unit/dogfood/acceptance as appropriate for the app) |

Statuses are **independent per plugin**. Hono and Next may diverge.

## Summary

Counts treat each (feature × plugin) cell above. Update the tallies when rows change.

| Plugin                    | `shipped` | `in progress` | `missing` |
| ------------------------- | --------- | ------------- | --------- |
| `@hexkit/plugin-hono`     | 10        | 0             | 22        |
| `@hexkit/plugin-next`     | 10        | 0             | 22        |

PoC JSON Pet + Order CRUD is **shipped** on both adapters. Most of the full
Petstore surface (Users, filters, uploads, XML, OAuth2, webhooks, …) is still
**missing**.

## Operations

Target operations match the classic full Swagger Petstore. Rows marked
“PoC slice” are present in `openapi.poc.yaml` and proven by dogfood today.

### Pet

| operationId         | Method / path                 | Hono      | Next      | Notes                                              |
| ------------------- | ----------------------------- | --------- | --------- | -------------------------------------------------- |
| `addPet`            | `POST /pet`                   | shipped   | shipped   | PoC slice — JSON only                              |
| `updatePet`         | `PUT /pet`                    | shipped   | shipped   | PoC slice — JSON only                              |
| `getPetById`        | `GET /pet/{petId}`            | shipped   | shipped   | PoC slice — JSON only                              |
| `deletePet`         | `DELETE /pet/{petId}`         | shipped   | shipped   | PoC slice                                          |
| `findPetsByStatus`  | `GET /pet/findByStatus`       | missing   | missing   | Query filter + array response                      |
| `findPetsByTags`    | `GET /pet/findByTags`         | missing   | missing   | Query filter (array) + array response              |
| `updatePetWithForm` | `POST /pet/{petId}`           | missing   | missing   | Form / query-style update                          |
| `uploadFile`        | `POST /pet/{petId}/uploadImage` | missing | missing   | Binary / octet-stream body                         |

### Store

| operationId    | Method / path                    | Hono    | Next    | Notes                         |
| -------------- | -------------------------------- | ------- | ------- | ----------------------------- |
| `placeOrder`   | `POST /store/order`              | shipped | shipped | PoC slice — JSON only         |
| `getOrderById` | `GET /store/order/{orderId}`     | shipped | shipped | PoC slice — JSON only         |
| `deleteOrder`  | `DELETE /store/order/{orderId}`  | shipped | shipped | PoC slice                     |
| `getInventory` | `GET /store/inventory`           | missing | missing | Map / `additionalProperties`  |

### User

| operationId               | Method / path              | Hono    | Next    | Notes                              |
| ------------------------- | -------------------------- | ------- | ------- | ---------------------------------- |
| `createUser`              | `POST /user`               | missing | missing | User schema + persistence          |
| `createUsersWithListInput`| `POST /user/createWithList`| missing | missing | Array request body                 |
| `loginUser`               | `GET /user/login`          | missing | missing | Query creds + response headers     |
| `logoutUser`              | `GET /user/logout`         | missing | missing | Session-style no-body success      |
| `getUserByName`           | `GET /user/{username}`     | missing | missing | String path identity               |
| `updateUser`              | `PUT /user/{username}`     | missing | missing |                                    |
| `deleteUser`              | `DELETE /user/{username}`  | missing | missing |                                    |

## Cross-cutting capabilities

These are required to claim full Petstore fidelity even when an operation row
is already `shipped` for JSON.

| Capability                         | Hono      | Next      | Notes                                                                 |
| ---------------------------------- | --------- | --------- | --------------------------------------------------------------------- |
| JSON request/response              | shipped   | shipped   | PoC dogfood                                                           |
| XML request/response               | missing   | missing   | Explicit PoC non-goal; required for full Petstore                     |
| `application/x-www-form-urlencoded`| missing   | missing   | Used on Pet / Order / User bodies in full Petstore                    |
| Binary upload (`application/octet-stream`) | missing   | missing   | `uploadFile`                                                          |
| Header `apiKey` security           | shipped   | shipped   | Proven via auth fixture; not yet on Petstore dogfood contract         |
| OAuth2 `petstore_auth` + scopes    | missing   | missing   | Apical marks oauth2 unenforceable today                               |
| mutualTLS                          | missing   | missing   | Present on checked-in OAS 3.1 reference                               |
| Query parameters (filters)         | missing   | missing   | Needed for find-by-status/tags, login                                 |
| Array request bodies               | missing   | missing   | `createUsersWithListInput`                                            |
| Map / `additionalProperties`       | missing   | missing   | `getInventory`                                                        |
| Response headers                   | missing   | missing   | `loginUser` (`X-Rate-Limit`, `X-Expires-After`)                       |
| Webhooks (`newPet`)                | missing   | missing   | OAS 3.1 checked-in reference                                          |
| Nested Pet JSONB persistence       | shipped   | shipped   | PoC Rich Pet `category` / `tags` / `photoUrls` (Phase 1)              |

## Contract map

| Contract                                                         | Role                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `apps/petstore-sample/openapi.poc.yaml`                          | Current generation/dogfood slice (Rich Pet + Order, JSON, no security)    |
| `apps/petstore-sample/openapi.yaml`                              | Checked-in OAS 3.1 Pet-focused reference (leave untouched for PoC edits)  |
| Full Swagger Petstore (classic 19 ops)                           | Progress target for this tracker                                          |

Expanding dogfood toward the full surface means growing `openapi.poc.yaml` (or
a successor full-contract fixture) and moving rows from `missing` →
`in progress` → `shipped` — without hardcoding Petstore domain into plugins
(PRD §5.0).

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

- [ ] Set each affected cell to exactly `missing`, `in progress`, or `shipped`
- [ ] Keep Hono and Next columns honest (do not copy status across plugins)
- [ ] Refresh the [Summary](#summary) tallies
- [ ] Set **Last updated** to the change date (`YYYY-MM-DD`)
- [ ] Add a short Notes clarification when status is non-obvious

Do **not** mark `shipped` until the HTTP adapter emits correct code for that
feature and validation exists (package tests and/or dogfood/acceptance).
Partial emit without proof stays `in progress`.

## Related docs

- [PRD §3.1](../PRD.md) — PoC contract slice; §11 follow-up to expand toward full Petstore
- [README — Project status](../README.md#project-status) — package-level PoC status
- [OpenAPI auth design](./superpowers/specs/2026-08-05-openapi-auth-design.md)
- [Next.js Route Handlers design](./superpowers/specs/2026-08-11-nextjs-route-handlers-design.md)
- [Rich Pet nested persistence plan](./superpowers/plans/2026-08-20-rich-pet-nested-persistence.md)
