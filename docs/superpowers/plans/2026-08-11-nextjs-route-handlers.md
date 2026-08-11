# Next.js App Router Route Handlers + RSC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in, **domain-agnostic** `@hexkit/plugin-next` that generates Next.js 16 App Router Route Handlers, basic RSC pages, or **both** (selectable surface), plus a **vanilla PetShop Next.js dogfood app** (create-next-app-shaped; Tailwind; optional CSS Modules; RSC reads; form posts; **no app tests**; installs via **`vp` / pnpm**), while keeping Hono as the default HTTP adapter.

**Architecture:** Reuse apical + hexagonal + drizzle artifacts. When `--http next` is selected, swap `plugin-hono` for `plugin-next` with `surface: "routes" | "rsc" | "both"` (default `both`). Routes emit `app/**/route.ts` at literal OpenAPI paths; RSC emits server-access + generic pages (`app/ui/...` when `both`, contract paths when `rsc`-only). **PetShop UX** lives only in `apps/petstore-next` (fixture), merged onto generated output. Auth/Zod for HTTP match Hono. Packaging uses Next + Postgres; PetShop dogfood does not require a test suite.

**Tech Stack:** TypeScript, Vite+ (`vp`), pnpm, Next.js 16 App Router (`route.ts`, `page.tsx` RSC, create-next-app defaults), Tailwind CSS, optional CSS Modules, Apical Zod wrappers, existing Hexkit plugins.

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
- **PetShop dogfood UI** lives only under `apps/petstore-next` — never in `plugin-next` production source.
- PetShop app is **vanilla create-next-app-shaped**; installs with **`vp install` / pnpm** only.
- PetShop UI: **no client-side data fetching**; reads via RSC + DAL; writes via HTML forms → Server Actions → use cases.
- **No automated tests under `apps/petstore-next`** (no Vitest/Pactum/Playwright for the shop app).
- Dynamic/request-time handlers and pages by default (do not emit `force-static` / `use cache` for these scaffolds).
- Reuse Apical wrappers + hexagonal `Authenticator`/`Principal`; no parallel auth schemas.
- Calculation/action separation; TDD with Vitest BDD style for **plugin/CLI packages only**; Conventional Commits per task.
- Invoke tooling via `vp` (`vp check`, `vp test`, `vp run -r build`) for Hexkit packages; PetShop uses `vp`/`pnpm` + `next`.

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
| `apps/petstore-next/` | Vanilla PetShop Next dogfood app (no tests) |
| `apps/petstore-next/app/**` | RSC pages + forms (create-next-app layout) |
| `apps/fixtures/next-api/` | Optional generic (non-PetShop) surface fixture |
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

`server-access.ts` generated API (**always** emitted for every `NextSurface`, including `routes`):

```ts
export function getServerAccess(): {
  // one property per operationId, typed to the use-case function
};
```

- [ ] **Step 1: Write failing derive tests**

Assert:

- Same OpenAPI path coalesces methods into one `NextRouteFile` when routes enabled.
- `surface: "both"` → routes + `app/ui/...` pages + `server-access`.
- `surface: "routes"` → routes + `server-access`; `uiPages` empty.
- `surface: "rsc"` → pages at contract paths; `routes` empty; `server-access` present.
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
- **Always** emit `server-access.ts` for every surface.
- Emit resource pages (`app/ui/**` or contract-path pages) only if surface includes rsc.
- For standalone generated trees: always emit minimal `app/layout.tsx`; emit stub or index `app/page.tsx` appropriate to surface (`routes` → stub “API only”; `rsc`/`both` → links to pages).
- For PetShop overlay generation (CLI/packaging flag or dogfood script post-process): omit copying root `layout`/`page` into the fixture (see Task 6).

**Route Handler pattern** (operation names from contract at generation time — never hardcoded in plugin source):

```ts
import type { NextRequest } from "next/server";
import { getRuntime } from "@/adapters/http-next/runtime";
import {
  toApicalRequest,
  handleControllerResult,
  handleControllerError,
} from "@/adapters/http-next/helpers";

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

**RSC page pattern** (domain-agnostic scaffold; use `@/` → `./src/*`):

```tsx
import { getServerAccess } from "@/adapters/http-next/server-access";

export default async function Page(props: {
  params: Promise<Record<string, string>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const access = getServerAccess();
  const result = await access[/* operationId accessor */](/* map params + searchParams */);

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

- `surface: "routes"` → `route.ts` + `server-access.ts` present; no `app/ui/**`.
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

it("when --next-surface routes is passed with --http next, then route handlers and server-access are emitted without app/ui scaffolds", async () => {});

it("when --next-surface rsc is passed with --http next, then only RSC pages at contract paths are emitted (plus server-access)", async () => {});

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

### Task 5: Vanilla PetShop Next.js app (fixture-owned, no tests)

**Files:**

- Create: `apps/petstore-next/` via create-next-app with **explicit** flags (not ambient `--yes` prefs):

```bash
pnpm create next-app@latest petstore-next \
  --ts --tailwind --eslint --app --no-src-dir --use-pnpm --import-alias "@/*"
```

Then set `tsconfig` paths so `@/*` → `./src/*` (Hexkit generated tree), keeping `app/` at package root.
- Keep/adjust: `package.json` scripts `dev` / `build` / `start` / `lint` as in [Next.js installation](https://nextjs.org/docs/app/getting-started/installation)
- Create: PetShop pages under `app/pets/**`, `app/orders/**`, root `app/page.tsx` / `app/layout.tsx`
- Create: optional `*.module.css` beside pages for light scoped styles
- Create: `app/**/actions.ts` — `"use server"` form actions calling `getServerAccess()` use cases
- Create: `apps/petstore-next/README.md` — generate-to-TMP merge algorithm + `vp install` + `next dev`
- Reuse: `apps/petstore-sample/openapi.poc.yaml` as generate input
- **Do not create:** `tests/`, Vitest config, Pactum, Playwright, or any PetShop acceptance suite

**UI requirements (normative):**

- Stay as close as possible to create-next-app (vanilla).
- Tailwind from create-next-app; optional CSS Modules only where helpful.
- Installs: **`vp install`** (preferred in this monorepo) or **pnpm** — no npm/yarn as the documented path.
- **No client-side data fetching.**
- Reads: async Server Components → `getServerAccess()` / use cases.
- Writes: `<form action={serverAction}>` only.
- Human UI paths must **not** collide with OpenAPI Route Handlers (`/pets`, `/orders` vs `/pet`, `/store/order`).
- PetShop domain copy is fixture-only; **`plugin-next` stays clean**.
- Import generated DAL as `@/adapters/http-next/server-access` with `@/*` → `./src/*`.

**Illustrative page:**

```tsx
// app/pets/[petId]/page.tsx
import styles from "./page.module.css";
import { getServerAccess } from "@/adapters/http-next/server-access";

export default async function PetDetailPage(props: {
  params: Promise<{ petId: string }>;
}) {
  const { petId } = await props.params;
  const access = getServerAccess();
  const pet = await access.getPetById({ petId: Number(petId) });

  return (
    <main className={`mx-auto max-w-3xl p-6 ${styles.main}`}>
      <h1 className="text-2xl font-semibold">{/* name from pet */}</h1>
      <pre className={styles.payload}>{JSON.stringify(pet, null, 2)}</pre>
    </main>
  );
}
```

- [ ] **Step 1: Scaffold with create-next-app + workspace membership + `@/*` → `./src/*`**

- [ ] **Step 2: Add Pet + Order RSC pages and form Server Actions**

Minimum: home/pet list, pet detail, add/update/delete pet forms, place/get/delete order forms.

- [ ] **Step 3: Confirm `vp install` (or pnpm) and `next dev` starts**

No test files. Manual smoke only.

- [ ] **Step 4: Commit**

```bash
git add apps/petstore-next
git commit -m "feat(petstore-next): add vanilla Next.js PetShop dogfood app"
```

---

### Task 6: PetShop dogfood script (generate → install → run, no tests)

**Files:**

- Create: `apps/petstore-next/scripts/dogfood.sh`
- Modify: root `vite.config.ts` / `package.json` — add `dogfood-petstore-next` task that runs the script
- **Do not create** PetShop API/UI test files

**Dogfood algorithm (normative):**

```bash
# 1) TMP=$(mktemp -d)
# 2) hexkit generate apps/petstore-sample/openapi.poc.yaml "$TMP" \
#       --http next --next-surface routes
# 3) copy "$TMP/src" → apps/petstore-next/src
# 4) copy only "$TMP/app/**/route.ts" (mkdir -p parents) into apps/petstore-next/app
# 5) do NOT copy TMP app/layout.tsx or app/page.tsx
# 6) vp install  # in apps/petstore-next (or workspace root per README)
# 7) apply DB schema if needed; start Postgres (Compose optional)
# 8) next dev  OR  next build && next start
# No Pactum / Vitest / Playwright step
```

- [ ] **Step 1: Write `dogfood.sh` implementing the copy rules above; exit non-zero if generate or install fails**

- [ ] **Step 2: Wire `vp run dogfood-petstore-next`**

- [ ] **Step 3: Run the script once manually; confirm shop UI at `/` and `/pets` and handlers at `/pet` coexist**

- [ ] **Step 4: Confirm Hono `vp run dogfood` still green**

- [ ] **Step 5: Commit**

```bash
git add apps/petstore-next vite.config.ts package.json
git commit -m "chore(petstore-next): add generate-and-run dogfood script"
```

---

### Task 7: Docs sync (RFC / PRD / README)

**Files:**

- Modify: `RFC.md`
- Modify: `PRD.md` §11
- Modify: `docs/README.md`
- Modify: root `README.md`
- Modify: `packages/plugin-next/README.md`
- Modify: `apps/petstore-next/README.md`

- [ ] **Step 1: Doc edits**

Must state:

- Hono remains default; Next is opt-in (`--http next`).
- `--next-surface both|routes|rsc` (default `both`) selects generators.
- `plugin-next` is **domain-agnostic** (PRD §5.0).
- PetShop app is vanilla create-next-app-shaped; **`vp` / pnpm** for installs; Tailwind + optional CSS Modules.
- No client-side data fetching; RSC DAL reads; form Server Actions for writes.
- **No PetShop test suite.**
- OpenAPI → Route Handlers; Server Actions are not the OpenAPI surface.

- [ ] **Step 2: `vp check`** (Hexkit packages)

- [ ] **Step 3: Commit**

```bash
git add RFC.md PRD.md README.md docs packages/plugin-next/README.md apps/petstore-next/README.md
git commit -m "docs: record vanilla PetShop Next.js dogfood and plugin-next surfaces"
```

---

### Task 8: Verification gate

- [ ] **Step 1: `vp check`**
- [ ] **Step 2: `vp run -r test`** (plugin/CLI only — PetShop has no tests)
- [ ] **Step 3: `vp run -r build`**
- [ ] **Step 4: Run `vp run dogfood-petstore-next` (generate + install + start; no test assertion)**
- [ ] **Step 5: `vp run dogfood`** (Hono regression)

---

## Self-review checklist (plan author)

1. **Spec coverage:** Domain-agnostic §3 → Tasks 1/3/4; surfaces §6.0 → Tasks 1–4; vanilla PetShop §6.7 → Tasks 5–6; CLI → Task 4; docs → Task 7.
2. **Placeholders:** None intentional; create-next-app flags, TMP merge copy rules, and `@/*` → `./src/*` are concrete.
3. **Type consistency:** `NextSurface`, `createNextPlugin({ surface })`, `--next-surface`, `getServerAccess` stable across tasks.
4. **PoC safety:** Default Hono pipeline preserved.
5. **Next.js fidelity:** Vanilla App Router; no `page`/`route` collisions; RSC DAL; forms not client fetch.
6. **Domain agnosticism:** PetShop UI only under `apps/petstore-next`; plugin scanner coverage required.
7. **server-access:** Emitted for `routes`, `rsc`, and `both` (pages gated separately).
8. **No PetShop tests:** Tasks 5–6 explicitly omit app test suites.
9. **PetShop merge:** Generate to TMP; copy `src/**` + `app/**/route.ts` only; preserve fixture root UI.