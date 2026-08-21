# Grokking Simplicity Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Parallelism:** Task 1 is sequential. Tasks 2–7 are independent after Task 1 — dispatch one implementer per task, each editing **only that package**. Task 8 integrates on this branch.

**Goal:** Stratify Hexkit generator packages so Actions stay thin, Calculations are exported and unit-tested, and Data cannot represent invalid states — collapsing the #17 coverage-raise mega-tests.

**Architecture:** Wave 0 adds shared text/path/import calculations to `@hexkit/codegen`. Each plugin then splits its giant derive/normalize/render modules, completes intermediate models, and replaces fixture-heavy branch tests with table-driven calculation tests. Wave 2 wires hexagonal `persistenceKind` into drizzle and verifies the workspace.

**Tech Stack:** TypeScript, Vite+, Vitest (`vite-plus/test` BDD `describe`/`it`), `@hexkit/codegen` for shared calcs.

## Global Constraints

- Follow Grokking Simplicity: Actions (I/O, injected) / Calculations (pure) / Data (immutable, invalid states unrepresentable). Spec: `docs/superpowers/specs/2026-08-21-grokking-simplicity-refactor-design.md`.
- TDD: new extracted calculations get a failing test first; pure extracts keep existing tests green then shrink megafiles.
- PRD §5.0 domain-agnostic: no Petstore-specific strings in plugins.
- 90% coverage thresholds stay; do not lower `coverage.config.ts`.
- Conventional Commits; one commit per task.
- Breaking public APIs are allowed inside the tasked package only.
- Tasks 2–7 must not edit files outside their package directory (codegen is already done in Task 1).
- `@hexkit/plugin-sst` is out of scope.
- Do not change dogfood app source except if a generator API they import from `src/generated` is unaffected (dogfood apps consume generated output, not plugin internals).

---

## File map (locked)

### Task 1 — `@hexkit/codegen`

- Modify: `packages/codegen/src/imports.ts`, `naming.ts`, `index.ts`
- Create: `packages/codegen/src/text.ts`, `packages/codegen/src/paths.ts`
- Test: `packages/codegen/src/text.test.ts`, `paths.test.ts`, `imports.test.ts` (or extend existing), `naming.test.ts`

### Task 2 — `@hexkit/plugin-apical`

- Split: `packages/plugin-apical/src/contract/normalize.ts` → `json-pointer.ts`, `type-normalize.ts`, `operation-normalize.ts`, `validate-artifact.ts`, `application.ts`, thin `normalize.ts`
- Modify: `security.ts`, `generate-contracts.ts`, `plugin.ts`, `contract/index.ts`, `src/index.ts`
- Test: focused calc tests; shrink `normalize.test.ts` / spawn tests

### Task 3 — `@hexkit/plugin-architecture-hexagonal`

- Split: `packages/plugin-architecture-hexagonal/src/model/derive.ts` → `aggregate.ts`, `parameters.ts`, `entity.ts`, `repository.ts`, `use-case.ts`, thin `derive.ts`
- Modify: `artifact.ts`, `src/index.ts`
- Test: table-driven `aggregate.test.ts`, `parameters.test.ts`; shrink `derive.test.ts`

### Task 4 — `@hexkit/plugin-drizzle`

- Split: `packages/plugin-drizzle/src/model/derive.ts` → `column.ts`, `table.ts`, `method-kind.ts`, `repository.ts`, thin `derive.ts`
- Modify: `artifact.ts` if needed, generate `schema.ts` / `migration.ts` / `repository.ts`, `src/index.ts`
- Test: table-driven column/method-kind/order tests; delete getter-hack `render-edges` cases

### Task 5 — `@hexkit/plugin-hono`

- Split: `packages/plugin-hono/src/generate/routes.ts` → `routes/static-runtime.ts`, `routes/registrations.ts`, thin `routes.ts`
- Modify: `model/derive.ts` (use codegen `compareText`), `model/paths.ts` (re-export codegen `relativeImportPath`)
- Test: registration/static snippet unit tests; keep plugin snapshots

### Task 6 — `@hexkit/plugin-next`

- Modify: `artifact.ts` (complete `NextMethodBinding`), `model/derive.ts`, `generate/controllers.ts` (model-only render), `generate/pages.ts` (plan then render), `model/paths.ts`
- Test: replace `branch-coverage.test.ts` with calc tests

### Task 7 — `@hexkit/cli`

- Split: `apps/cli/src/packaging-plugin.ts` → `apps/cli/src/packaging/**`
- Modify: `main.ts` (drop logFn overload), `index.ts`
- Test: `resolve-repositories.test.ts`, `compose.test.ts`; shrink packaging section of `command.test.ts`

### Task 8 — integration

- Drizzle consumes hexagonal `persistenceKind` / `resultCardinality`
- Cross-package type fixes
- Workspace `vp run -r build && vp check && vp run -r test && vp run coverage`

---

### Task 1: Shared calculations in `@hexkit/codegen`

**Files:**
- Create: `packages/codegen/src/text.ts`, `packages/codegen/src/text.test.ts`
- Create: `packages/codegen/src/paths.ts`, `packages/codegen/src/paths.test.ts`
- Modify: `packages/codegen/src/imports.ts`, `naming.ts`, `index.ts`
- Test: `packages/codegen/src/naming.test.ts`, `source-file.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 2–7):

```ts
export function compareText(left: string, right: string): number;
export function unique<T>(values: readonly T[]): T[];
export function relativeImportPath(fromFilePath: string, toFilePath: string): string;
export function splitIdentifier(value: string): readonly string[];
export type NormalizedImport = {
  from: string;
  names: readonly string[];
  typeOnly: boolean;
};
export function mergeImports(imports: readonly ImportDeclaration[]): readonly NormalizedImport[];
```

- [ ] **Step 1: Write failing tests for text + path calculations**

```ts
// packages/codegen/src/text.test.ts
import { describe, expect, it } from "vite-plus/test";
import { compareText, unique } from "./text.ts";

describe("Given unordered strings", () => {
  it("when compared, then lexicographic order is stable including equality", () => {
    expect(compareText("a", "b")).toBe(-1);
    expect(compareText("b", "a")).toBe(1);
    expect(compareText("same", "same")).toBe(0);
  });
});

describe("Given duplicate values", () => {
  it("when uniqued, then first occurrences are kept", () => {
    expect(unique(["Pet", "Order", "Pet"])).toEqual(["Pet", "Order"]);
    expect(unique([])).toEqual([]);
  });
});
```

```ts
// packages/codegen/src/paths.test.ts
import { describe, expect, it } from "vite-plus/test";
import { relativeImportPath } from "./paths.ts";

describe("Given generated file paths", () => {
  it("when the target is in a sibling directory, then the specifier is relative", () => {
    expect(
      relativeImportPath("src/adapters/http/routes.ts", "src/core/ports/pet-repository.ts"),
    ).toBe("../../core/ports/pet-repository.ts");
  });

  it("when the target is in the same directory, then the specifier is dotted", () => {
    expect(relativeImportPath("src/a.ts", "src/b.ts")).toBe("./b.ts");
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

Run: `vp run test` in `packages/codegen` (or `vp exec pnpm --filter @hexkit/codegen test`)  
Expected: FAIL — `./text.ts` / `./paths.ts` missing.

- [ ] **Step 3: Implement calculations and rewire imports/naming**

```ts
// packages/codegen/src/text.ts
export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function unique<T>(values: readonly T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const value of values) {
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}
```

```ts
// packages/codegen/src/paths.ts
import { dirname, relative } from "node:path";

export function relativeImportPath(fromFilePath: string, toFilePath: string): string {
  const specifier = relative(dirname(fromFilePath), toFilePath).split("\\").join("/");
  return specifier.startsWith(".") ? specifier : `./${specifier}`;
}
```

Export `splitIdentifier` from `naming.ts`. Extract `mergeImports` from `renderImports` so `renderImports` is `mergeImports` → sort → render. Use `compareText` from `text.ts` instead of a private copy.

Re-export everything from `packages/codegen/src/index.ts`.

- [ ] **Step 4: Run package tests**

Run: `vp exec pnpm --filter @hexkit/codegen test`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/codegen
git commit -m "refactor(codegen): export compareText, unique, paths, and mergeImports"
```

---

### Task 2: Stratify `@hexkit/plugin-apical`

**Files:**
- Create under `packages/plugin-apical/src/contract/`: `json-pointer.ts`, `type-normalize.ts`, `operation-normalize.ts`, `validate-artifact.ts`, `application.ts` (+ matching `*.test.ts`)
- Modify: `normalize.ts` (orchestrator only), `security.ts`, `generate-contracts.ts`, `plugin.ts`, `contract/index.ts`, `src/index.ts`
- Test: shrink `normalize.test.ts`; add `formatCraftFailure` tests; keep `plugin.test.ts`

**Interfaces:**
- Consumes: codegen `toKebabCase` / `splitIdentifier` only if slugify is simplified; otherwise keep local NFKD slugify in `application.ts`.
- Produces:

```ts
export type RefResolver = {
  resolve(value: unknown, location: string): Record<string, unknown>;
};
export function createRefResolver(document: Record<string, unknown>): RefResolver;
export function normalizeContractType(value: unknown, location: string): ContractType;
export function formatCraftFailure(input: {
  status: number | null;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}): string;
export function normalizeSecuritySchemes(
  securitySchemes: Readonly<Record<string, unknown>>,
): readonly ContractSecurityScheme[];
export function resolveOperationSecurity(input: {
  operationSecurity?: unknown;
  pathItemSecurity?: unknown;
  globalSecurity: readonly ContractSecurityRequirement[];
  schemes: readonly ContractSecurityScheme[];
}): ContractOperationSecurity;
```

Stop re-exporting from package `index.ts`: `normalizeContractType`, `inspectSchemaIndex`, `inspectRoutesIndex`, `readOperationExtension`, `readPersistenceExtension`, `readReferenceExtension`. Keep them as package-internal exports from `contract/` if tests need them via relative imports.

- [ ] **Step 1: Write failing tests for `createRefResolver` circular/external/missing refs** using a tiny document, not `normalizeContractArtifact`.
- [ ] **Step 2: Confirm fail** — run `vp exec pnpm --filter @hexkit/plugin-apical test`.
- [ ] **Step 3: Extract `json-pointer.ts` + `type-normalize.ts`**; `normalize.ts` imports them. Keep behavior identical (same error strings).
- [ ] **Step 4: Tests pass** including existing `normalize.test.ts`.
- [ ] **Step 5: Write failing tests for `formatCraftFailure`** (exit vs signal vs details); implement; `runCraftCli` calls it.
- [ ] **Step 6: Change `resolveOperationSecurity` to the options object; delete `void document`. Update `security.test.ts`.**
- [ ] **Step 7: Split remaining normalize helpers; shrink mega `toThrow` `it`s into per-helper tests. Slim public `index.ts`.**
- [ ] **Step 8: Commit** `refactor(plugin-apical): split contract normalize into composable calculations`

---

### Task 3: Stratify `@hexkit/plugin-architecture-hexagonal`

**Files:**
- Create: `packages/plugin-architecture-hexagonal/src/model/aggregate.ts`, `parameters.ts`, `entity.ts`, `repository.ts`, `use-case.ts` (+ tests)
- Modify: `model/derive.ts`, `artifact.ts`, `src/index.ts`
- Test: `model/derive.test.ts` shrinks to orchestrator cases

**Interfaces:**
- Consumes: `compareText`, `unique` from `@hexkit/codegen`.
- Produces:

```ts
export function inferAggregateFromPath(
  path: string,
  schemaNames: ReadonlySet<string>,
): string | undefined;
export function resolveAggregate(
  operation: ContractOperation,
  schemaNames: ReadonlySet<string>,
): string;
export function deriveParameters(operation: ContractOperation): {
  parameters: ApplicationParameter[];
  referencedSchemas: readonly string[];
};
export function deriveReturnType(operation: ContractOperation): {
  expression: string;
  referencedSchemas: readonly string[];
  resultCardinality: "one" | "many" | "void";
};

export type ApplicationRepositoryMethod = {
  operationId: string;
  name: string;
  action: string;
  parameters: readonly ApplicationParameter[];
  returnTypeExpression: string;
  resultCardinality: "one" | "many" | "void";
  persistenceKind: "insert" | "update" | "delete" | "select" | "list" | "stub";
};
```

`persistenceKind` calculation (own this vocabulary once):

```ts
export function persistenceKindFromAction(
  action: string,
  httpMethod: ContractHttpMethod,
  resultCardinality: "one" | "many" | "void",
): ApplicationRepositoryMethod["persistenceKind"];
```

Map: create/add/place/insert → insert; update/patch → update; delete/remove → delete; list/findall/index → list; gethealth/health/readiness → stub; get/read/find or startsWith get → select; else HTTP method; then refine: select + cardinality many → list; select + no params + not many → stub.

`deriveUseCase(operation, repository, method)` — pass `method` in; do not `.find()` by operationId.

Replace local `compareText`/`unique` with codegen.

- [ ] **Step 1: Failing tests for `inferAggregateFromPath`** (`{itemId}`, trailing resource segment, no match → undefined). Move cases out of `derive.test.ts`.
- [ ] **Step 2: Confirm fail.**
- [ ] **Step 3: Implement `aggregate.ts` and `parameters.ts`; wire `derive.ts`.**
- [ ] **Step 4: Tests pass.**
- [ ] **Step 5: Failing tests for `persistenceKindFromAction` table; implement; add fields to artifact + `toApplicationArtifact`.**
- [ ] **Step 6: Export new calcs from `src/index.ts`. Commit** `refactor(plugin-architecture-hexagonal): split derive and publish persistenceKind`

---

### Task 4: Stratify `@hexkit/plugin-drizzle`

**Files:**
- Create: `packages/plugin-drizzle/src/model/column.ts`, `table.ts`, `method-kind.ts`, `repository.ts` (+ tests)
- Modify: `model/derive.ts`, generate `schema.ts`, `migration.ts`, `repository.ts`, `src/index.ts`
- Test: replace most of `derive-edges.test.ts` / `render-edges.test.ts`

**Interfaces:**
- Consumes: codegen `compareText`, `toSnakeCase`, `toCamelCase`, `toPascalCase`, `toKebabCase`. Hexagonal artifact still has `action`/`returnTypeExpression` (Wave 1). Optionally read `persistenceKind` if present; **do not fail** if you still compute kind locally this task.
- Produces:

```ts
export type PersistenceColumnModel =
  | {
      propertyName: string;
      sqlName: string;
      sqlType: "boolean" | "integer" | "text" | "jsonb";
      required: boolean;
      isIdentity: boolean;
      foreignKey?: PersistenceForeignKeyModel;
    }
  | {
      propertyName: string;
      sqlName: string;
      sqlType: "enum";
      required: boolean;
      isIdentity: boolean;
      enumExportName: string;
      enumSqlName: string;
      enumValues: readonly string[];
      foreignKey?: PersistenceForeignKeyModel;
    };

export function deriveColumn(
  schemaName: string,
  property: ContractProperty,
  identity: string,
  schemasByName: ReadonlyMap<string, ContractSchema>,
): PersistenceColumnModel; // assemble; do not mutate

export function columnsWithForeignKeys(
  columns: readonly PersistenceColumnModel[],
): ReadonlyArray<PersistenceColumnModel & { foreignKey: PersistenceForeignKeyModel }>;

export function resolveMethodKind(
  operation: ContractOperation,
  action: string,
): PersistenceMethodKind;
export function refineMethodKind(
  kind: PersistenceMethodKind,
  input: { parameterCount: number; returnsArray: boolean },
): PersistenceMethodKind;
```

`PersistenceRepositoryMethodModel` must include `entityParameterName` and `identityParameterName` so `generate/repository.ts` never uses `??`.

- [ ] **Step 1: Failing tests for discriminated enum columns and FK-on-structured-type rejection via `deriveColumn` directly.**
- [ ] **Step 2: Confirm fail.**
- [ ] **Step 3: Implement `column.ts` without mutation; switch schema/migration switches to the union.**
- [ ] **Step 4: Tests pass; delete render-edges tests that used optional enum fields / getter hacks.**
- [ ] **Step 5: Extract `method-kind.ts` + `orderTablesByDependency`; table-driven tests; shrink `derive-edges.test.ts`.**
- [ ] **Step 6: Commit** `refactor(plugin-drizzle): discriminate columns and extract persistence calculations`

---

### Task 5: Stratify `@hexkit/plugin-hono`

**Files:**
- Create: `packages/plugin-hono/src/generate/routes/static-runtime.ts`, `registrations.ts`
- Modify: `generate/routes.ts`, `model/derive.ts`, `model/paths.ts`, `src/index.ts` if needed
- Test: `generate/routes/registrations.test.ts`; keep `plugin.test.ts`

**Interfaces:**
- Consumes: `compareText`, `relativeImportPath` from `@hexkit/codegen`.
- Produces:

```ts
export function renderRouteRegistration(op: HttpOperationBinding): string;
export function renderSecurityMeta(op: HttpOperationBinding): string;
export function renderOnErrorHandler(options: { hasAuth: boolean }): string;
```

`model/paths.ts` becomes:

```ts
export { relativeImportPath } from "@hexkit/codegen";
```

(or delete the file and import codegen at call sites).

Do **not** change `HttpOperationBinding` shape unless a field is currently implicit; it is already the complete model.

- [ ] **Step 1: Failing test that `renderRouteRegistration` emits method+path+controller call for one `HttpOperationBinding` fixture (no plugin).**
- [ ] **Step 2: Confirm fail.**
- [ ] **Step 3: Extract registration + static snippets; `renderRoutesFile` composes them.**
- [ ] **Step 4: Plugin tests still pass.**
- [ ] **Step 5: Swap local `compareText`/`relativeImportPath` for codegen.**
- [ ] **Step 6: Commit** `refactor(plugin-hono): split route rendering into static and registration calculations`

---

### Task 6: Complete Next HTTP model and split renderers

**Files:**
- Modify: `packages/plugin-next/src/artifact.ts`, `model/derive.ts`, `generate/controllers.ts`, `generate/pages.ts`, `generate/files.ts`, `model/paths.ts`, `src/index.ts`
- Create: `packages/plugin-next/src/model/page-plan.ts` (+ test)
- Test: replace `branch-coverage.test.ts`

**Interfaces:**
- Consumes: codegen `compareText`, `relativeImportPath`, `unique`.
- Produces — **breaking:**

```ts
export type NextMethodBinding = {
  method: "get" | "post" | "put" | "patch" | "delete" | "head" | "options";
  operationId: string;
  useCaseTypeName: string;
  useCaseFactoryName: string;
  useCaseFilePath: string;
  repositoryParameterName: string;
  wrapperName: string;
  wrapperImportPath: string;
  responseMapName?: string;
  responseMapImportPath?: string;
  hasJsonBody: boolean;
  hasJsonSuccessBody: boolean;
  successStatus: string;
  notFoundStatus?: string;
  successMediaType?: string;
  requiresPrincipal: boolean;
  authSchemes: readonly NextAuthSchemeBinding[];
  useCaseArgumentExpressions: readonly string[];
};

export function renderControllersFile(model: NextHttpModel): GeneratedFile;
export function planPageFiles(model: NextHttpModel): readonly PagePlan[];
```

Move TRACE rejection to **one** `toNextMethod` calculation used only from `deriveNextHttpModel`. Delete the duplicate in controllers.

`generate/files.ts` must not pass `contract`/`application` into controllers.

- [ ] **Step 1: Failing test: `deriveNextHttpModel` populates `successStatus` / `useCaseArgumentExpressions` on bindings.**
- [ ] **Step 2: Confirm fail.**
- [ ] **Step 3: Widen derive; change `renderControllersFile` to model-only; update `plugin.test.ts` / `files.ts`.**
- [ ] **Step 4: Tests pass.**
- [ ] **Step 5: Extract `planPageFiles` / query coercion; move page branch-coverage cases onto the plan.**
- [ ] **Step 6: Delete `branch-coverage.test.ts` (or leave a short file that only re-exports nothing — prefer delete). Keep derive error tests (missing use case, TRACE) as `derive.test.ts`.**
- [ ] **Step 7: Commit** `refactor(plugin-next): complete HTTP model so controllers do not re-derive`

---

### Task 7: Stratify CLI packaging

**Files:**
- Create: `apps/cli/src/packaging/data/hono-static.ts`, `data/next-static.ts`, `model/resolve-repositories.ts`, `model/manifests.ts`, `model/plan.ts`, `render/compose.ts`, `render/server.ts`, `render/database.ts`, `render/files.ts`, `plugin.ts`
- Delete or thin: `apps/cli/src/packaging-plugin.ts` (re-export from `packaging/plugin.ts` for a short deprecation, or update `index.ts` / `main.ts` imports)
- Modify: `apps/cli/src/main.ts`, `index.ts`
- Test: `apps/cli/src/packaging/model/resolve-repositories.test.ts`, `render/compose.test.ts`

**Interfaces:**
- Consumes: codegen `relativeImportPath`, `compareText`. HTTP/persistence artifacts unchanged.
- Produces:

```ts
export type RuntimeRepositoryBinding = {
  runtimeKey: string;
  factoryName: string;
  filePath: string;
};

export function resolveRuntimeRepositories(input: {
  httpKeys: ReadonlySet<string>;
  persistence: PersistenceArtifact;
  httpLabel: "HttpArtifact" | "NextHttpArtifact";
}): RuntimeRepositoryBinding[];

export type ComposePlan = {
  databaseName: string;
  appService: {
    name: "app" | "next";
    healthcheck?: { test: readonly string[]; startPeriod?: string };
  };
};

export function renderDockerCompose(plan: ComposePlan): string;
export function buildHonoPackagingPlan(inputs: PackagingInputs): PackagingPlan;
export function buildNextPackagingPlan(inputs: NextPackagingInputs): PackagingPlan;
export function renderPackagingFiles(plan: PackagingPlan): GeneratedFile[];
```

`createPackagingPlugin` Action: require artifacts → `build*Plan` → `renderPackagingFiles` → `writeFile`. Next plan **uses** `resolveRuntimeRepositories` return value (even if only to validate), not as a discarded statement.

`main` signature:

```ts
export async function main(
  arguments_: readonly string[],
  options: MainOptions = {},
): Promise<number>;
```

Update tests that passed a log function as the second argument.

- [ ] **Step 1: Failing tests for `resolveRuntimeRepositories` key mismatch (Hono and Next labels) without building a plugin context.**
- [ ] **Step 2: Confirm fail.**
- [ ] **Step 3: Implement shared resolve + parameterized compose; split files; wire plugin.**
- [ ] **Step 4: Existing `command.test.ts` packaging cases pass; then delete duplicated Hono/Next error suites in favor of the unit tests.**
- [ ] **Step 5: Drop `main` logFn overload; fix tests.**
- [ ] **Step 6: Commit** `refactor(cli): split packaging into plan, render, and plugin actions`

---

### Task 8: Integrate and verify

**Files:**
- Modify: `packages/plugin-drizzle/src/model/method-kind.ts` (or `repository.ts`) to prefer `method.persistenceKind` / `resultCardinality` from hexagonal when present
- Modify: any leftover cross-package imports broken by public API shrinks
- Modify: `docs/README.md` to list this spec/plan
- Test: full workspace

**Interfaces:**
- Consumes: Task 3 `ApplicationRepositoryMethod.persistenceKind` and `resultCardinality`.
- Produces: drizzle `resolveMethodKind` becomes a fallback only, or deleted if all paths set hexagonal fields.

- [ ] **Step 1: Point drizzle repository derive at hexagonal `persistenceKind`; keep `refineMethodKind` only if cardinality still needs a local pass — prefer hexagonal `resultCardinality` (`many` → list).**
- [ ] **Step 2: Run `vp run -r build && vp check && vp run -r test && vp run coverage`.** Expected: all pass, coverage ≥ 90% per package.
- [ ] **Step 3: Grep for leftover private `compareText` / duplicate `relativeImportPath` / `void document` / `renderControllersFile(model, contract`.**
- [ ] **Step 4: Commit** `refactor: consume hexagonal persistenceKind and finish Grokking Simplicity split`

---

## Self-review

1. **Spec coverage:** Shared codegen, apical split, hexagonal persistenceKind, drizzle discriminated columns, hono routes split, next complete model, cli packaging layers, integration — each has a task.
2. **Placeholders:** none; signatures are exact.
3. **Type consistency:** `persistenceKind` union matches drizzle `PersistenceMethodKind`; Next `renderControllersFile(model)` matches Task 6; codegen exports match Task 1.
