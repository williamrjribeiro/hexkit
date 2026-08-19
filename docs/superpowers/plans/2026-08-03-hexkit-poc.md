# Hexkit PoC Implementation Plan

> **Status:** Substantially complete on `main` (August 2026). Milestone 8 (dogfood green) remains the PoC sign-off gate — run `vp run dogfood`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and dogfood a Petstore (Pet + Order) Hono/PostgreSQL application from `openapi.poc.yaml`.

**Architecture:** `@hexkit/core` owns an ordered, framework-agnostic pipeline and file ownership. Plugins calculate generated file data and request writes through a shared context; the core is the only component that applies protected-zone policy. The generated sample contains generated Apical contracts, protected application use cases, Hono HTTP adapters, Drizzle persistence, and Compose packaging.

**Tech Stack:** TypeScript, Vite+, Vitest, Apical craft, Hono, Zod, Drizzle ORM, PostgreSQL, Docker Compose, PactumJS.

## Global Constraints

- Use `PRD.md` as the PoC authority; leave `apps/petstore-sample/openapi.yaml` unchanged.
- Generate only Pet and Order JSON operations, with no auth, XML, Users, SST, or AWS artifacts — **via the Petstore OpenAPI fixture**, not by hardcoding Pet/Order into `@hexkit/plugin-*` (see PRD §5.0).
- Plugins must be domain-agnostic: derive domain, ports, use cases, HTTP adapters, and persistence from OpenAPI / Apical contracts available in the generation context.
- Use BDD-style `describe` / `it` tests from `vite-plus/test`; prefer snapshots for generated source and structured output. Plugin tests may use Petstore OpenAPI as an **input fixture**; they must not be green only because the plugin embeds Petstore strings.
- Follow calculation/action separation: pure functions transform plain data, actions are small injected edges, and data shapes have intention-revealing names.
- Test every new behavior first: capture the expected failure, implement the smallest passing code, then refactor.
- Run `vp check`, `vp run -r test`, and `vp run -r build` at each milestone; run Compose and Pactum acceptance tests for the final dogfood milestone.
- Use Conventional Commit messages for independently reviewable milestones.

---

### Task 1: Restore baseline quality and establish plugin pipeline contracts

**Files:**

- Modify: `PRD.md`
- Create: `packages/plugin-api/src/contracts.ts`
- Modify: `packages/plugin-api/src/index.ts`, `packages/plugin-api/package.json`
- Create: `packages/plugin-api/src/contracts.test.ts`
- Create: `packages/codegen/src/source-file.ts`, `packages/codegen/src/imports.ts`
- Modify: `packages/codegen/src/index.ts`
- Create: `packages/codegen/src/source-file.test.ts`
- Create: `packages/core/src/pipeline.ts`, `packages/core/src/file-writer.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/package.json`
- Create: `packages/core/src/pipeline.test.ts`

**Interfaces:**

```ts
export type GeneratedFile = {
  path: string;
  contents: string;
  ownership: "generated" | "protected";
};

export type GenerationContext = {
  inputPath: string;
  outputDirectory: string;
  writeFile(file: GeneratedFile): void;
  log(message: string): void;
};

export type HexkitPlugin = {
  name: string;
  generate(context: GenerationContext): void;
};
```

- [ ] Write a failing BDD test proving a generated file overwrites, while an existing protected file is skipped and logged.
- [ ] Run the focused core test and confirm it fails because the pipeline/file writer is absent.
- [ ] Implement pure ownership decisions and a filesystem writer with injected `exists`, `write`, and `log` actions.
- [ ] Add snapshot tests for deterministic source-file/import rendering.
- [ ] Run package tests and `vp check`; commit `feat(core): add plugin pipeline and protected files`.

### Task 2: Define the PoC contract and generate Apical contracts

**Files:**

- Create: `apps/petstore-sample/openapi.poc.yaml`
- Create: `packages/plugin-apical/src/plugin.ts`
- Modify: `packages/plugin-apical/src/index.ts`, `packages/plugin-apical/package.json`
- Create: `packages/plugin-apical/src/plugin.test.ts`

**Interfaces:**

```ts
export function createApicalPlugin(runCraft?: CraftRunner): HexkitPlugin;
```

- [ ] Write contract and plugin tests that snapshot the seven operation IDs and assert craft receives `src/generated/contracts` as its output.
- [ ] Run the focused tests and confirm failure because the plugin/contract do not exist.
- [ ] Add JSON-only OpenAPI 3.1 Pet and Order schemas and the seven normative operations; implement the plugin using the existing injectable craft action.
- [ ] Generate contracts from the new fixture and inspect that the output contains all seven operation identifiers.
- [ ] Run focused tests and `vp check`; commit `feat(apical): generate petstore contract artifacts`.

### Task 3: Generate the hexagonal core skeleton

**Files:**

- Create: `packages/plugin-architecture-hexagonal/src/plugin.ts`
- Modify: `packages/plugin-architecture-hexagonal/src/index.ts`, `packages/plugin-architecture-hexagonal/package.json`
- Create: `packages/plugin-architecture-hexagonal/src/plugin.test.ts`

**Interfaces:**

```ts
export function createHexagonalPlugin(): HexkitPlugin;
```

**Constraint:** The plugin must derive domain entities, repository ports, and use-case skeletons from Apical contracts / OpenAPI IR. Do **not** hardcode Pet, Order, or Petstore operation lists in plugin source. Petstore appears only as a test fixture / dogfood OpenAPI input (PRD §5.0).

- [ ] Write a failing snapshot test that feeds the Petstore OpenAPI (or its Apical contract outputs) as input and expects derived entities, repository ports, and protected application use cases.
- [ ] Run it and confirm failure because the plugin is absent.
- [ ] Implement source-producing calculations that map contract schemas/operations to domain and port files (generated) and use-case files (protected).
- [ ] Add a regression check that the plugin source contains no Petstore domain literals (e.g. fixed `Pet`/`Order` type bodies); changing the fixture must change output without editing the plugin for that domain.
- [ ] Re-run generation after changing a protected use case; assert the changed source survives and missing new skeletons are added.
- [ ] Run package tests and `vp check`; commit `feat(hexagonal): generate protected use-case skeletons`.

### Task 4: Generate persistence artifacts and use cases

**Files:**

- Create: `packages/plugin-drizzle/src/plugin.ts`
- Modify: `packages/plugin-drizzle/src/index.ts`, `packages/plugin-drizzle/package.json`
- Create: `packages/plugin-drizzle/src/plugin.test.ts`
- Modify: `apps/petstore-sample/package.json`

**Interfaces:**

```ts
export function createDrizzlePlugin(): HexkitPlugin;
```

**Constraint:** Derive tables, FKs, repositories, and mappers from contracts/ports. Pet↔Order relations in snapshots come from the dogfood fixture, not from hardcoded SQL/entity strings in the plugin.

- [ ] Write failing BDD snapshot tests using the Petstore fixture for Drizzle tables, foreign-key relations present in that contract, repositories, and Zod-validated read mappers.
- [ ] Run the focused test and confirm the generator is missing.
- [ ] Add the runtime dependencies at their current published versions; implement generated schema, migrations, repositories, and mapping source driven by contracts/ports.
- [ ] Confirm snapshots include no independently defined request/response schema and that each read mapper parses through generated contracts.
- [ ] Run package tests and `vp check`; commit `feat(drizzle): generate validated postgres adapters`.

### Task 5: Generate the Hono application and runtime composition

**Files:**

- Create: `packages/plugin-hono/src/plugin.ts`
- Modify: `packages/plugin-hono/src/index.ts`, `packages/plugin-hono/package.json`
- Create: `packages/plugin-hono/src/plugin.test.ts`
- Create: generated runtime source through the plugin output

**Interfaces:**

```ts
export function createHonoPlugin(): HexkitPlugin;
```

**Constraint:** Derive routes/controllers from Apical operations discovered for the input contract. Do not hardcode Petstore operationIds or paths in the plugin.

- [ ] Write a failing snapshot test for JSON routes/controllers covering every operationId in the fixture and request/response validation boundaries.
- [ ] Run it and confirm failure because the Hono plugin is missing.
- [ ] Implement route/controller/runtime source generators that bind each generated operation to its protected use case and validate input/output with Apical artifacts.
- [ ] Run a generated application unit test against an injected repository action to prove invalid data cannot cross HTTP or DB-read boundaries.
- [ ] Run package tests and `vp check`; commit `feat(hono): generate validated http adapters`.

### Task 6: Implement CLI orchestration and generated packaging

**Files:**

- Create: `apps/cli/src/command.ts`, `apps/cli/src/main.ts`, `apps/cli/src/command.test.ts`
- Modify: `apps/cli/src/index.ts`, `apps/cli/package.json`
- Create: plugin source responsible for `Dockerfile`, `docker-compose.yml`, and startup/migration artifacts
- Modify: root/package manifests to link workspace packages

**Interfaces:**

```ts
export function runCli(
  arguments_: readonly string[],
  dependencies: {
    generate(inputPath: string, outputDirectory: string): void;
    log(text: string): void;
  },
): number;
```

- [ ] Write failing BDD tests that snapshot help text, assert clear errors for a missing input, and verify `generate <openapi> <output>` invokes the default ordered plugin pipeline.
- [ ] Run them and confirm failure because no CLI command exists.
- [ ] Implement argument calculation separately from process exit/output actions; wire the default plugins and generated Compose/Docker artifacts. Packaging must stay domain-agnostic (PRD §5.0); Petstore-specific Compose credentials/names belong in sample options or derived metadata, not hardcoded packaging generators.
- [ ] Invoke the built CLI against `openapi.poc.yaml`; verify it produces all required sample paths.
- [ ] Run package tests and `vp check`; commit `feat(cli): generate compose-ready petstore application`.

### Task 7: Dogfood generated app and acceptance tests

**Files:**

- Create: `apps/petstore-sample/tests/api.test.ts`
- Create: `apps/petstore-sample/tests/generation.test.ts`
- Modify: `apps/petstore-sample/package.json`
- Create: root or sample dogfood script

- [ ] Write failing BDD acceptance tests using Pactum for add/update/get/delete Pet and place/get/delete Order, including rejection of an Order whose Pet does not exist.
- [ ] Run the tests against the generated Compose stack and confirm they fail before the app is available.
- [ ] Generate the sample, start Compose, and implement only the runtime wiring necessary to make each acceptance behavior pass through PostgreSQL.
- [ ] Add generation integration tests that snapshot the manifest, assert all required output paths, and prove a hand-edited protected use case survives regeneration.
- [ ] Run all API tests and source-quality checks; commit `test(dogfood): cover generated petstore api`.

### Task 8: Final dogfood verification

**Files:**

- Modify: package scripts and generated quality configuration only if validation exposes a reproducible configuration gap.

- [ ] Run `vp check`, `vp run -r test`, and `vp run -r build` from the workspace root.
- [ ] Run the CLI from its built output to regenerate the sample, then run the generated app’s formatter/linter/type-check command.
- [ ] Start the generated Compose stack and run all Pactum tests.
- [ ] Inspect `git diff` to confirm `openapi.yaml` and `plugin-sst` remain unchanged.
- [ ] Commit any final, narrowly scoped correction as `fix(dogfood): align generated project validation`.
