# PRD: Hexkit PoC

Status: Draft  
Companion: [RFC.md](./RFC.md)

## 1. Overview & relationship to RFC

Hexkit is a contract-driven code generator that produces production-ready TypeScript REST API applications from OpenAPI specifications. Generated projects follow Ports & Adapters (Hexagonal Architecture) and use OpenAPI 3.1, Apical TS, Zod, Hono, Drizzle ORM, and PostgreSQL.

This PRD is the **master product requirements document for the Hexkit proof of concept (PoC)**. It turns [RFC.md](./RFC.md) into concrete, testable requirements that an implementation plan can execute.

| Document | Owns                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RFC.md` | Architectural north star: stack, hexagonal rules, plugin layout, no-templates generation strategy                                                      |
| `PRD.md` | PoC scope, acceptance criteria, extension/regeneration rules, packaging, testing strategy, milestones, and explicit cuts from the full RFC success bar |

Where this PRD and the RFC disagree on PoC scope, **this PRD wins for PoC implementation**. The RFC remains the longer-term architectural target.

## 2. Goals

### Primary goals (PoC)

1. Generate a complete TypeScript application from a trimmed Petstore OpenAPI contract.
2. Enforce Hexagonal Architecture in generated output.
3. Use OpenAPI as the single source of truth via Apical TS (Zod schemas + operations).
4. Persist Pet and Order data through Drizzle ORM against PostgreSQL, with a real Pet↔Order relation.
5. Validate HTTP and database-read boundaries with Apical-generated Zod schemas.
6. Provide clear extension points so hand-written business logic survives regeneration.
7. Keep Hexkit source quality and generated-app quality in sync (same formatter, linter, TypeScript settings).
8. Prove the loop locally: generate → validate source → run via Docker Compose → pass API tests.

### Non-goals (PoC)

- Live AWS deploy or SST synthesis (`plugin-sst` is **out of PoC**).
- OAuth, API keys, or any auth mechanism.
- XML (or non-JSON) request/response media types.
- Users resource and the full Swagger Petstore surface area.
- GraphQL, gRPC, AsyncAPI.
- Multiple languages, web frameworks, ORMs, or databases.
- A general-purpose code-generation framework.
- CI / GitHub Actions PR validation (local dogfood only for PoC; CI is a follow-up).

## 3. PoC scope

### 3.1 Contract slice

- Keep `apps/petstore-sample/openapi.yaml` **untouched** (checked-in Swagger Petstore 3.1 reference; currently Pet-focused and must not be edited for PoC work).
- Add a trimmed contract used for generation and dogfooding: `apps/petstore-sample/openapi.poc.yaml`.
- Author `openapi.poc.yaml` as a **Swagger Petstore 3.1 subset** for Pet + Order. It is not required to be a mechanical cut of the checked-in file (that file does not include Order today). Prefer standard Petstore path shapes so the sample stays recognizable.

Trimmed contract rules:

| Rule         | Requirement                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| Resources    | **Pet** and **Order** only; Order references `petId`                                                   |
| Media types  | **JSON only** — no XML (or other non-JSON) content                                                     |
| Security     | **None** — no security schemes or per-operation requirements                                           |
| Schemas      | Only components required by selected operations (e.g. Pet, Order, and nested types those schemas need) |
| Completeness | Every operation in `openapi.poc.yaml` must be generated and work with DB persistence                   |

**Baseline operations (normative for PoC unless superseded by an explicit PRD amendment):**

| Resource | operationId    | Method / path (Petstore-shaped) |
| -------- | -------------- | ------------------------------- |
| Pet      | `addPet`       | `POST /pet`                     |
| Pet      | `updatePet`    | `PUT /pet`                      |
| Pet      | `getPetById`   | `GET /pet/{petId}`              |
| Pet      | `deletePet`    | `DELETE /pet/{petId}`           |
| Order    | `placeOrder`   | `POST /store/order`             |
| Order    | `getOrderById` | `GET /store/order/{orderId}`    |
| Order    | `deleteOrder`  | `DELETE /store/order/{orderId}` |

Out of slice: Users, `GET /store/inventory`, pet image upload, form updates, find-by-status/tags (unless later added to `openapi.poc.yaml`), webhooks, OAuth scopes, XML.

### 3.2 Quality invariant

Hexkit packages and the **generated** Petstore application must use the **same** formatter, linter, and TypeScript toolchain/settings (Vite+ / Oxfmt / Oxlint / project TS config as established in the monorepo).

Both must pass format + lint + typecheck as part of the local dogfood workflow. This keeps style and quality of generator source and generated output in sync.

### 3.3 Runtime packaging

Hexkit generation must **emit** Docker Compose packaging for the Petstore sample (not a hand-maintained substitute for the generated app). Compose must run at least:

- The Hono HTTP application
- PostgreSQL

Compose is the supported local runtime for end-to-end API testing. Schema application via generated Drizzle artifacts should be automated in the Compose/app startup path where practical.

### 3.4 Explicitly excluded packages / capabilities

- `@hexkit/plugin-sst` — deferred beyond PoC
- Live AWS Lambda / API Gateway deployment

## 4. Users & primary use case

**Primary user:** a Hexkit developer (and later, API developers) working in this monorepo.

**Primary use case:**

1. Author or update `openapi.poc.yaml`.
2. Run the Hexkit CLI to generate the Petstore sample application.
3. Validate generated source (format, lint, typecheck).
4. Start the app with Docker Compose.
5. Run Vitest + PactumJS API tests against the running service.
6. Edit protected use-case files for business logic; re-run generation without losing those edits.

## 5. Architecture & package requirements

Architectural principles remain those in the RFC: contract-first, boundary validation with Apical Zod schemas, hexagonal ports & adapters, and **no template engines** (generators are TypeScript functions).

### 5.0 Plugin domain-agnostic invariant (normative)

**Petstore is a dogfood fixture, not a generator domain.** Hexkit plugins must work for any OpenAPI 3.1 contract in PoC scope. Sample-specific knowledge (Pet, Order, `petId`, Petstore paths, operationIds, table names, Compose service names, etc.) belongs **only** in:

- `apps/petstore-sample/` — OpenAPI fixtures, acceptance tests, dogfood scripts
- `apps/petstore-next/` — vanilla Next.js PetShop fixture UI (not plugin source)
- PoC **acceptance criteria** that describe the expected sample outcome

It must **not** be hardcoded inside `@hexkit/plugin-*`, `@hexkit/core`, `@hexkit/codegen`, or CLI packaging generators.

| Layer                                   | May know Petstore? | How domain knowledge enters                                                                                                       |
| --------------------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/petstore-sample`                  | **Yes**            | Authored OpenAPI + tests against generated output                                                                                 |
| `@hexkit/plugin-apical`                 | **No**             | Runs craft against `context.inputPath`                                                                                            |
| `@hexkit/plugin-architecture-hexagonal` | **No**             | Derives domain, ports, and use-case skeletons from Apical contracts / OpenAPI IR                                                  |
| `@hexkit/plugin-hono`                   | **No**             | Derives routes/controllers from Apical operations                                                                                 |
| `@hexkit/plugin-next`                   | **No**             | Derives Route Handlers, RSC pages, and server-access from Apical operations (opt-in via `--http next`)                            |
| `@hexkit/plugin-drizzle`                | **No**             | Derives schemas/repos/mappers from contracts + hexagonal ports                                                                    |
| Packaging / Compose emission            | **No**             | Generic deployable packaging from generation context (names/paths from options or contract metadata, not baked Petstore literals) |

**Rules:**

1. Generators consume OpenAPI and/or Apical-generated artifacts available in the generation context; they do not embed sample schemas or operation lists in source.
2. Plugin unit tests **may** feed Petstore (or other) OpenAPI fixtures as **inputs** and snapshot **outputs**. Tests must not be satisfied by hardcoding those fixtures into the plugin implementation.
3. Changing `openapi.poc.yaml` (adding/renaming schemas or operations) must change generated output **without** editing plugin source for that sample domain.
4. A PoC that only greens against Petstore via hardcoded Pet/Order generators is **incomplete**, even if dogfood passes.

**Known deviation:** The current PoC generators still embed Petstore-shaped domain/adapters. That is **implementation debt**, not allowed product behavior. Fix generators to obey this invariant before treating the hexagonal/HTTP/persistence milestones as done.

### 5.1 Package requirements (PoC)

| Package                                 | PoC must deliver                                                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `@hexkit/plugin-api`                    | Plugin interfaces, metadata, generation context contracts                                                                                      |
| `@hexkit/codegen`                       | Source builders, import management, file abstractions, formatting helpers aligned with workspace formatter                                     |
| `@hexkit/core`                          | Load plugins, execute ordered pipeline, manage output files, enforce protected-zone policy                                                     |
| `@hexkit/plugin-apical`                 | Run Apical craft; emit contracts/Zod/operations under `src/generated/contracts/`                                                               |
| `@hexkit/plugin-architecture-hexagonal` | **Contract-derived** domain entities, repository ports, use-case skeletons; designate protected user zones                                     |
| `@hexkit/plugin-hono`                   | **Contract-derived** JSON HTTP adapters: routes, controllers, middleware wiring to Apical operations (default)                                 |
| `@hexkit/plugin-next`                   | **Contract-derived** Next.js Route Handlers + optional RSC surface; OpenAPI → Route Handlers only (Server Actions are fixture/UI, not OpenAPI) |
| `@hexkit/plugin-drizzle`                | **Contract-derived** Postgres schemas, repository implementations, mappings; Zod-validate DB reads                                             |
| `@hexkit/cli`                           | CLI entry (`generate`, help) driving the pipeline (OpenAPI path + output directory)                                                            |
| `@hexkit/petstore-sample`               | Trimmed OpenAPI, fully generated app output, Compose packaging, API tests                                                                      |

`@hexkit/plugin-sst` is present in the repo scaffold but is **not a PoC deliverable**.

### 5.2 Generation pipeline (PoC)

```
openapi.poc.yaml
  → plugin-apical
  → plugin-architecture-hexagonal
  → plugin-hono  ∥  plugin-next (when --http next)  ∥  plugin-drizzle
  → generated application (+ Compose packaging)
```

Hono remains the default HTTP adapter. `--http next` swaps `plugin-hono` for `plugin-next`. `--next-surface both|routes|rsc` (default `both`) selects emitted Next surfaces.

`core` must not contain framework-specific logic. Plugins communicate through `plugin-api` contracts and shared generation context. Downstream plugins (hexagonal → hono/drizzle) must read **generated contracts and prior plugin outputs**, not a Petstore-specific constant table in Hexkit source.

### 5.3 Generated application structure

```
src/
├── generated/
│   └── contracts/
├── core/
│   ├── domain/
│   ├── application/    # protected user zones (use cases)
│   └── ports/
├── adapters/
│   ├── http/           # Hono
│   └── db/             # Drizzle
└── runtime/
```

Exact filenames may vary; ownership rules in §6 are normative.

## 6. Extension & regeneration rules

### 6.1 File ownership

| Zone                                       | Typical paths                                                                                                | On re-generate                                                                          |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Always generated                           | `src/generated/contracts/**`                                                                                 | Overwrite                                                                               |
| Generated adapters / regenerable skeletons | `src/adapters/**`, ports, domain scaffolds as emitted by plugins                                             | Overwrite                                                                               |
| Protected user zones                       | Use-case / business-logic files under `src/core/application/**` (and any other paths `core` marks protected) | **Never overwrite** if the file already exists                                          |
| Shared quality config                      | Formatter / linter / TS settings emitted for the generated app                                               | Prefer overwrite of generated config; do not silently destroy documented user overrides |

### 6.2 First generate vs later generate

- **First generate:** write skeletons into protected zones so the app compiles and all OpenAPI operations can run (default use-case bodies that call ports).
- **Later generate:** refresh contracts, adapters, and regenerable skeletons; leave existing protected use-case files untouched.
- **New operations:** may add **new** protected skeleton files that do not yet exist.

### 6.3 Protected-zone collisions

Protected-path policy lives in generation context (centralized in `core`, not ad-hoc per plugin).

PoC default when a plugin would write an existing protected file:

- **Skip the write**
- **Log** the skipped path
- Continue the pipeline

Do not silently overwrite protected files.

## 7. Runtime & packaging

- Hexkit emits Docker Compose (and related container) artifacts as part of generating the Petstore sample so `docker compose up` brings up Hono + PostgreSQL.
- Schema/migrations from generated Drizzle artifacts apply as part of stack startup (automated entrypoint preferred).
- All operations in `openapi.poc.yaml` persist through Drizzle to Postgres (no in-memory fakes on the dogfood path).
- Packaging may live in CLI/sample generation output rather than `plugin-sst`; it must not reintroduce SST.

## 8. Testing strategy

All tests run **locally** for the PoC. CI / GitHub Actions are explicitly deferred.

### 8.1 Unit tests

Vitest (via Vite+) for individual Hexkit packages in isolation. Prefer pure calculations with injectable edges at I/O boundaries (pattern already used in `@hexkit/plugin-apical`).

### 8.2 Integration tests

Vitest tests for packages with real dependencies (e.g. `core` loading plugins, apical invoking craft with controlled fixtures).

### 8.3 End-to-end generation & packaging

1. Run Hexkit against `openapi.poc.yaml`.
2. Validate generated source: format + lint + typecheck (same tooling/settings as Hexkit).
3. Build and package the generated Petstore app with Docker Compose (Hono + Postgres).

### 8.4 API acceptance tests

- Run against the Compose-running app.
- Implemented with **Vitest + [PactumJS](https://www.npmjs.com/package/pactum)**.
- Must cover **every operation** in the trimmed OpenAPI, including Pet↔Order relation/persistence behavior.

### 8.5 Failure behavior

| Condition                       | Behavior                                   |
| ------------------------------- | ------------------------------------------ |
| Invalid or missing OpenAPI path | Non-zero CLI exit + clear message          |
| Apical craft failure            | Surface craft stderr/stdout; fail pipeline |
| Protected-zone collision        | Skip write + log; continue                 |
| Any dogfood / E2E stage failure | Fail the overall local verification script |

## 9. Acceptance criteria

The Hexkit PoC is complete when all of the following are true:

1. **Full generation:** The Petstore sample application is fully produced by Hexkit from `openapi.poc.yaml` (no hand-maintained substitute for generated adapters/contracts).
2. **Contract fidelity:** Every feature/operation in the trimmed OpenAPI works with DB persistence.
3. **Domain-agnostic generators:** Hexkit plugins contain no Petstore-specific hardcoded domain/adapters (§5.0). Petstore appears only as OpenAPI input and sample tests; regenerating after a non-Petstore (or altered) contract of comparable shape does not require editing plugin source.
4. **Build quality:** Generated source passes the same format, lint, and TypeScript checks as Hexkit source.
5. **Boundaries:** Requests, responses, and DB reads are validated with Apical-generated Zod schemas before crossing into the application layer.
6. **Relation:** For the Petstore dogfood contract, Pet and Order persist in PostgreSQL with correct relational behavior (`petId` / FK-style integrity as defined by that contract and the derived schema).
7. **Extension:** Re-running generation does not overwrite existing protected use-case files; new missing protected skeletons may still be added.
8. **Local dogfood:** Developers can locally run unit tests, package integration tests, Compose-based E2E bring-up, and Vitest+PactumJS API tests successfully.
9. **No SST/auth/XML/Users** required for the green bar.

## 10. Milestones

Ordered delivery milestones for implementation planning:

1. **Foundation** — `plugin-api`, `codegen`, `core` lifecycle, protected-zone policy, CLI `generate` wiring.
2. **Contracts** — `plugin-apical` end-to-end; author `openapi.poc.yaml` (Pet↔Order dogfood fixture, JSON only, no auth).
3. **Hexagonal skeleton** — `plugin-architecture-hexagonal` derives domain/ports/use-case skeletons + protected zones **from Apical contracts** (prove with Petstore fixture; no hardcoded Pet/Order in the plugin).
4. **HTTP adapter** — `plugin-hono` derives JSON routes/controllers from Apical operations (default; fixture-driven tests only). Opt-in `plugin-next` emits OpenAPI Route Handlers and/or RSC pages (`--http next`, `--next-surface both|routes|rsc`).
5. **Persistence** — `plugin-drizzle` derives Postgres schema, repos, and Zod DB-read validation from contracts/ports (Pet↔Order appears in the dogfood contract, not in plugin literals).
6. **Packaging** — Docker Compose for Hono + Postgres emitted generically for the generated app (sample dogfood uses the Petstore fixture).
7. **Test suite** — package unit tests, cross-package integration tests, Vitest+PactumJS API tests against Compose.
8. **Dogfood green** — regenerate → validate source → Compose up → API tests pass; protected use cases survive re-generation.

Deferred after PoC: `plugin-sst`, live AWS deploy, auth, full Petstore surface, GitHub Actions CI.

## 11. Follow-ups (explicitly out of PoC)

- SST / AWS Lambda generation and deploy verification.
- Authentication (post-PoC): see `docs/superpowers/specs/2026-08-05-openapi-auth-design.md` and `docs/superpowers/plans/2026-08-05-openapi-auth.md`. v1 = OpenAPI `apiKey` (header) + HTTP bearer → Apical header validation + hexagonal `Authenticator`/`Principal`; implemented in generator plugins, but remains post-PoC for the auth-free `openapi.poc.yaml` dogfood fixture. Deferred: OAuth/OIDC flows, mutualTLS, scope-based 403, `plugin-auth` extraction, SST authorizers.
- Expanding `openapi.poc.yaml` toward full Petstore (Users, XML, uploads, etc.).
- GitHub Actions for PR validation of the dogfood gate.
- Hardening protected-zone policy (e.g. `--strict-protected` fail mode).
- Automated tests for `apps/petstore-next` (the vanilla PetShop Next fixture has no Vitest/Pactum/Playwright suite; `plugin-next` and CLI tests cover the generator).

### 11.1 In-PoC correction (blocking)

- Remove Petstore hardcoding from hexagonal, Hono, Drizzle, and packaging generators so §5.0 holds; keep Petstore exclusively as sample OpenAPI + dogfood tests.

### 11.2 Next.js opt-in HTTP adapter (delivered alongside PoC)

Delivered as an extension to the Hono-first PoC (see `docs/superpowers/specs/2026-08-11-nextjs-route-handlers-design.md`):

- **Hono remains default**; Next is opt-in: `hexkit generate <openapi> <out> [--http hono|next]`.
- **`--next-surface both|routes|rsc`** (default `both`) selects Route Handlers, RSC pages, or both.
- **`@hexkit/plugin-next` is domain-agnostic** (§5.0): derives handlers and RSC wiring from Apical contracts; no Petstore literals in plugin production source.
- **OpenAPI → Route Handlers** at literal contract paths; Server Actions are not the OpenAPI HTTP surface (PetShop forms live in the fixture only).
- **`apps/petstore-next`** — vanilla create-next-app-shaped App Router fixture; installs via **`vp` / pnpm**; Tailwind + optional CSS Modules; RSC reads via generated server-access; form Server Actions for writes; **no client-side data fetching**; **no PetShop test suite**.

## 12. Decisions log

| Decision               | Choice                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------ |
| PoC success bar        | Local generate + validate + Compose + API tests; no live AWS                               |
| Contract               | Trimmed `openapi.poc.yaml` (Petstore 3.1 Pet+Order subset); original YAML untouched        |
| Baseline operations    | add/update/get/delete Pet; place/get/delete Order (**sample fixture**, not plugin IR)      |
| Media types            | JSON only                                                                                  |
| Auth                   | None                                                                                       |
| Extension model        | Generated skeletons + protected user zones                                                 |
| Generator domain       | Plugins are domain-agnostic; derive all sample domain from OpenAPI/Apical (§5.0)           |
| PRD shape              | Single master `PRD.md` at repo root                                                        |
| Infra plugin           | Exclude `plugin-sst` from PoC                                                              |
| HTTP adapter (default) | Hono via `plugin-hono`                                                                     |
| HTTP adapter (opt-in)  | Next.js App Router via `plugin-next` (`--http next`, `--next-surface both / routes / rsc`) |
| Packaging              | Hexkit emits Docker Compose (Hono + Postgres)                                              |
| API test stack         | Vitest + PactumJS against Docker Compose                                                   |
| CI                     | Local only for PoC                                                                         |
