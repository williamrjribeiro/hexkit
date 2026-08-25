# `@hexkit/plugin-architecture-hexagonal`

Hexagonal architecture generator for Hexkit. It creates domain entities,
application use cases, repository ports, and service contracts **derived from
Apical-generated contracts / OpenAPI input**.

This plugin provides the framework-independent application core that HTTP,
database, and infrastructure adapters connect to. It must remain
domain-agnostic: sample domains such as Petstore and Library live only in OpenAPI
fixtures under `apps/petstore-sample/` and `apps/fixtures/`, never as hardcoded
types or operation lists in this package (see PRD §5.0).

Every component schema used by the contract gets a domain file, including nested
types that are not persisted as tables. Persistence is owned by
`@hexkit/plugin-drizzle`. HTTP success-status and JSON media lookups come from
[`@hexkit/shared`](../shared/README.md). In-memory plugin tests use
`@hexkit/shared/testing`.
