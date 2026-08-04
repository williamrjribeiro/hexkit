# Hexkit

Hexkit is a contract-driven generator for production-ready TypeScript REST API
applications. Generated projects follow Ports & Adapters and use OpenAPI 3.1,
Apical TS, Zod, Hono, Drizzle ORM, PostgreSQL, AWS Lambda, and SST.

The architectural design is documented in [RFC.md](./RFC.md). PoC product
requirements and acceptance criteria are in [PRD.md](./PRD.md).

## Workspace

- [`apps/cli`](./apps/cli/README.md) — Hexkit command-line application
- [`apps/petstore-sample`](./apps/petstore-sample/README.md) — canonical generation and deployment sample
- [`packages/core`](./packages/core/README.md) — generation orchestration
- [`packages/codegen`](./packages/codegen/README.md) — shared source generation utilities
- [`packages/plugin-api`](./packages/plugin-api/README.md) — plugin contracts and lifecycle
- [`packages/plugin-apical`](./packages/plugin-apical/README.md) — Apical TS contract generation
- [`packages/plugin-architecture-hexagonal`](./packages/plugin-architecture-hexagonal/README.md) — hexagonal architecture generation
- [`packages/plugin-hono`](./packages/plugin-hono/README.md) — Hono HTTP adapter generation
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
