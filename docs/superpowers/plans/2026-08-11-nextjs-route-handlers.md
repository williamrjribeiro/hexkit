# Next.js App Router Route Handlers + RSC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, **domain-agnostic** `@hexkit/plugin-next` that generates Next.js 16 App Router Route Handlers, basic RSC pages, or **both** (selectable surface) from OpenAPI/Apical contracts, while keeping Hono as the default HTTP adapter.

**Architecture:** Reuse apical + hexagonal + drizzle artifacts. When `--http next` is selected, swap `plugin-hono` for `plugin-next` with `surface: "routes" | "rsc" | "both"` (default `both`). Routes emit `app/**/route.ts` at literal OpenAPI paths; RSC emits server-access + pages (`app/ui/...` when `both`, contract paths when `rsc`-only). Auth/Zod for HTTP match Hono. Packaging emits a Next + Postgres Compose stack for dogfood.

**Tech Stack:** TypeScript, Vite+, Vitest, Next.js 16 App Router (`route.ts`, `page.tsx` RSC, `NextRequest`/`Response.json`), Apical Zod wrappers, existing Hexkit plugins.

**Design spec:** [`docs/superpowers/specs/2026-08-11-nextjs-route-handlers-design.md`](../specs/2026-08-11-nextjs-route-handlers-design.md)

## Global Constraints

- Hono remains the **default** pipeline; Petstore `vp run dogfood` must stay green without Next.
- **`@hexkit/plugin-next` is domain-agnostic (PRD §5.0 / design §3):** no Petstore, library, auth-api, or other sample-domain literals in plugin **production** source. Fixtures live under `apps/`. Plugin tests may feed sample OpenAPI as inputs and snapshot outputs only.
- Changing fixture OpenAPI must change generated `route.ts` / `page.tsx` **without** editing `plugin-next` for that domain.
- `apps/cli` domain-agnostic scanner **must** include `packages/plugin-next/src`.
- OpenAPI → public HTTP mapping uses **Route Handlers only** (no Server Actions, no `pages/api`).
- RSC pages call **server-access / use cases in-process** — never `fetch` own Route Handlers.
- `NextSurface = "routes" | "rsc" | "both"` (default `both`). Filter generators by surface; do not emit disabled artifacts.
- Path placement: `both` → RSC under `app/ui/...`; `rsc` → RSC at literal OpenAPI paths; `routes` → handlers only (+ stub root page).
- Never emit `page.tsx` beside `route.ts` on the same segment.
- No forced `/api` prefix on Route Handlers — map OpenAPI paths literally under `app/`.
- `--next-surface` only valid with `--http next`.
- Dynamic/request-time handlers and pages by default (do not emit `force-static` / `use cache` for these scaffolds).
- Reuse Apical wrappers + hexagonal `Authenticator`/`Principal`; no parallel auth schemas.
- Calculation/action separation; TDD with Vitest BDD style; Conventional Commits per task.
- Invoke tooling via `vp` (`vp check`, `vp test`, `vp run -r build`).

## File map (what each new/changed unit owns)

| Path | Responsibility |
| ---- | -------------- |
| `packages/plugin-next/package.json` | Package metadata |
| `packages/plugin-next/README.md` | Package overview; domain-agnostic note |
| `packages/plugin-next/src/model/paths.ts` | OpenAPI path → `route.ts` and `app/ui/.../page.tsx` paths |
| `packages/plugin-next/src/model/derive.ts` | Derive Next HTTP + RSC model from contract + application |
| `packages/plugin-next/src/artifact.ts` | `NextHttpArtifact` / page binding types |
| `packages/plugin-next/src/generate/helpers.ts` | Shared request/auth/response helper source |
| `packages/plugin-next/src/generate/controllers.ts` | Controller wiring to use cases |
| `packages/plugin-next/src/generate/routes.ts` | Emit `app/**/route.ts` |
| `packages/plugin-next/src/generate/server-access.ts` | Emit DAL composition for RSC |
| `packages/plugin-next/src/generate/pages.ts` | Emit `app/layout.tsx`, `app/page.tsx`, `app/ui/**/page.tsx` |
| `packages/plugin-next/src/generate/runtime.ts` | Compose use cases + authenticator for handlers |
| `packages/plugin-next/src/generate/auth-adapter.ts` | In-memory authenticator stub when security present |
| `packages/plugin-next/src/plugin.ts` | `createNextPlugin({ surface })` |
| `packages/plugin-next/src/plugin.test.ts` | Fixtures (Petstore + Library), surfaces, snapshots |
| `packages/plugin-next/src/domain-agnostic.test.ts` | Banned sample-domain literals in plugin production sources |
| `apps/cli/src/command.ts` | Parse `--http hono\|next` and `--next-surface` |
| `apps/cli/src/main.ts` | Select plugin set + packaging + surface |
| `apps/cli/src/packaging-plugin.ts` | Next packaging branch |
| `apps/cli/src/next-generation.test.ts` | Integration: each surface |
| `apps/cli/src/domain-agnostic.test.ts` | Add `packages/plugin-next/src` to scan roots |
| `apps/fixtures/next-api/` | Dogfood fixture + Pactum + UI smoke |
| `RFC.md` / `PRD.md` / `docs/README.md` | Product amendment + links |

---

### Task 1: Scaffold `@hexkit/plugin-next` and domain-agnostic path mapping

**Files:**

- Create: `packages/plugin-next/package.json`
- Create: `packages/plugin-next/tsconfig.json`
- Create: `packages/plugin-next/vite.config.ts`
- Create: `packages/plugin-next/README.md`
- Create: `packages/plugin-next/src/index.ts`
- Create: `packages/plugin-next/src/model/paths.ts`
- Create: `packages/plugin-next/src/model/paths.test.ts`
- Create: `packages/plugin-next/src/domain-agnostic.test.ts`

**Interfaces:**

```ts
export function openApiPathToAppRouteFile(openApiPath: string): string;
// "/pet/{petId}" → "app/pet/[petId]/route.ts"

export function openApiPathToUiPageFile(
  openApiPath: string,
  options: { surface: "rsc" | "both" },
): string;
// surface "both" → "app/ui/pet/[petId]/page.tsx"
// surface "rsc"  → "app/pet/[petId]/page.tsx"

export function openApiPathToAppRouteSegments(openApiPath: string): string[];
```

- [ ] **Step 1: Write failing path-mapping + domain-agnostic tests**

```ts
import { describe, expect, it } from "vite-plus/test";
import { openApiPathToAppRouteFile, openApiPathToUiPageFile } from "./paths.ts";

describe("Given OpenAPI paths", () => {
  it("when mapped for both, then handlers use contract paths and UI uses /ui prefix", () => {
    expect(openApiPathToAppRouteFile("/pet/{petId}")).toBe("app/pet/[petId]/route.ts");
    expect(openApiPathToUiPageFile("/pet/{petId}", { surface: "both" })).toBe(
      "app/ui/pet/[petId]/page.tsx",
    );
  });

  it("when mapped for rsc-only, then pages use contract paths", () => {
    expect(openApiPathToUiPageFile("/pet/{petId}", { surface: "rsc" })).toBe(
      "app/pet/[petId]/page.tsx",
    );
  });
});
```

```ts
// domain-agnostic.test.ts — same banned-literal idea as apps/cli/src/domain-agnostic.test.ts
// Scan packages/plugin-next/src/**/*.ts excluding *.test.ts
```

- [ ] **Step 2: Run focused tests — expect FAIL**

Run: `vp test packages/plugin-next/src/model/paths.test.ts`

- [ ] **Step 3: Scaffold package and implement path helpers**

Mirror `packages/plugin-hono` package shape. `{param}` → `[param]`; no `/api` prefix on handlers; UI under `app/ui/` only for `both`. README must state the domain-agnostic invariant and surface options.

- [ ] **Step 4: Re-run tests and `vp check`**

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-next
git commit -m "feat(plugin-next): scaffold domain-agnostic path mapping for routes and UI"
```

---

### Task 2: Derive Next HTTP + RSC model; emit helpers, controllers, server-access

**Files:**

- Create: `packages/plugin-next/src/artifact.ts`
- Create: `packages/plugin-next/src/model/derive.ts`
- Create: `packages/plugin-next/src/generate/helpers.ts`
- Create: `packages/plugin-next/src/generate/controllers.ts`
- Create: `packages/plugin-next/src/generate/server-access.ts`
- Create: `packages/plugin-next/src/generate/auth-adapter.ts`
- Create: `packages/plugin-next/src/plugin.test.ts`

**Interfaces:**

```ts
export type NextRouteFile = {
  filePath: string;
  openApiPath: string;
  methods: readonly NextMethodBinding[];
};

export type NextUiPage = {
  filePath: string; // app/ui/.../page.tsx OR app/.../page.tsx when surface=rsc
  openApiPath: string;
  operationId: string;
  useCaseAccessorName: string;
  paramNames: readonly string[];
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
};

export type NextSurface = "routes" | "rsc" | "both";

export type NextHttpModel = {
  surface: NextSurface;
  routes: readonly NextRouteFile[]; // empty when surface === "rsc"
  uiPages: readonly NextUiPage[]; // empty when surface === "routes"; GET-only when present
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
  options?: { surface?: NextSurface },
): NextHttpModel;
```

`server-access.ts` generated API (only when surface includes RSC):

```ts
export function getServerAccess(): {
  // one property per operationId, typed to the use-case function
};
```

- [ ] **Step 1: Write failing derive tests**

Assert:

- Same OpenAPI path coalesces methods into one `NextRouteFile` when routes enabled.
- `surface: "both"` → routes + `app/ui/...` pages.
- `surface: "routes"` → routes only; `uiPages` empty; no server-access file planned.
- `surface: "rsc"` → pages at contract paths; `routes` empty.
- Library fixture produces book paths **without** Petstore strings in plugin source.

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement derive + helpers + controllers + server-access + auth stub**

Use `@hexkit/codegen` only (no templates). Auth stub mirrors Hono defaults (`test-token` / `test-key`) as **generic** env-driven defaults — not sample-domain names.

- [ ] **Step 4: Run tests + `vp check`**

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-next
git commit -m "feat(plugin-next): derive model and emit DAL server-access helpers"
```

---

### Task 3: Emit `route.ts`, RSC pages, layout/index, and runtime

**Files:**

- Create: `packages/plugin-next/src/generate/routes.ts`
- Create: `packages/plugin-next/src/generate/pages.ts`
- Create: `packages/plugin-next/src/generate/runtime.ts`
- Create: `packages/plugin-next/src/plugin.ts`
- Modify: `packages/plugin-next/src/index.ts`
- Modify: `packages/plugin-next/src/plugin.test.ts`

**Interfaces:**

```ts
export type NextPluginOptions = {
  surface?: NextSurface; // default "both"
};

export function createNextPlugin(options?: NextPluginOptions): HexkitPlugin;
```

Plugin `generate` must:

- Derive model with `options.surface ?? "both"`.
- Emit route/runtime/controller/helper files only if surface includes routes.
- Emit server-access + resource pages only if surface includes rsc.
- Always emit minimal `app/layout.tsx`; emit stub or index `app/page.tsx` appropriate to surface (`routes` → stub “API only”; `rsc`/`both` → links to pages).

**Route Handler pattern** (operation names from contract at generation time — never hardcoded in plugin source):

```ts
import type { NextRequest } from "next/server";
import { getRuntime } from "../path/to/http-next/runtime";
import { toApicalRequest, handleControllerResult, handleControllerError } from "../path/to/http-next/helpers";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<Record<string, string>> },
) {
  const params = await ctx.params;
  const runtime = getRuntime();
  try {
    const apicalRequest = await toApicalRequest(request, params, { jsonBody: false });
    const result = await runtime.controllers[/* operationId */](apicalRequest);
    return handleControllerResult(result);
  } catch (error) {
    return handleControllerError(error);
  }
}
```

**RSC page pattern** (domain-agnostic scaffold):

```tsx
import { getServerAccess } from "../../../src/adapters/http-next/server-access";

export default async function Page(props: {
  params: Promise<Record<string, string>>;
}) {
  const params = await props.params;
  const access = getServerAccess();
  const result = await access[/* operationId accessor */](/* map params */);

  return (
    <main>
      <h1>{/* operationId or openApiPath from model */}</h1>
      <pre>{JSON.stringify(result, null, 2)}</pre>
    </main>
  );
}
```

Also emit:

- `app/layout.tsx` — minimal `<html><body>{children}</body></html>`
- `app/page.tsx` — links to each `uiPages` path (labels = `operationId` / path from model)
- `app/ui/page.tsx` — same hub optional

Rules:

- No `page.tsx` next to any `route.ts` segment.
- Do not export `dynamic = 'force-static'`.
- Ownership `"generated"` for routes, pages, layout, helpers, runtime.

- [ ] **Step 1: Write failing generation tests**

Use **two** OpenAPI fixtures (Petstore PoC + Library). Assert for `surface: "both"`:

- Handlers exist at contract paths; UI pages under `app/ui/...`.
- Library output contains no Petstore identifiers (and vice versa).
- `server-access` exports accessors used by pages.

Additionally assert:

- `surface: "routes"` → `route.ts` present; no `app/ui/**`; no `server-access.ts`.
- `surface: "rsc"` → pages at contract paths (not under `/ui`); no `route.ts`.
- Plugin production source still passes domain-agnostic scan.

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement generators + `createNextPlugin`**

- [ ] **Step 4: Run plugin tests + `vp check`**

- [ ] **Step 5: Commit**

```bash
git add packages/plugin-next
git commit -m "feat(plugin-next): generate Route Handlers and RSC pages by surface"
```

---

### Task 4: CLI `--http` selection and Next packaging

**Files:**

- Modify: `apps/cli/src/command.ts`
- Modify: `apps/cli/src/command.test.ts`
- Modify: `apps/cli/src/main.ts`
- Modify: `apps/cli/src/packaging-plugin.ts`
- Create: `apps/cli/src/next-generation.test.ts`
- Modify: `apps/cli/src/domain-agnostic.test.ts` — add `packages/plugin-next/src`
- Modify: `apps/cli/package.json` — depend on `@hexkit/plugin-next`

**Interfaces:**

```ts
// hexkit generate <openapi> <output> [--http hono|next] [--next-surface both|routes|rsc]
// default http: hono
// default next-surface when --http next: both
// --next-surface without --http next → error

export function createDefaultPlugins(options?: {
  apical?: ApicalPluginOptions;
  http?: "hono" | "next";
  nextSurface?: NextSurface;
}): readonly HexkitPlugin[];
```

Next packaging emits: `package.json` (`next`, `react`, `react-dom`, drizzle, scripts `dev`/`build`/`start`), `next.config.ts`, App Router `tsconfig`, Dockerfile + Compose (Next + Postgres). No Hono server entry when `--http next`.

- [ ] **Step 1: Write failing CLI / integration tests**

```ts
it("when --http next is passed, then parse selects next adapter with surface both by default", () => {});

it("when --next-surface routes is passed with --http next, then only route handlers are emitted", async () => {});

it("when --next-surface rsc is passed with --http next, then only RSC pages at contract paths are emitted", async () => {});

it("when --next-surface is passed without --http next, then CLI errors", () => {});
```

- [ ] **Step 2: Run tests — expect FAIL**

- [ ] **Step 3: Implement flags + packaging + domain-agnostic root scan update**

Pipeline for next: apical → hexagonal → **next(surface)** → drizzle → packaging(next).

- [ ] **Step 4: Run CLI tests + `vp check`**

- [ ] **Step 5: Commit**

```bash
git add apps/cli packages/plugin-next
git commit -m "feat(cli): add --http next and --next-surface options"
```

---

### Task 5: Next dogfood + Pactum + UI smoke

**Files:**

- Create: `apps/fixtures/next-api/` (OpenAPI may be a thin copy/symlink of library-api; fixture-owned domain only)
- Create: `apps/fixtures/next-api/tests/api.test.ts`
- Create: `apps/fixtures/next-api/tests/ui.smoke.test.ts`
- Create: `apps/fixtures/next-api/scripts/dogfood.sh`
- Modify: root `vite.config.ts` / `package.json` for `dogfood-next`

**Acceptance matrix:**

- Pactum: OpenAPI Route Handler happy paths under default `both` (and auth 401 if auth OpenAPI used).
- UI smoke: `GET /ui/...` for generated unsecured GET pages returns 200 HTML.
- Optional focused generation checks (no full Compose required): `--next-surface routes` and `--next-surface rsc` file sets.
- Confirm RSC page sources import `getServerAccess` and do not `fetch` local handler URLs.

- [ ] **Step 1: Write failing Pactum + UI smoke tests**

Env: `NEXT_API_URL` default `http://127.0.0.1:3000`.

- [ ] **Step 2: Implement dogfood script** (`generate --http next` → install → compose up → tests)

Default dogfood uses surface `both` (omit flag or pass explicitly).

- [ ] **Step 3: Run `vp run dogfood-next` until green**

- [ ] **Step 4: Confirm Hono `vp run dogfood` still green (prefer full)**

- [ ] **Step 5: Commit**

```bash
git add apps/fixtures apps/cli vite.config.ts package.json packages/plugin-next
git commit -m "test: dogfood Next Route Handlers and RSC pages"
```

---

### Task 6: Docs sync (RFC / PRD / README)

**Files:**

- Modify: `RFC.md`
- Modify: `PRD.md` §11
- Modify: `docs/README.md` (already linked; refresh blurb if needed)
- Modify: root `README.md`
- Modify: `packages/plugin-next/README.md`

- [ ] **Step 1: Doc edits**

Must state:

- Hono remains default; Next is opt-in (`--http next`).
- `--next-surface both|routes|rsc` (default `both`) selects generators.
- `plugin-next` is **domain-agnostic** (PRD §5.0).
- OpenAPI → Route Handlers at contract paths when routes enabled.
- RSC pages call use cases via `getServerAccess()` (DAL); path prefix `/ui` only when `both`.
- Server Actions are not the OpenAPI surface.
- `page`/`route` collision avoided by surface-specific path rules.

- [ ] **Step 2: `vp check`**

- [ ] **Step 3: Commit**

```bash
git add RFC.md PRD.md README.md docs packages/plugin-next/README.md
git commit -m "docs: record Next.js Route Handlers and RSC page generation"
```

---

### Task 7: Verification gate

- [ ] **Step 1: `vp check`**
- [ ] **Step 2: `vp run -r test`** (includes plugin-next domain-agnostic + cli domain-agnostic)
- [ ] **Step 3: `vp run -r build`**
- [ ] **Step 4: `vp run dogfood-next`**
- [ ] **Step 5: `vp run dogfood`** (Hono regression)

---

## Self-review checklist (plan author)

1. **Spec coverage:** Domain-agnostic §3 → Global Constraints + Tasks 1/3/4; surfaces §6.0 → Tasks 1–4; Route Handlers → Tasks 2–3; RSC pages + server-access → Tasks 2–3/5; CLI → Task 4; dogfood → Task 5; docs → Task 6.
2. **Placeholders:** None intentional; `NextSurface`, path rules, and CLI flags are concrete.
3. **Type consistency:** `NextSurface`, `createNextPlugin({ surface })`, `--next-surface` stable across tasks.
4. **PoC safety:** Default Hono pipeline preserved.
5. **Next.js fidelity:** No `page`/`route` same-segment conflict for any surface; RSC uses DAL not self-fetch; Server Actions excluded from OpenAPI mapping.
6. **Domain agnosticism:** Explicit tests and scanner coverage for `plugin-next`.
