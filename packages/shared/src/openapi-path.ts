/**
 * Collect `{param}` names from an OpenAPI path template, in path order.
 *
 * Empty capture groups are dropped. Literal segments are ignored.
 *
 * @param openApiPath - Path such as `"/items/{itemId}/photos/{photoId}"`.
 */
export function extractOpenApiPathParamNames(openApiPath: string): readonly string[] {
  const matches = openApiPath.matchAll(/\{([^}]+)\}/g);
  return [...matches].map((match) => match[1] ?? "").filter((name) => name.length > 0);
}

/**
 * Rewrite `{param}` template segments to Hono `:param` params.
 *
 * @param openApiPath - OpenAPI path template.
 */
export function openApiPathToHonoPath(openApiPath: string): string {
  return openApiPath.replaceAll(/\{([^}]+)\}/g, ":$1");
}

/**
 * Split an OpenAPI path into Next.js App Router segments (`{id}` → `[id]`).
 *
 * Leading and trailing slashes produce no extra empty segments.
 *
 * @param openApiPath - OpenAPI path template.
 */
export function openApiPathToNextSegments(openApiPath: string): readonly string[] {
  return openApiPath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.replace(/^\{([^}]+)\}$/, "[$1]"));
}
