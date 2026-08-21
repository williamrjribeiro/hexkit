# Design: Petstore header `apiKey` on Hono dogfood

**Status:** Implemented 2026-08-21  
**Date:** 2026-08-21  
**Tracker:** [docs/petstore-openapi-progress.md](../../petstore-openapi-progress.md) (cross-cutting: Header `apiKey` security)  
**Companions:** [OpenAPI auth design](./2026-08-05-openapi-auth-design.md), [PRD.md](../../../PRD.md), [RFC.md](../../../RFC.md)

## 1. Problem

Hexkit already generates header API-key authentication (Apical header Zod + hexagonal `Authenticator` / `Principal` + Hono 401 middleware). That path is proven on `apps/fixtures/auth-api` (`X-API-Key`, allow-list `AUTH_API_KEYS` default `test-key`).

The Petstore progress tracker still marks **Header `apiKey` security** as `partial` for both adapters: generator support exists, but **Petstore dogfood does not use it**. `openapi.poc.yaml` has no security. Real Petstore requires header `api_key` on `GET /pet/{petId}` (OR with oauth, which Hexkit cannot enforce).

This slice applies header `api_key` to Petstore **Hono** dogfood for `getPetById` only. It does not add a new auth stack.

## 2. Decisions (locked)

| Topic                   | Decision                                                                                                                                                                          |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Which Petstore ops      | `getPetById` only                                                                                                                                                                 |
| Scheme                  | Petstore-shaped `api_key` header (`type: apiKey`, `name: api_key`, `in: header`)                                                                                                  |
| OAuth                   | Do **not** copy `petstore_auth` onto the PoC contract                                                                                                                             |
| Valid key               | Existing allow-list `AUTH_API_KEYS`, default `test-key`                                                                                                                           |
| Missing or rejected key | HTTP **401** `{ "error": "Unauthorized" }` (same body for both)                                                                                                                   |
| Tests                   | Fold apiKey cases into Petstore Pactum; do not start a second Petstore harness                                                                                                    |
| Auth-api fixture        | Keep as the **bearer** (+ existing `X-API-Key`) fixture; do not delete it                                                                                                         |
| Next.js                 | Shared contract will emit auth on Route Handlers; RSC must **not** send HTTP headers. In-process server-access injects a trusted principal so pages keep calling `getPetById(id)` |
| Hono plugin             | No new auth machinery unless a bug shows up; reuse existing middleware                                                                                                            |

This supersedes the earlier “keep `openapi.poc.yaml` auth-free” note in the 2026-08-05 auth design, **only** for `getPetById`.

## 3. What Apical generates (normative)

Verified with `@apical-ts/craft` **0.26.0**:

| Spec                                            | `*ServerHeadersSchema`                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `getPetById` with `security: [{ api_key: [] }]` | `{ "api_key": z.string() }` required                                                                           |
| Same op with `petstore_auth` **OR** `api_key`   | Still only `{ "api_key": z.string() }` — oauth is ignored                                                      |
| OAuth-only ops (`addPet` / `updatePet`)         | No header schemas                                                                                              |
| Auth fixture `X-API-Key`                        | Server key `"x-api-key"` (lowercased); Petstore `api_key` is already lowercase so client and server keys match |

Apical checks presence and type only. Value checks stay in Hexkit’s in-memory authenticator.

Hexkit IR `apicalServerHeaderNames` for `getPetById` must be `["api_key"]`. Existing `plugin-apical` tests already assert IR keys match craft server header keys.

## 4. Contract

Edit `apps/petstore-sample/openapi.poc.yaml` (do **not** edit `openapi.yaml`):

```yaml
# on GET /pet/{petId} (getPetById) only:
security:
  - api_key: []

components:
  securitySchemes:
    api_key:
      type: apiKey
      name: api_key
      in: header
```

No global `security`. Add/update/delete Pet and all Store ops stay unauthenticated.

Do **not** add oauth alongside `api_key`. A single-scheme requirement matches Apical output and Hexkit’s “one enforceable branch” rule without relying on OR collapse.

## 5. Hono request flow

Existing generation already does this when any operation has `apicalServerHeaderNames`:

1. Hono middleware extracts `api_key` (case-insensitive header get).
2. Missing / blank → 401 `{ "error": "Unauthorized" }` (no use-case call).
3. Present value → `Authenticator.authenticate({ kind: "apiKey", headerName: "api_key", apiKey })`.
4. Value not in `AUTH_API_KEYS` (default `test-key`) → 401 `{ "error": "Unauthorized" }`.
5. Match → `Principal` on context; controller runs Apical wrapper; `headers-error` still maps to 401 as a safety net.
6. Pet missing after auth → existing **404**.

| Request                          | Status    | Body                          |
| -------------------------------- | --------- | ----------------------------- |
| No `api_key`                     | 401       | `{ "error": "Unauthorized" }` |
| Empty `api_key`                  | 401       | `{ "error": "Unauthorized" }` |
| Wrong key                        | 401       | `{ "error": "Unauthorized" }` |
| `api_key: test-key`, pet exists  | 200       | Pet JSON                      |
| `api_key: test-key`, pet missing | 404       | empty body (same as today)    |
| POST `/pet`, orders, delete, …   | unchanged | no header required            |

`plugin-hono` should not gain Petstore literals. Header name comes from IR (`api_key`), not `X-API-Key`.

### 5.1 Generated files that appear on Petstore Hono output

First generate of a secured contract already emits:

- `src/core/domain/auth-principal.ts`
- `src/core/ports/authenticator.ts`
- `src/adapters/auth/in-memory-authenticator.ts`
- `GetPetById = (principal: Principal, petId: number) => …` (protected use-case skeleton)

Hono dogfood generates into a **fresh** temp directory, so the protected `get-pet-by-id.ts` is written with the new signature. No hand-edit of a prior Hono tree is required.

## 6. Petstore API tests

Keep one harness: `apps/petstore-sample/tests/api.test.ts`.

- Helper that attaches `api_key` from `process.env.AUTH_API_KEYS?.split(",")[0] ?? "test-key"`.
- Every **successful** `GET /pet/{id}` uses that helper (including `expectPersistedPet` and lifecycle GETs).
- Do **not** set a global default header that is hard to strip; missing/rejected cases must send no key or a bad key on purpose.
- New cases (plain names):
  - GET pet with **no** `api_key` → 401 `{ "error": "Unauthorized" }`
  - GET pet with **rejected** value (e.g. `not-a-valid-key`) → 401 `{ "error": "Unauthorized" }`
  - GET pet with **`test-key`** after create → 200 (already implied by round-trips once the helper is on GETs)
- Writes and Store ops stay header-free.
- `tests/generation.test.ts` required-path list gains the three auth files above.

`apps/fixtures/auth-api` Pactum stays. It remains the bearer proof (and `X-API-Key` on `POST /items`). No requirement to merge the two Compose loops.

## 7. Next.js (compile only; no HTTP apiKey dogfood)

The PoC contract is shared. After the YAML change:

- Hexagonal `GetPetById` requires `Principal`.
- Next **Route Handlers** (`app/pet/[petId]/route.ts`) will authenticate the HTTP header. That is correct for the HTTP surface. This slice does **not** add Next Pactum or tell the UI to send `api_key`.
- Next **RSC / Server Actions** call `getServerAccess().getPetById(id)` in-process. An HTTP header is meaningless there.

**Required plugin change:** `@hexkit/plugin-next` generated `server-access.ts` must wrap secured use cases so the `ServerAccess` API used by pages **omits** `principal`. Inject a domain-agnostic trusted principal, for example `{ id: "rsc", scheme: "in-process", scopes: [] }`. Fixture pages keep `getPetById(petId)`.

Dogfood merge copies `src/**` from a fresh generate onto `apps/petstore-next`, so checked-in `get-pet-by-id.ts` will pick up the new use-case type. Fixture UI under `app/pets/**` is **not** copied from generate; wrapping server-access is what keeps `next build` green.

Unit-test the wrap in `plugin-next` (secured op → server-access calls the use case with the trusted principal; unsecured ops unchanged).

Do **not** add a PetShop test suite (existing Next fixture rule).

## 8. Docs to update in the implementation PR

| Doc                                 | Change                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/petstore-openapi-progress.md` | Header `apiKey`: Hono → `shipped` (proven on Petstore `getPetById` dogfood). Next stays `partial` (shared contract / Route Handlers emit auth; RSC bypasses HTTP header; no Next HTTP proof). `getPetById` operation row stays `partial` (still missing XML and `petstore_auth`). Refresh Summary tallies and Last updated. |
| `apps/petstore-sample/README.md`    | Note `api_key` on GET pet; `AUTH_API_KEYS` / `test-key`.                                                                                                                                                                                                                                                                    |
| `PRD.md` §3.1 Security row          | Amend: PoC contract is no longer “none”; `getPetById` requires header `api_key`. Other PoC ops remain unauthenticated.                                                                                                                                                                                                      |
| `RFC.md` / 2026-08-05 auth spec     | One-line pointer: poc is no longer fully auth-free.                                                                                                                                                                                                                                                                         |

`getInventory` is still a missing **operation**. It does not block shipping the cross-cutting Hono header-apiKey **capability** once `getPetById` dogfood proves it. When `getInventory` is added later, the same scheme on the contract is enough.

## 9. Out of scope

- OAuth2 `petstore_auth`, scopes, 403
- `api_key` on `addPet` / `updatePet` / `deletePet` / Store ops
- `getInventory`
- Query/cookie API keys, mutualTLS
- Changing the in-memory stub to accept any non-empty string
- Distinct error bodies for missing vs rejected keys
- Next HTTP acceptance tests
- New `@hexkit/plugin-auth`

## 10. Testing strategy (implementation)

1. **Apical / IR** — existing golden path: `getPetById` `apicalServerHeaderNames` equals craft `api_key` key (add a Petstore-named scheme case if the auth fixture only covers `x-api-key`).
2. **plugin-next unit** — server-access trusted-principal wrap (TDD).
3. **petstore-sample generation** — required auth files present; `getPetById` security in `hexkit-contract.json` if asserted.
4. **Hono dogfood Pactum** — missing / rejected / valid key; existing JSONB and lifecycle tests still pass with the helper on GET pet.
5. **Next dogfood** — `HEXKIT_SKIP_COMPOSE=1` lint + `next build` after merge (CI Dogfood NextJS).
6. **Auth-api dogfood** — unchanged; still green for bearer / `X-API-Key`.
7. **`vp check`** on Hexkit packages touched.

## 11. Risks

| Risk                                          | Mitigation                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Next fixture pages fail typecheck             | Server-access wrap; do not ask UI to pass `Principal`                                      |
| Protected use-case stale in an old output dir | Hono dogfood uses a fresh temp dir; Next merge copies fresh `src/**`                       |
| Empty header passes Apical `z.string()`       | Middleware already treats blank as missing (401) before the wrapper                        |
| Tracker over-claims Next                      | Next column stays `partial`                                                                |
| Auth-api and Petstore both prove apiKey       | Accept overlap; different header names (`X-API-Key` vs `api_key`); keep bearer on auth-api |

## 12. Success criteria

Done when:

1. `GET /pet/{petId}` on generated Hono Petstore requires `api_key`.
2. Missing and rejected values return **401** `{ "error": "Unauthorized" }`.
3. `test-key` (or `AUTH_API_KEYS`) allows the existing 200/404 pet reads.
4. Other PoC operations stay unauthenticated.
5. Petstore Pactum covers those cases in the existing harness.
6. Next PetShop still `next build`s; pages do not send `api_key`.
7. Progress tracker Hono header `apiKey` is `shipped`; Next remains `partial`.
