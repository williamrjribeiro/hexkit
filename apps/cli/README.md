# `@hexkit/cli`

Command-line entry point for Hexkit. Builds to `dist/index.mjs` with the
`hexkit` binary.

## Usage

```bash
hexkit generate <openapi> <output> [--http hono|next] [--next-surface both|routes|rsc]
hexkit --help
```

| Option                                 | Description                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------- |
| `--http hono`                          | Default. Pipeline: apical → hexagonal → hono → drizzle → packaging (Hono + Postgres Compose). |
| `--http next`                          | Swap Hono for `@hexkit/plugin-next`.                                                          |
| `--next-surface both`                  | Default when `--http next`. Route Handlers + RSC pages.                                       |
| `--next-surface routes`                | OpenAPI Route Handlers only.                                                                  |
| `--next-surface rsc`                   | RSC pages + server-access only.                                                               |
| `--next-surface` without `--http next` | CLI error.                                                                                    |

Generation writes a complete application tree to `<output>`: Apical contracts,
hexagonal skeletons (with protected zones), HTTP adapter, Drizzle persistence,
and Docker Compose packaging.

## Pipeline

`createDefaultPlugins()` wires the default plugin order:

1. `@hexkit/plugin-apical` — OpenAPI → Craft → Zod contracts
2. `@hexkit/plugin-architecture-hexagonal` — domain / ports / use cases
3. `@hexkit/plugin-hono` or `@hexkit/plugin-next` — HTTP adapter
4. `@hexkit/plugin-drizzle` — Postgres schema and repository adapters
5. CLI `packaging-plugin` — `package.json`, Compose, Dockerfile (shape depends on HTTP adapter)

`@hexkit/shared` is not in this list: HTTP plugins and hexagonal status/media
lookups import it as a library. Plugin tests share `@hexkit/shared/testing`.

Plugins are domain-agnostic; sample contracts live under `apps/petstore-sample/`
and `apps/fixtures/`.

## Development

From the workspace root:

```bash
vp run @hexkit/cli#build
vp run @hexkit/cli#test
vp run dev   # watch-mode rebuild of this package
```

CLI tests that import `@hexkit/plugin-next` require that package to be built first
(same `dist`-backed export pattern as other workspace packages).

## Dogfood

The CLI is exercised end-to-end by:

- `vp run dogfood` — Hono Rich Pet + Order (`apps/petstore-sample/scripts/dogfood.sh`)
- `vp run dogfood-petstore-next` — Next PetShop (`apps/petstore-next/scripts/dogfood.sh`)
- `vp run dogfood-auth` — auth fixture (`apps/fixtures/auth-api/scripts/dogfood.sh`)

See [README.md](../../README.md) § Project status.
