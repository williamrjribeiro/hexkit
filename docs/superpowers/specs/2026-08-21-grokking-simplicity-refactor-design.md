# Grokking Simplicity refactor — design

**Status:** Approved for implementation (single PR; parallel per package)  
**Date:** 2026-08-21

## Problem

The 90% coverage raise (#17) proved generator behavior with **fixture-heavy branch tests**, not with small calculations:

| Package                                 | Coverage-raise test smell                                                  |
| --------------------------------------- | -------------------------------------------------------------------------- |
| `@hexkit/plugin-next`                   | `branch-coverage.test.ts` (434 lines) drives renderers with full artifacts |
| `@hexkit/plugin-drizzle`                | `derive-edges.test.ts` (423) + `render-edges.test.ts` (311)                |
| `@hexkit/plugin-apical`                 | `normalize.test.ts` +463 lines of sequential mutate/`toThrow`              |
| `@hexkit/plugin-architecture-hexagonal` | `derive.test.ts` (301) rebuilds full contracts per aggregate strategy      |
| `@hexkit/cli`                           | `command.test.ts` +241 lines of packaging dual-path fixtures               |
| `@hexkit/codegen`                       | empty-identifier / typeOnly sort edges through fat `renderImports`         |

Those tests are a TDD **refactor signal**: calculations are buried inside orchestrators, invalid Data is representable, and renderers re-derive instead of consuming complete models.

## Grokking Simplicity rules (binding)

From Eric Normand, _Grokking Simplicity_, already required by the PoC plan:

1. **Actions** — I/O, order-dependent, implicit inputs/outputs. Keep them thin and injected (`CraftRunner`, `FileWriterActions`, plugin `generate`).
2. **Calculations** — pure, same input → same output. These are the unit-test surface.
3. **Data** — immutable, intention-revealing names; invalid states unrepresentable (discriminated unions over optional fields).
4. **Extract calculations from actions** so tests do not need filesystem, craft, or full OpenAPI documents.
5. **Make implicit inputs/outputs explicit** — pass Data in, return Data out; no mutation of locals that later become fields; no `??` fallbacks in renderers.
6. **Stratified design** — one purpose per module; compose bottom-up. A renderer never re-enters the contract/application artifacts to “look something up.”

## Approaches considered

| Approach                                                 | What                                                                                                         | Trade-off                                                                        |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| A. New `@hexkit/http-adapter-model` package              | Share Hono/Next controller bindings                                                                          | Highest DRY; new package + sequential coupling; YAGNI for PoC                    |
| B. Extract-in-place only (no new files)                  | Pull helpers to the bottom of the same 600-line files                                                        | Parallel-safe; files stay uncomposable                                           |
| **C. Codegen shared utils + per-package stratification** | Tiny shared calcs in `@hexkit/codegen`; each package splits giant modules; complete models; breaking APIs OK | **Chosen** — max parallelism, no new package, directly addresses coverage smells |

Rejected A because HTTP plugins can complete their own models without a new workspace package. Rejected B because `normalize.ts` (615), `packaging-plugin.ts` (633), and `plugin-drizzle` `derive.ts` (522) are already past a size where one-purpose modules fit in working memory.

## Architecture

```
Wave 0 — @hexkit/codegen
  compareText, unique, relativeImportPath, splitIdentifier, mergeImports
        │
        ▼
Wave 1 — parallel, one package each (edit only that package)
  apical │ hexagonal │ drizzle │ hono │ next │ cli packaging
        │
        ▼
Wave 2 — integration on this branch
  hexagonal persistenceKind consumed by drizzle (if Wave 1 published it)
  vp check / test / coverage stay green
  collapse leftover mega tests
```

Plugins remain the **action edge**: `require` artifacts → call calculations → `writeFile`. Generated source is still strings; the change is that **planning** (Data) is finished before **rendering** (Calculation → string).

## Shared foundation (`@hexkit/codegen`)

Export (additive, then consumers switch):

```ts
export function compareText(left: string, right: string): number;
export function unique<T>(values: readonly T[]): T[];
export function relativeImportPath(fromFilePath: string, toFilePath: string): string;
export function splitIdentifier(value: string): readonly string[];
export function mergeImports(imports: readonly ImportDeclaration[]): readonly NormalizedImport[];
export type NormalizedImport = {
  from: string;
  names: readonly string[];
  typeOnly: boolean;
};
```

Do **not** move OpenAPI/contract helpers into codegen (wrong dependency direction). HTTP-specific calcs (`findJsonMedia`, `deriveAuthSchemes`) stay in the HTTP plugins as exported calculations.

## Per-package design

### `@hexkit/plugin-apical`

Split `contract/normalize.ts` into:

- `json-pointer.ts` — `createRefResolver(document)` so `document` is not threaded
- `type-normalize.ts` — `readNullableType`, `readEnum`, `normalizeContractType`, `normalizeProperties`
- `operation-normalize.ts` — parameters, media, requestBody, responses, operations
- `validate-artifact.ts` — reference/persistence/security enforceability
- `application.ts` — title/version/slug
- `normalize.ts` — thin orchestrator only

Security: drop the unused `document` argument; `normalizeSecuritySchemes` takes the schemes record, not the whole document.

Craft: extract `formatCraftFailure` calculation; keep one spawn integration test.

Public API shrink: stop re-exporting `normalizeContractType`, `inspectSchemaIndex`, `inspectRoutesIndex`, extension readers. Keep `createApicalPlugin`, `normalizeContractArtifact`, `inspectGeneratedIndexes`, `generateContracts`, `loadValidatedOpenApi`, `Contract*` types.

### `@hexkit/plugin-architecture-hexagonal`

Split `model/derive.ts` into `aggregate.ts`, `parameters.ts`, `entity.ts`, `repository.ts`, `use-case.ts`, thin `derive.ts`.

Export strategy calculations so `derive.test.ts` becomes table-driven:

- `inferAggregateFromPath`
- `resolveAggregate`
- `deriveParameters`
- `deriveReturnType`

**Breaking Data (additive):** `ApplicationRepositoryMethod` gains:

```ts
resultCardinality: "one" | "many" | "void";
persistenceKind: "insert" | "update" | "delete" | "select" | "list" | "stub";
```

Hexagonal owns classification once so drizzle does not re-parse action synonyms + `"Array<"` prefixes. Keep existing `action` / `returnTypeExpression` fields this PR so Wave 1 drizzle can land in parallel; Wave 2 switches drizzle to the new fields.

### `@hexkit/plugin-drizzle`

Discriminated `PersistenceColumnModel` (`sqlType: "enum"` requires enum fields). No mutation in `deriveColumn`.

Split `model/` into `column.ts`, `table.ts`, `method-kind.ts`, `repository.ts`, thin `derive.ts`.

Renderers take complete Data: no `??` parameter fallbacks, no filter/map then throw if `foreignKey` missing. Delete getter-hack tests in `render-edges.test.ts`.

Export `resolveMethodKind`, `refineMethodKind`, `orderTablesByDependency`, `deriveColumn` for table-driven tests.

### `@hexkit/plugin-hono`

Keep `HttpOperationBinding` as the complete model (already the template). Split `generate/routes.ts` into static runtime snippets vs per-operation registration.

Replace local `compareText` / `relativeImportPath` with codegen.

Export `deriveOperation` (or equivalent) if tests need it; renderers stay `(model: HttpModel) => GeneratedFile`.

### `@hexkit/plugin-next`

**Highest-leverage HTTP change:** complete the Next HTTP model so controllers stop taking `contract` + `application`.

Widen `NextMethodBinding` (or add `operations` like Hono) with:

- `useCaseFactoryName`, `repositoryParameterName`
- `successStatus`, `notFoundStatus?`
- `hasJsonSuccessBody`, `successMediaType?`
- `useCaseArgumentExpressions`

`renderControllersFile(model: NextHttpModel): GeneratedFile` — drop the extra artifacts.

Extract page planning (`planPageFiles` / query coercion) so `branch-coverage.test.ts` collapses into focused calc tests.

Re-export `relativeImportPath` from `@hexkit/codegen` for compatibility, or break callers (CLI tests that import from plugin-next should follow).

### `@hexkit/cli` packaging

Split `packaging-plugin.ts` into:

```
apps/cli/src/packaging/
  data/          # frozen Docker/tsconfig/eslint strings
  model/         # resolveRuntimeRepositories, manifests, plans
  render/        # compose, server, database, files
  plugin.ts      # Action only
```

One `resolveRuntimeRepositories` (today Hono and Next copies). One parameterized compose renderer. Next must not call resolve only for its throw side-effect — validation is an explicit calculation whose result is Data.

`main(args, logFn)` overload → options object only.

### `@hexkit/core` / `@hexkit/plugin-api`

Already stratified (`decideFileWrite` vs writer action; artifact registry). No structural change. Optionally import `compareText` if any local copy appears; today they do not.

### `@hexkit/plugin-sst`

Scaffold only. Out of scope.

## Testing strategy

- **New extracted calculations:** TDD — failing test first, then implementation.
- **Pure extracts with unchanged behavior:** existing tests stay green (classic refactor step). Then replace mega fixture tests with table-driven calc tests in the same package.
- Keep at least one plugin-level snapshot/integration test per generator.
- 90% coverage gate remains; do not lower thresholds.
- Domain-agnostic invariant (PRD §5.0) unchanged: no Petstore strings in plugins.

## Parallelism and git

All work lands on **one branch / one PR**.

1. Wave 0 commits on the PR branch (`@hexkit/codegen` only).
2. Wave 1 agents each edit **only their package directory** (plus that package’s tests). They consume Wave 0 codegen exports. They may change that package’s public API.
3. Wave 2 on the PR branch: wire hexagonal `persistenceKind` into drizzle, fix cross-package type breaks, run `vp run -r build && vp check && vp run -r test && vp run coverage`.

## Success criteria

- Giant modules split so derive/normalize/packaging orchestrators are thin compositions.
- Renderers consume complete models (Next controllers no longer take contract+application).
- Discriminated persistence columns; render-edge getter hacks gone.
- Coverage-raise megafiles substantially replaced by calculation unit tests.
- `vp check`, `vp run -r test`, `vp run coverage` green.
- Breaking public APIs documented in the PR body.

## Non-goals

- New workspace packages
- Changing generated Petstore/auth dogfood _behavior_ (output may differ only where APIs of generators change in equivalent ways)
- `plugin-sst` implementation
- Lowering the 90% coverage floor
- Result/`ValidationIssue[]` instead of throw (defer; throws stay at calculation edges this PR)
