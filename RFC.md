RFC: Hexkit — Contract-Driven REST API Application Generator
Status

Draft (PoC implementation substantially complete — see [README.md](./README.md) § Project status)

Implementation snapshot (August 2026)

- `@hexkit/cli` generates compose-ready Hono or Next.js applications from OpenAPI 3.1.
- Plugins implemented: apical, architecture-hexagonal, hono, next (opt-in), drizzle.
- `@hexkit/plugin-sst` remains scaffold-only; AWS/SST deploy deferred post-PoC.
- Dogfood: Hono Petstore (`vp run dogfood`), Next PetShop (`vp run dogfood-petstore-next`), auth fixture (`vp run dogfood-auth`).

Authors

Engineering Team

Summary

Hexkit is a contract-driven code generator that produces production-ready TypeScript REST API applications from OpenAPI specifications.

Hexkit focuses on generating complete applications rather than API stubs. Generated projects follow the Ports & Adapters (Hexagonal Architecture) pattern and integrate with modern TypeScript tooling:

OpenAPI 3.1
Apical TS
Hono (default HTTP adapter; Next.js App Router is opt-in via `--http next`)
Zod v4
Drizzle ORM
PostgreSQL
AWS Lambda
SST

The project deliberately embraces OpenAPI and Apical TS as foundational dependencies rather than attempting to support multiple API contract formats.

Goals
Primary Goals
Generate complete TypeScript applications from OpenAPI specifications.
Enforce a consistent Hexagonal Architecture.
Use OpenAPI as the single source of truth.
Generate runtime-safe applications using Zod validation.
Produce deployable AWS Lambda applications using SST.
Provide clear extension points for business logic.
Dogfood generation output using the Swagger Petstore specification.
Non-Goals
Support GraphQL.
Support gRPC.
Support AsyncAPI.
Support multiple programming languages.
Support multiple web frameworks in the initial release.
Support multiple ORM implementations in the initial release.
Build a general-purpose code generation framework.
Technology Stack
Concern	Technology
API Contract	OpenAPI 3.1
Contract Generation	Apical TS
Validation	Zod v4
Web Framework	Hono
ORM	Drizzle ORM
Database	PostgreSQL
Runtime	AWS Lambda
Infrastructure	SST
Language	TypeScript
Architectural Principles
Contract First

OpenAPI is the single source of truth.

OpenAPI
    ↓
Apical
    ↓
Generated Contracts
    ↓
Application Code

No secondary schema generation systems should be introduced.

Boundary Validation

All external boundaries must be validated using Apical-generated Zod schemas.

Validation applies to:

HTTP requests
HTTP responses
Database reads
Environment configuration
Hexagonal Architecture

Generated applications must follow Ports & Adapters.

flowchart LR
    Client --> Hono

    Hono --> Application

    Application --> Ports

    Ports --> Drizzle

    Drizzle --> PostgreSQL

Business logic remains independent from:

Hono
Drizzle
SST
AWS Lambda

Authentication (v1, post-PoC)

OpenAPI `securitySchemes` and per-operation `security` drive authentication in generated apps. The pipeline is:

OpenAPI security
    ↓
Apical header validation (wire presence only)
    ↓
Hono middleware (401 on missing/invalid headers; extract credentials)
    ↓
Authenticator port (adapter implements credential verification)
    ↓
Principal (passed into secured use cases)

v1 supports `apiKey` (header) and HTTP bearer only. Authorization (scopes, 403) is out of scope. The PoC dogfood contract (`openapi.poc.yaml`) stays auth-free; auth is verified via a separate fixture (`apps/fixtures/auth-api/`). See `docs/superpowers/specs/2026-08-05-openapi-auth-design.md`.

Project Structure
Monorepo Layout
hexkit/

├── apps/
│   ├── cli/
│   ├── petstore-sample/
│   └── petstore-next/
│
├── packages/
│   ├── core/
│   ├── codegen/
│   ├── plugin-api/
│   │
│   ├── plugin-apical/
│   ├── plugin-architecture-hexagonal/
│   ├── plugin-hono/
│   ├── plugin-next/
│   ├── plugin-drizzle/
│   └── plugin-sst/
│
└── docs/
Package Responsibilities
core

Generation orchestrator.

Responsibilities:

Load plugins
Execute generation pipeline
Manage output files
Coordinate generation lifecycle

The core package must not contain framework-specific logic.

codegen

Shared code generation utilities.

Responsibilities:

Source file builders
Import management
File abstractions
Formatting helpers

No business logic.

plugin-api

Plugin contracts and lifecycle definitions.

Responsibilities:

Plugin interfaces
Plugin metadata
Generation context contracts
plugin-apical

Integration with Apical TS.

Responsibilities:

Execute Apical generation
Produce generated contracts
Produce generated Zod schemas
Produce operation definitions

Output:

src/generated/contracts/
plugin-architecture-hexagonal

Generates the architectural skeleton.

Responsibilities:

Domain entities
Application use cases
Repository ports
Service contracts

Output:

src/core/

Domain shapes, ports, and use cases are derived from Apical-generated contracts (and the OpenAPI input that produced them). This plugin must not hardcode a sample domain such as Petstore Pet/Order types or operation lists.

plugin-hono

Generates HTTP adapters.

Responsibilities:

Route registration
Controllers
Middleware wiring
Operation integration

Consumes Apical-generated contracts. Routes and controllers are derived from those operations; the plugin must not hardcode sample operationIds or Petstore paths.

plugin-next

Generates Next.js App Router HTTP adapters (opt-in via CLI `--http next`).

Responsibilities:

Route Handlers at literal OpenAPI paths
RSC pages and server-access wiring (surface-selectable)
Middleware/auth wiring aligned with Hono behavior
Operation integration

Consumes Apical-generated contracts. OpenAPI maps to Route Handlers; Server Actions are not part of the OpenAPI HTTP surface. The plugin must not hardcode sample operationIds or Petstore paths (see PRD §5.0).

plugin-drizzle

Generates persistence adapters.

Responsibilities:

Database schemas
Repository implementations
Database mappings
Query adapters

Consumes repository ports generated by the Hexagonal Architecture plugin and Apical schemas for validation. Persistence artifacts are derived from contracts/ports; the plugin must not hardcode sample tables or Petstore entity names.

plugin-sst

Generates infrastructure and deployment artifacts.

Responsibilities:

SST configuration
Lambda integration
API Gateway integration
Environment configuration
Generation Pipeline
flowchart TD

    A[OpenAPI Specification]

    A --> B[plugin-apical]

    B --> C[Generated Contracts]

    C --> D[plugin-architecture-hexagonal]

    D --> E[plugin-hono or plugin-next]
    D --> F[plugin-drizzle]

    E --> G[Generated Application]
    F --> G

    G --> H[plugin-sst]

    H --> I[Deployable Project]
Code Generation Strategy

Hexkit follows the same generation philosophy used by Apical TS.

Principles
No Handlebars
No Mustache
No EJS
No template files
No sample-domain hardcoding in plugins

All generators are implemented using TypeScript functions that transform OpenAPI / Apical contract data into source.

Example approach:

generateRepository(port)
generateController(operation)
generateUseCase(operation)

Generators return source code as strings using shared code generation utilities.

Benefits:

Type safety
IDE refactoring support
Easier testing
Fewer moving parts
Consistency with Apical
Domain-agnostic plugins

Plugin Domain Agnosticism

OpenAPI is the only place sample domains are authored.

apps/petstore-sample (OpenAPI + dogfood tests)
    ↓
Hexkit CLI (input path + output directory)
    ↓
Plugins (derive artifacts from contracts)
    ↓
Generated application

The Swagger Petstore (or any PoC fixture) validates Hexkit. It must not be compiled into `@hexkit/plugin-*` as fixed Pet/Order source. Plugin tests may use Petstore OpenAPI as input fixtures and snapshot outputs; implementations must remain driven by that input.
Validation Strategy
Source of Truth

Only Apical-generated schemas are considered authoritative.

OpenAPI
    ↓
Apical
    ↓
Zod Schemas

Drizzle ORM schema generation must not become a second contract source.

Repository Validation

Repository outputs must be validated using Apical-generated schemas before entering the application layer.

Database
    ↓
Repository
    ↓
Zod Validation
    ↓
Application
Generated Application Structure
src/

├── generated/
│   └── contracts/
│
├── core/
│   ├── domain/
│   ├── application/
│   └── ports/
│
├── adapters/
│   ├── http/
│   └── db/
│
└── runtime/
Dogfooding Strategy
Petstore Sample

The Swagger Petstore specification serves as the canonical validation project.

Location:

apps/petstore-sample/

Petstore knowledge lives in this app (OpenAPI fixtures, acceptance tests, dogfood scripts). Hexkit packages remain domain-agnostic and treat the sample only as an input contract.

Next.js PetShop fixture

A vanilla create-next-app-shaped App Router dogfood app validates the opt-in Next adapter:

apps/petstore-next/

The fixture owns PetShop UI (RSC reads via generated server-access; form Server Actions for writes; no client-side data fetching). Generated OpenAPI Route Handlers own contract paths. There is no PetShop test suite — generator and CLI tests cover `plugin-next`.

CLI: `hexkit generate <openapi> <out> --http next [--next-surface both|routes|rsc]` (`hono` remains default; `both` is the default Next surface). See `docs/superpowers/specs/2026-08-11-nextjs-route-handlers-design.md`.

Verification Workflow
Petstore OpenAPI
    ↓
Hexkit Generation
    ↓
TypeScript Build
    ↓
Lint
    ↓
Tests
    ↓
SST Synthesis
    ↓
Success

Every pull request must successfully generate and validate the Petstore sample from its OpenAPI input without Petstore-specific literals inside plugin packages.

Initial Scope

The first release supports exactly:

OpenAPI 3.1
Apical TS
TypeScript
Hono (default HTTP adapter)
Drizzle ORM
PostgreSQL
AWS Lambda
SST
Hexagonal Architecture

Next.js App Router (`@hexkit/plugin-next`) is an opt-in HTTP adapter (`--http next`) validated by the `apps/petstore-next` fixture; Hono remains the default.

Any additional frameworks, runtimes, databases, ORMs, or deployment systems are explicitly out of scope until the initial architecture is validated through the Petstore sample.

Success Criteria

Hexkit is considered successful when it can:

Generate a complete Petstore application from OpenAPI.
Compile successfully without manual changes.
Pass automated tests.
Validate requests and responses using Zod.
Persist data through Drizzle ORM.
Deploy using SST and AWS Lambda.
Provide clear extension points for business logic while preserving generated code boundaries.