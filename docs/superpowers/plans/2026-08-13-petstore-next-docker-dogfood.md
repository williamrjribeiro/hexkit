# PetShop Next Docker Dogfood Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `vp run dogfood-petstore-next` bring up Next.js + Postgres with `docker compose up --build`, matching Hono `vp run dogfood`, while keeping the vanilla PetShop fixture UI.

**Architecture:** Hexkit already emits `Dockerfile` + `docker-compose.yml` (service `next` + `postgres`) for `--http next`. The dogfood script currently ignores those artifacts and runs host `next start` against a handwritten Postgres-only compose file. Change the script to generate into TMP, overlay fixture-owned UI (and Tailwind build files) onto TMP, merge generated `src/**` + `route.ts` into `apps/petstore-next` for local `next dev`, then `docker compose -f "$TMP/docker-compose.yml" up --build -d --wait` like `apps/petstore-sample/scripts/dogfood.sh`.

**Tech Stack:** Hexkit CLI `--http next --next-surface routes`, generated Next packaging, Docker Compose, `vp` / pnpm, Next.js 16.

## Global Constraints

- Hono `vp run dogfood` remains unchanged and must stay green without Next.
- `plugin-next` stays domain-agnostic — no PetShop Docker literals in plugin production source.
- PetShop UI stays fixture-owned under `apps/petstore-next`; do not copy generated `app/layout.tsx` / `app/page.tsx` over the fixture.
- Overlay TMP with fixture UI **before** Compose build so the image contains `/`, `/pets`, `/orders` plus generated `/pet` and `/store/order` handlers.
- Use the **generated** `Dockerfile` / `docker-compose.yml` / `scripts/start.sh` (migrate then `next start`). Do not keep `docker-compose.petstore-next.yml`.
- `HEXKIT_SKIP_COMPOSE=1` (or missing Docker when skip is `auto`) still exits 0 after generate + overlay + fixture merge + `next build`.
- No PetShop Vitest/Pactum/Playwright suite.
- Invoke Hexkit tooling via `vp`.

## File map

| Path | Responsibility |
| ---- | -------------- |
| `apps/cli/src/next-generation.test.ts` | Assert generated Compose has `next` service, `HOSTNAME`, Postgres, and Dockerfile builds Next |
| `apps/petstore-next/scripts/overlay-fixture.sh` | Copy fixture UI + Tailwind/postcss onto a generated tree without touching `route.ts` |
| `apps/cli/src/petstore-next-overlay.test.ts` | Temp-dir test for overlay copy rules |
| `apps/petstore-next/scripts/dogfood.sh` | Generate → overlay TMP → merge into fixture → Compose up --build (Hono-shaped) |
| `apps/petstore-next/README.md` | Document Compose dogfood |
| `docs/README.md` | Link this plan |

---

### Task 1: Pin generated Next Compose/Dockerfile contract

**Files:**

- Modify: `apps/cli/src/next-generation.test.ts`
- Modify: `apps/cli/src/packaging-plugin.ts` only if tests prove a packaging gap

**Interfaces:**

Generated `--http next` tree must include:

- `Dockerfile` with `pnpm install`, `pnpm build`, `CMD ["./scripts/start.sh"]`
- `docker-compose.yml` services `postgres` and `next`
- `next` service: `HOSTNAME: "0.0.0.0"`, `PORT: "3000"`, `DATABASE_URL` to `postgres:5432`, `ports: ["3000:3000"]`
- `scripts/start.sh` runs `pnpm run migrate` then `exec pnpm start`

- [ ] **Step 1: Extend failing assertions in `next-generation.test.ts`**

In the existing `--next-surface routes` test, after `dockerfile` is loaded, add:

```ts
const compose = generatedFile(result, "docker-compose.yml");
const startScript = generatedFile(result, "scripts/start.sh");

expect(compose).toContain("next:");
expect(compose).toContain('HOSTNAME: "0.0.0.0"');
expect(compose).toContain("postgres:17-alpine");
expect(compose).toContain("3000:3000");
expect(startScript).toContain("pnpm run migrate");
expect(startScript).toContain("exec pnpm start");
```

- [ ] **Step 2: Run `vp test apps/cli/src/next-generation.test.ts` — expect FAIL only if packaging is wrong; otherwise already green**

- [ ] **Step 3: If FAIL, fix `renderNextDockerCompose` / `nextDockerfile` / `nextStartupScript` in `apps/cli/src/packaging-plugin.ts`**

- [ ] **Step 4: Re-run the test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/next-generation.test.ts apps/cli/src/packaging-plugin.ts
git commit -m "test(cli): pin Next packaging Compose and start script"
```

---

### Task 2: Overlay fixture UI onto generated tree

**Files:**

- Create: `apps/petstore-next/scripts/overlay-fixture.sh`
- Create: `apps/cli/src/petstore-next-overlay.test.ts`

**Interfaces:**

```sh
# overlay-fixture.sh GENERATED_DIR FIXTURE_DIR
# Copy fixture-owned UI and Tailwind build files into GENERATED_DIR.
# Never overwrite GENERATED_DIR/app/**/route.ts.
```

Copy from fixture → generated:

- `app/layout.tsx`, `app/page.tsx`, `app/globals.css`
- `app/pets/**`, `app/orders/**` (entire trees; they contain no `route.ts`)
- `postcss.config.mjs`

Merge into generated `package.json` `devDependencies` (build-time, Dockerfile runs full `pnpm install` before `pnpm prune --prod`):

- `tailwindcss`
- `@tailwindcss/postcss`

Do **not** copy fixture `app/pet/**` or `app/store/**`.

- [ ] **Step 1: Write failing overlay test**

```ts
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vite-plus/test";

const overlayScript = new URL(
  "../../petstore-next/scripts/overlay-fixture.sh",
  import.meta.url,
).pathname;

describe("Given a generated Next tree and PetShop fixture", () => {
  it("when overlaid, then fixture UI replaces stubs and generated route.ts stays", () => {
    const root = mkdtempSync(join(tmpdir(), "hexkit-overlay-"));
    const generated = join(root, "generated");
    const fixture = join(root, "fixture");

    mkdirSync(join(generated, "app/pet"), { recursive: true });
    writeFileSync(join(generated, "app/page.tsx"), "export default function Page() { return <p>API only</p>; }\n");
    writeFileSync(join(generated, "app/layout.tsx"), "export default function L({ children }) { return children; }\n");
    writeFileSync(join(generated, "app/pet/route.ts"), "export async function POST() {}\n");
    writeFileSync(
      join(generated, "package.json"),
      JSON.stringify({ name: "generated", devDependencies: { typescript: "7.0.2" } }),
    );

    mkdirSync(join(fixture, "app/pets"), { recursive: true });
    mkdirSync(join(fixture, "app/orders"), { recursive: true });
    writeFileSync(join(fixture, "app/page.tsx"), "export default function Page() { return <h1>Shop</h1>; }\n");
    writeFileSync(join(fixture, "app/layout.tsx"), "export default function L({ children }) { return children; }\n");
    writeFileSync(join(fixture, "app/globals.css"), '@import "tailwindcss";\n');
    writeFileSync(join(fixture, "app/pets/page.tsx"), "export default function Pets() { return <h1>Pets</h1>; }\n");
    writeFileSync(join(fixture, "app/orders/page.tsx"), "export default function Orders() { return <h1>Orders</h1>; }\n");
    writeFileSync(join(fixture, "postcss.config.mjs"), "export default { plugins: { '@tailwindcss/postcss': {} } };\n");
    writeFileSync(
      join(fixture, "package.json"),
      JSON.stringify({
        devDependencies: { tailwindcss: "^4", "@tailwindcss/postcss": "^4" },
      }),
    );

    execFileSync("sh", [overlayScript, generated, fixture], { stdio: "pipe" });

    expect(readFileSync(join(generated, "app/page.tsx"), "utf8")).toContain("Shop");
    expect(readFileSync(join(generated, "app/pets/page.tsx"), "utf8")).toContain("Pets");
    expect(readFileSync(join(generated, "app/pet/route.ts"), "utf8")).toContain("POST");
    expect(readFileSync(join(generated, "postcss.config.mjs"), "utf8")).toContain("tailwindcss/postcss");
    const manifest = JSON.parse(readFileSync(join(generated, "package.json"), "utf8")) as {
      devDependencies: Record<string, string>;
    };
    expect(manifest.devDependencies.tailwindcss).toBe("^4");
    expect(manifest.devDependencies["@tailwindcss/postcss"]).toBe("^4");
    expect(manifest.devDependencies.typescript).toBe("7.0.2");
  });
});
```

- [ ] **Step 2: Run `vp test apps/cli/src/petstore-next-overlay.test.ts` — expect FAIL**

- [ ] **Step 3: Implement `overlay-fixture.sh`**

```sh
#!/bin/sh
set -eu

GENERATED_DIR=$1
FIXTURE_DIR=$2

if [ -z "$GENERATED_DIR" ] || [ -z "$FIXTURE_DIR" ]; then
  printf 'Usage: overlay-fixture.sh GENERATED_DIR FIXTURE_DIR\n' >&2
  exit 2
fi

mkdir -p "$GENERATED_DIR/app"

cp "$FIXTURE_DIR/app/layout.tsx" "$GENERATED_DIR/app/layout.tsx"
cp "$FIXTURE_DIR/app/page.tsx" "$GENERATED_DIR/app/page.tsx"
cp "$FIXTURE_DIR/app/globals.css" "$GENERATED_DIR/app/globals.css"
cp "$FIXTURE_DIR/postcss.config.mjs" "$GENERATED_DIR/postcss.config.mjs"

rm -rf "$GENERATED_DIR/app/pets" "$GENERATED_DIR/app/orders"
cp -R "$FIXTURE_DIR/app/pets" "$GENERATED_DIR/app/pets"
cp -R "$FIXTURE_DIR/app/orders" "$GENERATED_DIR/app/orders"

vp node --input-type=module -e '
import { readFileSync, writeFileSync } from "node:fs";

const generatedPath = process.argv[1];
const fixturePath = process.argv[2];
const generated = JSON.parse(readFileSync(generatedPath, "utf8"));
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const keys = ["tailwindcss", "@tailwindcss/postcss"];

generated.devDependencies ??= {};
for (const key of keys) {
  const value = fixture.devDependencies?.[key];
  if (typeof value === "string") generated.devDependencies[key] = value;
}

writeFileSync(generatedPath, JSON.stringify(generated, null, 2) + "\n");
' "$GENERATED_DIR/package.json" "$FIXTURE_DIR/package.json"
```

Make executable (`chmod +x`).

- [ ] **Step 4: Re-run overlay test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add apps/petstore-next/scripts/overlay-fixture.sh apps/cli/src/petstore-next-overlay.test.ts
git commit -m "feat(petstore-next): overlay fixture UI onto generated Next tree"
```

---

### Task 3: Dogfood script uses generated Compose like Hono

**Files:**

- Modify: `apps/petstore-next/scripts/dogfood.sh`
- Modify: `apps/petstore-next/README.md`
- Modify: `docs/README.md`

**Dogfood algorithm (normative, replaces handwritten postgres-only compose):**

```bash
# 1) TMP=$(mktemp -d)
# 2) hexkit generate ... --http next --next-surface routes  → TMP
# 3) overlay-fixture.sh TMP apps/petstore-next
# 4) copy TMP/src → apps/petstore-next/src
# 5) copy only TMP/app/**/route.ts into apps/petstore-next/app
# 6) vp install (workspace) && vp run petstore-next#build
# 7) if Docker available (and HEXKIT_SKIP_COMPOSE != 1):
#      docker compose -f "$TMP/docker-compose.yml" up --build -d --wait
#      wait for GET / 200, GET /pets 200, POST /pet 2xx
#    else skip compose as today
```

Cleanup must `docker compose -f "$OUTPUT_DIR/docker-compose.yml" down --volumes` (same file as Hono, not `docker-compose.petstore-next.yml`).

Remove `write_postgres_compose`, host `vp run start`, and `NEXT_PID`.

Readiness loop: copy Hono’s 30-attempt `fetch` pattern; smoke `/`, `/pets`, and POST `/pet` as the current script already does.

- [ ] **Step 1: Rewrite `dogfood.sh` to the algorithm above**

Compose invocation (Hono-shaped):

```sh
COMPOSE_FILE="$OUTPUT_DIR/docker-compose.yml"
COMPOSE_STARTED=1
docker compose -f "$COMPOSE_FILE" up --build -d --wait
```

- [ ] **Step 2: Update README generate-to-TMP section: overlay + `docker compose up --build`; keep `HEXKIT_SKIP_COMPOSE`**

- [ ] **Step 3: Link this plan from `docs/README.md`**

- [ ] **Step 4: `vp check` + `vp test apps/cli/src/next-generation.test.ts apps/cli/src/petstore-next-overlay.test.ts`**

- [ ] **Step 5: Run `HEXKIT_SKIP_COMPOSE=1 vp run dogfood-petstore-next` (must pass without Docker)**

- [ ] **Step 6: If `docker info` works, run `vp run dogfood-petstore-next` and confirm `/`, `/pets`, `/pet` on port 3000. If Docker is missing, record DONE_WITH_CONCERNS — do not weaken Hono dogfood.**

- [ ] **Step 7: Commit**

```bash
git add apps/petstore-next/scripts/dogfood.sh apps/petstore-next/README.md docs/README.md docs/superpowers/plans/2026-08-13-petstore-next-docker-dogfood.md
git commit -m "feat(petstore-next): dogfood Next+Postgres via generated Compose"
```

---

## Self-review checklist (plan author)

1. **Spec coverage:** Generated Compose contract → Task 1; fixture overlay without clobbering routes → Task 2; Hono-shaped `up --build` → Task 3.
2. **Placeholders:** None; overlay file list, Compose file path, and smoke URLs are concrete.
3. **Hono parity:** Same `docker compose -f "$OUTPUT_DIR/docker-compose.yml" up --build -d --wait` + readiness fetch + volume cleanup.
4. **PoC safety:** Default Hono pipeline untouched; skip-compose path preserved for Cloud VMs without Docker.
