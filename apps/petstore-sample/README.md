# `@hexkit/petstore-sample`

Canonical Hexkit dogfooding project. It owns the PoC OpenAPI contract and the
tests that prove Hexkit can generate a real Pet + Order app, typecheck it, run
it under Docker Compose, and pass HTTP acceptance checks.

This package is **not** the generated application. Generated source is written
to a temporary (or caller-chosen) directory by the CLI during dogfood.

## What’s in this package

| Path                       | Role                                                                      |
| -------------------------- | ------------------------------------------------------------------------- |
| `openapi.yaml`             | Checked-in Swagger Petstore 3.1 reference (leave untouched for PoC)       |
| `openapi.poc.yaml`         | Trimmed Pet + Order contract used for generation and dogfood              |
| `tests/generation.test.ts` | Asserts the CLI emits the expected generated tree from `openapi.poc.yaml` |
| `tests/api.test.ts`        | Pactum acceptance tests against a **running** generated API               |
| `tests/api-fixtures*.ts`   | Shared IDs/helpers for acceptance tests                                   |
| `scripts/dogfood.sh`       | End-to-end generate → Compose → API acceptance loop                       |

## What “dogfood” means

Dogfood means Hexkit eats its own cooking: the real `@hexkit/cli` generates an
app from `openapi.poc.yaml`, the generated app is installed and typechecked,
Docker Compose brings up Hono + Postgres, and `tests/api.test.ts` hits the live
HTTP API.

That is the PoC success bar (generate → validate → run → accept). Package unit
tests alone do not prove the generated app works at runtime.

### Run dogfood (from the workspace root)

Preferred entry (uncached root Vite+ task → `scripts/dogfood.sh`):

```bash
vp run dogfood
```

If the nested `vp` task misbehaves, run the script directly from the repo root:

```bash
apps/petstore-sample/scripts/dogfood.sh
```

**What the script does, in order:**

1. Runs this package’s `test:generation` checks
2. Builds `@hexkit/cli`
3. Generates into a temp dir (or `HEXKIT_DOGFOOD_OUTPUT`)
4. Installs and typechecks the **generated** app
5. Starts Docker Compose for that app
6. Waits until the API responds
7. Runs `tests/api.test.ts` against it
8. Tears down Compose (and deletes the temp dir) unless you keep the stack

Docker is required for steps 5–7.

### Dogfood environment

| Variable                | Purpose                                                           |
| ----------------------- | ----------------------------------------------------------------- |
| `PETSTORE_API_URL`      | Base URL for readiness + Pactum (default `http://127.0.0.1:3000`) |
| `HEXKIT_DOGFOOD_OUTPUT` | Fixed generation directory (handy for inspecting generated code)  |
| `HEXKIT_KEEP_STACK=1`   | Keep Compose and the output directory after the script exits      |

Example — generate into a browsable folder and leave Compose running:

```bash
HEXKIT_DOGFOOD_OUTPUT=/tmp/hexkit-petstore-poc \
HEXKIT_KEEP_STACK=1 \
apps/petstore-sample/scripts/dogfood.sh
```

## Package scripts (`vp run` from this package)

Run from `apps/petstore-sample`, or as `vp run @hexkit/petstore-sample#<script>`
from the workspace root.

| Script            | What it does                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| `check`           | Format, lint, and typecheck this package’s own sources                                              |
| `build`           | Pack this package’s stub entry to `dist/` (`vp pack`)                                               |
| `dev`             | Watch-mode pack for this package                                                                    |
| `test`            | Offline sample tests: generation expectations and API fixture helpers — **does not** hit a live API |
| `test:generation` | Only `tests/generation.test.ts` (CLI output paths / protected-file behavior)                        |

There is **no** `test:api` package script on purpose. Acceptance tests need a
running stack and are invoked by dogfood (or manually — see below).

## API acceptance tests (against Docker)

With Compose already up (for example after dogfood with `HEXKIT_KEEP_STACK=1`):

```bash
cd apps/petstore-sample
PETSTORE_API_URL=http://127.0.0.1:3000 vp test run tests/api.test.ts
```

`PETSTORE_API_URL` defaults to `http://127.0.0.1:3000` if unset.

## Related workspace commands

| Command                                         | Role                                                                 |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| `vp run ready`                                  | Build + check + test the Hexkit monorepo (not the live Compose loop) |
| `vp run dogfood`                                | Full Petstore generate/run/accept loop described above               |
| `apps/petstore-sample/scripts/prove-api-url.sh` | Checks that dogfood task env propagation works (no Compose)          |
