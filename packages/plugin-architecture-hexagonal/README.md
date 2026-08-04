# `@hexkit/plugin-architecture-hexagonal`

Hexagonal architecture generator for Hexkit. It creates domain entities,
application use cases, repository ports, and service contracts **derived from
Apical-generated contracts / OpenAPI input**.

This plugin provides the framework-independent application core that HTTP,
database, and infrastructure adapters connect to. It must remain
domain-agnostic: sample domains such as Petstore live only in OpenAPI fixtures
under `apps/petstore-sample/`, never as hardcoded types or operation lists in
this package (see PRD §5.0).
