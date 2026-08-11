# Next.js App Router Route Handlers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in `@hexkit/plugin-next` that generates Next.js 16 App Router Route Handlers from OpenAPI/Apical contracts while keeping Hono as the default HTTP adapter.

**Architecture:** Reuse apical + hexagonal + drizzle artifacts. When `--http next` is selected, swap `plugin-hono` for `plugin-next`, which emits thin `app/**/route.ts` entrypoints plus shared helpers under `src/adapters/http-next/`. Auth and Zod boundaries stay identical to Hono. Packaging emits a Next + Postgres Compose stack for dogfood.

**Tech Stack:** TypeScript, Vite+, Vitest, Next.js 16 App Router Route Handlers (`route.ts`, `NextRequest`/`Response.json`), Apical Zod wrappers, existing Hexkit plugins.

**Design spec:** [`docs/superpowers/specs/2026-08-11-nextjs-route-handlers-design.md`](../specs/2026-08-11-nextjs-route-handlers-design.md)

## Global Constraints

- Hono remains the **default** pipeline; Petstore `vp run dogfood` must stay green without Next.
- Plugins stay domain-agnostic (PRD §5.0); fixtures live under `apps/`.
- OpenAPI → public HTTP mapping uses **Route Handlers only** (no Server Actions, no `pages/api`).
- No forced `/api` prefix — map OpenAPI paths literally under `app/`.
- Dynamic/request-time handlers by default (do not emit `force-static` / `use cache` for API routes).
- Reuse Apical wrappers + hexagonal `Authenticator`/`Principal`; no parallel auth schemas.
- Calculation/action separation; TDD with Vitest BDD style; Conventional Commits per task.
- Invoke tooling via `vp` (`vp check`, `vp test`, `vp run -r build`).

## File map (what each new/changed unit owns)

| Path | Responsibility |
| ---- | -------------- |
| `packages/plugin-next/package.json` | Package metadata + Next peer/dev deps for tests |
| `packages/plugin-next/src/model/paths.ts` | OpenAPI path → App Router file path |
| `packages/plugin-next/src/model/derive.ts` | Derive Next HTTP model from contract + application |
| `packages/plugin-next/src/artifact.ts` | `NextHttpArtifact` types |
| `packages/plugin-next/src/generate/helpers.ts` | Shared request/auth/response helper source |
| `packages/plugin-next/src/generate/controllers.ts` | Controller wiring to use cases |
| `packages/plugin-next/src/generate/routes.ts` | Emit `app/**/route.ts` files |
| `packages/plugin-next/src/generate/runtime.ts` | Compose use cases + authenticator for handlers |
| `packages/plugin-next/src/generate/auth-adapter.ts` | Reuse/copy Hono stub pattern when security present |
| `packages/plugin-next/src/plugin.ts` | `createNextPlugin()` |
| `packages/plugin-next/src/plugin.test.ts` | Path mapping, generation snapshots, auth status |
| `apps/cli/src/command.ts` | Parse `--http hono\|next` |
| `apps/cli/src/main.ts` | Select plugin set + packaging variant |
| `apps/cli/src/packaging-plugin.ts` | Next packaging branch (or split packaging module) |
| `apps/cli/src/next-generation.test.ts` | Integration: generate fixture with `--http next` |
| `apps/fixtures/next-api/` | Optional dedicated dogfood fixture + Pactum suite |
| `RFC.md` / `PRD.md` / `docs/README.md` | Product amendment + links |

---

### Task 1: Scaffold `@hexkit/plugin-next` and OpenAPI→App Router path mapping

**Files:**

- Create: `packages/plugin-next/package.json`
- Create: `packages/plugin-next/tsconfig.json`
- Create: `packages/plugin-next/vite.config.ts`
- Create: `packages/plugin-next/src/index.ts`
- Create: `packages/plugin-next/src/model/paths.ts`
- Create: `packages/plugin-next/src/model/paths.test.ts`
- Modify: root workspace/`pnpm-workspace` membership if packages are auto-included; otherwise ensure package is visible to `vp install`

**Interfaces:**

- Consumes: OpenAPI path string (e.g. `/pet/{petId}`)
- Produces:

```ts
export function openApiPathToAppRouteFile(openApiPath: string): string;
// "/pet/{petId}" → "app/pet/[petId]/route.ts"
// "/store/order" → "app/store/order/route.ts"
// "/" → "app/route.ts"

export function openApiPathToAppRouteSegments(openApiPath: string): string[];
// "/pet/{petId}" → ["pet", "[petId]"]
```

- [ ] **Step 1: Write the failing path-mapping tests**

```ts
import { describe, expect, it } from "vite-plus/test";
import { openApiPathToAppRouteFile } from "./paths.ts";

describe("Given OpenAPI paths", () => {
  it("when mapped, then static and dynamic segments become App Router files", () => {
    expect(openApiPathToAppRouteFile("/pet")).toBe("app/pet/route.ts");
    expect(openApiPathToAppRouteFile("/pet/{petId}")).toBe("app/pet/[petId]/route.ts");
    expect(openApiPathToAppRouteFile("/store/order/{orderId}")).toBe(
      "app/store/order/[orderId]/route.ts",
    );
    expect(openApiPathToAppRouteFile("/")).toBe("app/route.ts");
  });
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `vp test packages/plugin-next/src/model/paths.test.ts`  
Expected: FAIL (module/package missing)

- [ ] **Step 3: Scaffold the package and implement path mapping**

Mirror `packages/plugin-hono` package shape (`name: "@hexkit/plugin-next"`, workspace deps on `@hexkit/plugin-api`, `@hexkit/codegen`, `@hexkit/plugin-apical`, `@hexkit/plugin-architecture-hexagonal`). Implement `{param}` → `[param]`; reject empty segments; do not add an `/api` prefix.

- [ ] **Step 4: Re-run tests and `vp check`**

Run: `vp test packages/plugin-next/src/model/paths.test.ts && vp check`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-next
git commit -m "feat(plugin-next): scaffold package and map OpenAPI paths to App Router"
```

---

### Task 2: Derive Next HTTP model and emit shared helpers + controllers

**Files:**

- Create: `packages/plugin-next/src/artifact.ts`
- Create: `packages/plugin-next/src/model/derive.ts`
- Create: `packages/plugin-next/src/generate/helpers.ts`
- Create: `packages/plugin-next/src/generate/controllers.ts`
- Create: `packages/plugin-next/src/generate/auth-adapter.ts`
- Modify: `packages/plugin-next/src/plugin.test.ts` (start suite)

**Interfaces:**

- Consumes: `ContractArtifact`, `ApplicationArtifact`
- Produces:

```ts
export type NextRouteFile = {
  filePath: string; // app/.../route.ts
  openApiPath: string;
  methods: readonly NextMethodBinding[];
};

export type NextMethodBinding = {
  method: "get" | "post" | "put" | "patch" | "delete" | "head" | "options";
  operationId: string;
  useCaseTypeName: string;
  useCaseFilePath: string;
  wrapperName: string;
  wrapperImportPath: string;
  responseMapName?: string;
  responseMapImportPath?: string;
  hasJsonBody: boolean;
  requiresPrincipal: boolean;
  security?: /* same shape as Hono operation security meta */;
};

export type NextHttpModel = {
  routes: readonly NextRouteFile[];
  repositories: ApplicationArtifact["repositories"];
  authenticator?: {
    portFilePath: string;
    adapterFilePath: string;
    adapterFactoryName: "createInMemoryAuthenticator";
  };
};

export function deriveNextHttpModel(
  contract: ContractArtifact,
  application: ApplicationArtifact,
): NextHttpModel;
```

Shared generated helpers (`src/adapters/http-next/helpers.ts`) must include:

- `toApicalHeaders(headers: Headers): Record<string, string>`
- `buildApicalRequest(request: Request, pathParams: Record<string, string>, body?: unknown)`
- status mapping: validation → 400, auth → 401, else 500 (no stack leak)

Controllers mirror Hono’s `createHttpControllers(useCases, authenticator?)` but accept plain Apical request objects (framework-free), so `route.ts` only adapts Next → Apical request.

- [ ] **Step 1: Write failing derive/controller tests**

Assert:

- Operations with the same OpenAPI path coalesce into one `NextRouteFile`.
- Library fixture produces `app/books/[bookId]/route.ts` (or whatever the library paths are) **without** Pet/Order literals in plugin source.
- Auth operations mark `requiresPrincipal: true`.

- [ ] **Step 2: Run focused tests — expect FAIL**

- [ ] **Step 3: Implement derive + generators**

Use `@hexkit/codegen` `renderSourceFile` (no Handlebars). For auth adapter, follow `plugin-hono`’s in-memory stub (`test-token` / `test-key` defaults) so existing auth dogfood matrix stays reusable.

- [ ] **Step 4: Run tests + `vp check`**

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-next
git commit -m "feat(plugin-next): derive model and emit http-next helpers"
```

---

### Task 3: Emit `app/**/route.ts` files and runtime composition

**Files:**

- Create: `packages/plugin-next/src/generate/routes.ts`
- Create: `packages/plugin-next/src/generate/runtime.ts`
- Create: `packages/plugin-next/src/plugin.ts`
- Modify: `packages/plugin-next/src/index.ts`
- Modify: `packages/plugin-next/src/plugin.test.ts`

**Interfaces:**

```ts
export function createNextPlugin(): HexkitPlugin;
```

Generated `route.ts` pattern (illustrative for `GET /pet/{petId}`):

```ts
import type { NextRequest } from "next/server";
import { getRuntime } from "@/src/adapters/http-next/runtime";
import { toApicalRequest, handleControllerResult } from "@/src/adapters/http-next/helpers";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ petId: string }> },
) {
  const params = await ctx.params;
  const runtime = getRuntime();
  try {
    const apicalRequest = await toApicalRequest(request, params, { jsonBody: false });
    const result = await runtime.controllers.getPetById(apicalRequest);
    return handleControllerResult(result);
  } catch (error) {
    return handleControllerError(error);
  }
}
```

Notes for implementers:

- Prefer relative imports consistent with other Hexkit packages if `@/` aliases are not emitted yet; if packaging adds `tsconfig` paths, keep them in sync.
- Coalesce methods into the same file.
- `getRuntime()` must lazily compose Drizzle repos + use cases + authenticator (same responsibilities as Hono `createHonoApp` wiring).
- Do **not** export `dynamic = 'force-static'`.

- [ ] **Step 1: Write failing plugin generation test**

Feed Petstore + Library contract fixtures as inputs; assert emitted `app/**/route.ts` contents contain correct method exports and import controllers/runtime; assert Library generation has no Petstore identifiers in output.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement route + runtime generators and `createNextPlugin`**

Plugin must read prior artifacts from generation context the same way `plugin-hono` does (contract + application artifacts). Write files with ownership `"generated"`.

- [ ] **Step 4: Run plugin tests + `vp check`**

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-next
git commit -m "feat(plugin-next): generate App Router route handlers and runtime"
```

---

### Task 4: CLI `--http` selection and Next packaging

**Files:**

- Modify: `apps/cli/src/command.ts`
- Modify: `apps/cli/src/command.test.ts`
- Modify: `apps/cli/src/main.ts`
- Modify: `apps/cli/src/packaging-plugin.ts` (or split `packaging-hono.ts` / `packaging-next.ts`)
- Create: `apps/cli/src/next-generation.test.ts`
- Modify: `apps/cli/package.json` / workspace deps to depend on `@hexkit/plugin-next`

**Interfaces:**

```ts
// command parsing
// hexkit generate <openapi> <output> [--http hono|next]
// default: hono

export function createDefaultPlugins(options?: {
  apical?: ApicalPluginOptions;
  http?: "hono" | "next";
}): readonly HexkitPlugin[];
```

Next packaging must emit at least:

- `package.json` with `next`, `react`, `react-dom`, drizzle deps, scripts: `dev` → `next dev`, `build` → `next build`, `start` → `next start`, plus Hexkit `check` alignment where practical
- `next.config.ts` (minimal)
- `tsconfig.json` with Next App Router options
- `Dockerfile` + `docker-compose.yml` (Next server + Postgres), schema apply on startup like Hono packaging
- Do **not** emit Hono server entry when `--http next`

- [ ] **Step 1: Write failing CLI tests**

```ts
it("when --http next is passed, then help/parse selects next adapter", () => {
  // assert parsed options.http === "next"
});

it("when generating with http next, then app/**/route.ts exists and src/adapters/http/routes.ts does not", async () => {
  // generate library fixture into temp dir
});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement flag + packaging branch**

Keep default plugins = apical → hexagonal → **hono** → drizzle → packaging(hono).  
For next: apical → hexagonal → **next** → drizzle → packaging(next).

- [ ] **Step 4: Run CLI tests + `vp check`**

- [ ] **Step 5: Commit**

```bash
git add apps/cli packages/plugin-next
git commit -m "feat(cli): add --http next and Next.js packaging"
```

---

### Task 5: Next dogfood fixture + Pactum acceptance

**Files:**

- Create or extend: `apps/fixtures/next-api/` (may reuse `library-api` / `auth-api` OpenAPI by reference)
- Create: `apps/fixtures/next-api/tests/api.test.ts`
- Create: `apps/fixtures/next-api/scripts/dogfood.sh`
- Modify: root `vite.config.ts` / `package.json` to add `dogfood-next` task
- Modify: `apps/cli/src/domain-agnostic.test.ts` only if new production roots need scanning (`packages/plugin-next/src`)

**Acceptance matrix (minimum):**

- Unsecured happy path for each fixture operation (or a trimmed slice).
- If using auth-api OpenAPI with `--http next`: missing/invalid credentials → **401**; valid stub token/key → success.
- Server Components guidance verified only in docs (no UI generation required).

- [ ] **Step 1: Write failing Pactum tests expecting a running Next base URL**

Env: `NEXT_API_URL` (default `http://127.0.0.1:3000`).

- [ ] **Step 2: Implement dogfood script**

```bash
# generate with --http next → install → compose up → wait ready → vp test api suite
```

- [ ] **Step 3: Run `vp run dogfood-next` and fix generator/packaging gaps until green**

- [ ] **Step 4: Confirm `vp run dogfood` (Hono Petstore) still passes (or generation+unit path if Docker-constrained; prefer full)**

- [ ] **Step 5: Commit**

```bash
git add apps/fixtures apps/cli vite.config.ts package.json packages/plugin-next
git commit -m "test: dogfood Next.js Route Handlers with Pactum"
```

---

### Task 6: Docs sync (RFC / PRD / README)

**Files:**

- Modify: `RFC.md` — optional HTTP adapter note under Technology Stack / Non-Goals amendment
- Modify: `PRD.md` §11 follow-ups — add Next.js Route Handlers pointer; clarify multi-framework PoC non-goal vs post-PoC opt-in
- Modify: `docs/README.md` — link design + plan
- Modify: root `README.md` — short `--http next` / `dogfood-next` mention
- Modify: `packages/plugin-next/README.md` — package overview

- [ ] **Step 1: Apply doc edits matching design §7**

Must state explicitly:

- Hono remains default.
- OpenAPI maps to App Router Route Handlers.
- Server Actions are not the OpenAPI surface.
- RSC should call hexagonal use cases in-process (DAL), not self-fetch Route Handlers.

- [ ] **Step 2: Run `vp check`**

- [ ] **Step 3: Commit**

```bash
git add RFC.md PRD.md README.md docs packages/plugin-next/README.md
git commit -m "docs: record opt-in Next.js Route Handlers adapter"
```

---

### Task 7: Verification gate

- [ ] **Step 1: `vp check`**
- [ ] **Step 2: `vp run -r test`**
- [ ] **Step 3: `vp run -r build`**
- [ ] **Step 4: `vp run dogfood-next`**
- [ ] **Step 5: `vp run dogfood` (Hono regression)**

---

## Self-review checklist (plan author)

1. **Spec coverage:** Approach A → Tasks 1–3; CLI/packaging → Task 4; dogfood → Task 5; RFC/PRD → Task 6; success criteria → Task 7.
2. **Placeholders:** None intentional; path helpers and CLI flag are concrete.
3. **Type consistency:** `NextHttpModel` / `createNextPlugin` / `--http next` naming stable across tasks.
4. **PoC safety:** Default Hono pipeline and Petstore dogfood explicitly preserved.
5. **Next.js fidelity:** Route Handlers + awaited `params` + dynamic default + DAL guidance for RSC; Server Actions excluded.
