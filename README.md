# Hexkit

Hexkit is a contract-driven generator for production-ready TypeScript REST API
applications. Generated projects follow Ports & Adapters and use OpenAPI 3.1,
Apical TS, Zod, Hono, Drizzle ORM, PostgreSQL, AWS Lambda, and SST.

The architectural design is documented in [RFC.md](./RFC.md). PoC product
requirements and acceptance criteria are in [PRD.md](./PRD.md).

## Project status

**Stage:** PoC implementation is substantially complete; local dogfood is the
primary validation gate before PoC sign-off.

| Area                                                    | Status                                                            |
| ------------------------------------------------------- | ----------------------------------------------------------------- |
| `@hexkit/core`, `@hexkit/codegen`, `@hexkit/plugin-api` | Implemented — pipeline, file writer, plugin contracts             |
| `@hexkit/plugin-apical`                                 | Implemented — Craft → Zod contracts + manifest                    |
| `@hexkit/plugin-architecture-hexagonal`                 | Implemented — domain, ports, use-case skeletons                   |
| `@hexkit/plugin-hono`                                   | Implemented — default HTTP adapter                                |
| `@hexkit/plugin-next`                                   | Implemented — opt-in Next.js Route Handlers + RSC (`--http next`) |
| `@hexkit/plugin-drizzle`                                | Implemented — Postgres schema, repos, DB-read validation          |
| `@hexkit/cli`                                           | Implemented — `hexkit generate` with Hono/Next selection          |
| Docker Compose packaging                                | Implemented — emitted by CLI for Hono and Next                    |
| `@hexkit/plugin-sst`                                    | Scaffold only (`export {}`) — deferred post-PoC                   |
| AWS Lambda / SST deploy                                 | Not in PoC scope                                                  |
| GitHub Actions CI                                       | Not yet — local dogfood only for PoC                              |

**Automated tests:** ~100+ Vitest cases across plugins, CLI, and dogfood packages
(`vp run -r build` then `vp run -r test`). `apps/petstore-next` has no app test
suite by design (`@hexkit/plugin-next` and CLI tests cover the generator).

**Dogfood loops** (Docker required unless noted):

| Command                        | What it proves                                                  |
| ------------------------------ | --------------------------------------------------------------- |
| `vp run dogfood`               | Hono Pet + Order from `openapi.poc.yaml` → Compose → Pactum     |
| `vp run dogfood-petstore-next` | Next PetShop fixture; `HEXKIT_SKIP_COMPOSE=1` for generate-only |
| `vp run dogfood-auth`          | Auth fixture with in-memory stub authenticator                  |

**Remaining PoC work:** domain-agnostic invariant audit across generators (PRD
§11.1), ongoing dogfood hardening, GitHub Actions for PR validation.

## Workspace

- [`apps/cli`](./apps/cli/README.md) — Hexkit command-line application
- [`apps/petstore-sample`](./apps/petstore-sample/README.md) — canonical generation and deployment sample
- [`apps/petstore-next`](./apps/petstore-next/README.md) — vanilla Next.js PetShop dogfood fixture (opt-in `--http next`)
- [`packages/core`](./packages/core/README.md) — generation orchestration
- [`packages/codegen`](./packages/codegen/README.md) — shared source generation utilities
- [`packages/plugin-api`](./packages/plugin-api/README.md) — plugin contracts and lifecycle
- [`packages/plugin-apical`](./packages/plugin-apical/README.md) — Apical TS contract generation
- [`packages/plugin-architecture-hexagonal`](./packages/plugin-architecture-hexagonal/README.md) — hexagonal architecture generation
- [`packages/plugin-hono`](./packages/plugin-hono/README.md) — Hono HTTP adapter generation (default)
- [`packages/plugin-next`](./packages/plugin-next/README.md) — Next.js App Router adapter generation (opt-in)
- [`packages/plugin-drizzle`](./packages/plugin-drizzle/README.md) — Drizzle persistence adapter generation
- [`packages/plugin-sst`](./packages/plugin-sst/README.md) — SST infrastructure generation
- [`docs`](./docs/README.md) — project documentation

## Development

Install dependencies:

```bash
vp install
```

Run all checks, tests, and builds:

```bash
vp run ready
```

Run an individual stage:

```bash
vp run -r build
vp check
vp run -r test
```

Start the CLI package in watch mode:

```bash
vp run dev
```

## Petstore dogfood

Run the uncached root dogfood task from the workspace root:

```bash
vp run dogfood
```

The task passes through `PETSTORE_API_URL`, `HEXKIT_KEEP_STACK`, and
`HEXKIT_DOGFOOD_OUTPUT`. Docker is required for the live Compose and API phases.
`apps/petstore-sample/scripts/prove-api-url.sh` verifies task-level environment
propagation without starting Compose.

## Auth API dogfood

Run the auth fixture Compose + Pactum acceptance loop (in-memory stub auth):

```bash
vp run dogfood-auth
```

Uses `apps/fixtures/auth-api/openapi.yaml`. Passes through `AUTH_API_URL`,
`HEXKIT_KEEP_STACK`, and `HEXKIT_DOGFOOD_OUTPUT`.

## Next.js PetShop dogfood

Hono remains the default HTTP adapter. Opt in to Next.js with `--http next` and
`--next-surface both|routes|rsc` (default `both`). OpenAPI maps to Route
Handlers; Server Actions are fixture UI only, not the OpenAPI surface.

Generate, merge, and start the vanilla create-next-app-shaped fixture:

```bash
vp run dogfood-petstore-next
```

Or manually:

```bash
hexkit generate apps/petstore-sample/openapi.poc.yaml /tmp/petstore-next \
  --http next --next-surface routes
```

See [`apps/petstore-next/README.md`](./apps/petstore-next/README.md) for the
generate-to-TMP merge algorithm. The PetShop app has no automated test suite;
`@hexkit/plugin-next` stays domain-agnostic (PRD §5.0).
