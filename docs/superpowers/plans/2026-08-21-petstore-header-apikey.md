# Petstore header `apiKey` (Hono dogfood) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require Petstore `api_key` on Hono `GET /pet/{petId}` dogfood (401 missing/rejected, `test-key` success) while Next RSC stays header-free.

**Architecture:** Reuse existing Apical + hexagonal `Authenticator` + Hono middleware. Change `openapi.poc.yaml` so `getPetById` has `security: [{ api_key: [] }]`. Teach `@hexkit/plugin-next` server-access to wrap secured use cases with a trusted in-process principal so fixture pages keep calling `getPetById(id)`.

**Tech Stack:** TypeScript, Vite+ (`vp`), Vitest, Pactum, Hexkit generate pipeline, existing in-memory authenticator (`AUTH_API_KEYS` default `test-key`).

**Spec:** [2026-08-21-petstore-header-apikey-design.md](../specs/2026-08-21-petstore-header-apikey-design.md)

## Global Constraints

- Plugins stay domain-agnostic (PRD §5.0). Header name comes from IR (`api_key`), never hardcoded Petstore strings in `@hexkit/plugin-*`.
- Valid key: `AUTH_API_KEYS` allow-list, default `test-key`.
- Missing or rejected key: HTTP 401 `{ "error": "Unauthorized" }` (same body).
- `getPetById` only. No oauth. No other PoC ops.
- Next RSC does not send HTTP headers. No PetShop test suite.
- TDD for plugin/test changes. YAML/docs are configuration.
- Do not combine `vp` `--filter` with `-r`. Build packages before tests (`vp run --filter './packages/*' --filter './apps/cli' build`).

---

### Task 1: Next server-access trusted principal wrap

**Files:**

- Modify: `packages/plugin-next/src/generate/runtime.test.ts`
- Modify: `packages/plugin-next/src/generate/server-access.ts`

**Interfaces:**

- Consumes: `ApplicationUseCase.requiresAuth`, `parameters`, `returnTypeExpression`, `factoryName`, `typeName`
- Produces: `ServerAccess` methods for secured ops omit `principal`; generated bind `(...args) => factory(repo)(rscPrincipal, ...args)` with `const rscPrincipal: Principal = { id: "rsc", scheme: "in-process", scopes: [] }`

- [ ] **Step 1:** Add failing test in `runtime.test.ts`: secured `getItem` with `parameters: [{ name: "itemId", typeExpression: "number" }]` and `requiresAuth: true` → server-access contains trusted principal and wrapped call, `ServerAccess` type is `(itemId: number) => Promise<…>` not the use-case type. Unsecured bind remains `factory(repo)`.
- [ ] **Step 2:** Run `vp run --filter @hexkit/plugin-next test` — expect FAIL (no wrap).
- [ ] **Step 3:** Implement wrap in `renderServerAccessFile`. Import `Principal` only when any use case `requiresAuth`.
- [ ] **Step 4:** Re-run plugin-next tests — expect PASS.
- [ ] **Step 5:** Commit `test: wrap Next server-access secured use cases` then `feat: inject RSC principal in Next server-access` (or one commit if small).

### Task 2: Apical IR for Petstore-named `api_key` header

**Files:**

- Modify: `packages/plugin-apical/src/contract/security.test.ts`

- [ ] Add a unit fixture: scheme `api_key` / `in: header` / `name: api_key` on `getPetById` → `apicalServerHeaderNames: ["api_key"]`.
- [ ] Run plugin-apical tests. Commit.

### Task 3: PoC contract + Hono generation expectations

**Files:**

- Modify: `apps/petstore-sample/tests/generation.test.ts` (`requiredOutputPaths`)
- Modify: `apps/petstore-sample/openapi.poc.yaml`

- [ ] First add auth paths to `requiredOutputPaths` (`auth-principal.ts`, `authenticator.ts`, `in-memory-authenticator.ts`) and run generation test — FAIL missing files.
- [ ] Add `components.securitySchemes.api_key` and `security: [{ api_key: [] }]` on `getPetById` only.
- [ ] Re-run generation test — PASS. Commit.

### Task 4: Petstore Pactum apiKey cases

**Files:**

- Modify: `apps/petstore-sample/tests/api.test.ts`
- Modify: `apps/petstore-sample/README.md` (in Task 6 if preferred)

- [ ] Helper `apiKeyHeader()` from `AUTH_API_KEYS` / `test-key`.
- [ ] Attach helper to every successful `GET /pet/{id}` (including `expectPersistedPet`).
- [ ] Cases: no header → 401 `{ error: "Unauthorized" }`; `not-a-valid-key` → 401 same; writes/store unchanged.
- [ ] Commit.

### Task 5: Docs + progress tracker

**Files:**

- Modify: `docs/petstore-openapi-progress.md`
- Modify: `apps/petstore-sample/README.md`
- Modify: `PRD.md` §3.1 Security
- Modify: `RFC.md` auth note if it says poc is auth-free
- Modify: `docs/superpowers/specs/2026-08-05-openapi-auth-design.md` one-line pointer
- Modify: `docs/superpowers/specs/2026-08-21-petstore-header-apikey-design.md` status

- [ ] Hono header `apiKey` → `shipped`; Next stays `partial`. `getPetById` row stays `partial`. Refresh Summary + Last updated.
- [ ] Commit.

### Task 6: Regen Next fixture `src/**` and verify

**Files:**

- Regenerated: `apps/petstore-next/src/**`, `apps/petstore-next/app/**/route.ts` via generate+copy (dogfood merge algorithm)

- [ ] Build CLI, generate from `openapi.poc.yaml --http next`, copy `src/**` and `app/**/route.ts` onto the fixture.
- [ ] Confirm `get-pet-by-id.ts` has `Principal`; `server-access.ts` wraps; fixture pages still call `getPetById(id)`.
- [ ] `vp check`; package tests; `HEXKIT_SKIP_COMPOSE=1` Next dogfood if feasible; Hono `vp run dogfood` for Pactum 401 proof.
- [ ] Commit regenerated fixture.

## Spec coverage

| Spec section                       | Task                                    |
| ---------------------------------- | --------------------------------------- |
| Contract `api_key` on `getPetById` | 3                                       |
| 401 missing/rejected               | 4 (Pactum); Hono generator already      |
| `test-key` allow-list              | 4                                       |
| Next RSC trusted principal         | 1 + 6                                   |
| IR `api_key` header name           | 2                                       |
| Tracker / PRD / README             | 5                                       |
| Auth-api unchanged                 | no task (regression via existing tests) |
