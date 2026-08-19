# Auth API Compose + Pactum Dogfood Implementation Plan

> **Status:** Delivered on `main` (#7, August 2026).

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove OpenAPI auth end-to-end by generating the auth-api fixture, running it under Docker Compose, and accepting the auth matrix with Pactum using the in-memory stub authenticator (no real auth).

**Architecture:** Mirror the Petstore dogfood loop for `apps/fixtures/auth-api/`. Reuse existing packaging + in-memory authenticator defaults (`test-token` / `test-key`). Fix Drizzle generation gaps that block list/health so the generated app compiles and serves the fixture.

**Tech Stack:** TypeScript, Vite+, Vitest, PactumJS, Docker Compose, Hexkit CLI generate pipeline.

## Global Constraints

- Keep `apps/petstore-sample/openapi.poc.yaml` auth-free and Petstore dogfood green.
- Stub auth only — `createInMemoryAuthenticator` + env defaults; no JWT verification, OAuth, or DB-backed credentials.
- Plugins stay domain-agnostic; fixture-specific knowledge stays under `apps/fixtures/auth-api/`.
- Pactum acceptance matrix from `auth-generation.test.ts` comments is normative.
- TDD: failing test → minimal fix → verify.

---

### Task 1: Fix Drizzle `list` and parameterless health-style methods

**Files:**

- Modify: `packages/plugin-drizzle/src/model/derive.ts`
- Modify: `packages/plugin-drizzle/src/generate/repository.ts`
- Modify: `packages/plugin-drizzle/src/plugin.test.ts`

- [ ] Write failing tests: `list` emits select-all; `getHealth` (0 params, non-entity return) emits `{ ok: true }` stub.
- [ ] Implement `list` method kind + health/parameterless stub rendering.
- [ ] Run drizzle tests + `vp check`; commit.

### Task 2: Auth-api package scaffolding + Pactum suite

**Files:**

- Modify: `pnpm-workspace.yaml` (`apps/fixtures/*`)
- Create: `apps/fixtures/auth-api/package.json`, `vite.config.ts`, `tsconfig.json`, `src/index.ts`
- Create: `apps/fixtures/auth-api/tests/api.test.ts`
- Modify: `apps/cli/src/auth-generation.test.ts` (point at executed matrix / drop “future” comment)

- [ ] Write Pactum tests for the auth matrix (fail without stack).
- [ ] Add package wiring + `vp install`.
- [ ] Commit.

### Task 3: Dogfood script + root task

**Files:**

- Create: `apps/fixtures/auth-api/scripts/dogfood.sh`
- Modify: `vite.config.ts` (add `dogfood-auth`)
- Modify: `README.md`, `apps/fixtures/auth-api/README.md`, `docs/README.md` as needed

- [ ] Script: generate → install/check → Compose up → readiness via `GET /health` → Pactum.
- [ ] Env: `AUTH_API_URL`, reuse `HEXKIT_KEEP_STACK` / `HEXKIT_DOGFOOD_OUTPUT`.
- [ ] Run `vp run dogfood-auth`; commit.

### Task 4: Verification

- [ ] `vp check` and `vp run -r test`
- [ ] `vp run dogfood-auth` green
- [ ] Petstore `vp run dogfood` still green (or at least generation/unit path if Docker time-constrained — prefer full if feasible)
