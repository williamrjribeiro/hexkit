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
