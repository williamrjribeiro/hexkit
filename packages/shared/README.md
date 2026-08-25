# `@hexkit/shared`

Shared generator **calculations** used by more than one Hexkit plugin. These are
pure functions: the same input always produces the same output, with no
filesystem or plugin-lifecycle side effects.

Hono and Next HTTP adapters share operation binding, controller rendering, and
the in-memory authenticator. Hexagonal generation reuses HTTP status and JSON
media lookups over `ContractArtifact` data.

This package must not hardcode sample operationIds or Petstore paths (PRD §5.0).

## Exports

- HTTP status and media: `isSuccessStatus`, `findJsonMedia`, `findSuccessResponse`
- OpenAPI paths: `extractOpenApiPathParamNames`, `openApiPathToHonoPath`, `openApiPathToNextSegments`
- HTTP adapter model: `deriveHttpControllerBinding`, `deriveAuthSchemes`, `deriveUseCaseArgumentExpressions`
- Renderers: `renderHttpControllersFile`, `renderInMemoryAuthAdapterFile`, `renderSecurityMetaLiteral`, `renderApiKeyDefaultsMapLiteral`

## Testing

`@hexkit/shared/testing` is a separate pack entry (same pattern as `@hexkit/plugin-apical/testing`). Plugin tests use it for in-memory `GenerationContext` collection:

- `createCollectingContext` — record `writeFile` calls without touching the filesystem
- `collectPluginOutput` — publish artifacts, run one plugin, return files + context
- `loadNormalizedContract` — `loadValidatedOpenApi` + `normalizeContractArtifact`

Library-shaped random contracts stay in `@hexkit/plugin-apical/testing` (`createSeededLibraryContract`). This package does not import hexagonal, so hexagonal tests can use the harness without a cycle.
