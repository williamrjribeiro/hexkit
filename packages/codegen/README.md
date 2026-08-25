# `@hexkit/codegen`

Shared source-generation utilities for Hexkit. Provides source builders, import
management, naming helpers, and formatting utilities used by generator plugins.

Generator plugins use this package to produce consistent TypeScript source
without templates or application-specific business logic. Contract lookups,
OpenAPI path translation, and HTTP adapter calculations live in
[`@hexkit/shared`](../shared/README.md), not here.

## Exports

- `renderSourceFile`, `SourceFile` — assemble emitted TypeScript files
- `renderImports`, `ImportDeclaration` — sorted import blocks
- Naming helpers for generated identifiers and paths
