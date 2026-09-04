import { compareText } from "@hexkit/codegen";

/**
 * Collect `{param}` names from an OpenAPI path template, in path order.
 *
 * Literal segments are ignored.
 *
 * @param openApiPath - Path such as `"/items/{itemId}/photos/{photoId}"`.
 */
export function extractOpenApiPathParamNames(openApiPath: string): readonly string[] {
  return [...openApiPath.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]!);
}

export type OpenApiRouteRegistrationKey = {
  path: string;
  operationId: string;
};

/**
 * Sort OpenAPI operations for first-match HTTP routers (Hono).
 *
 * Fewer `{param}` segments register first so `/user/login` is not captured by
 * `/user/{username}`. Equal specificity falls back to `operationId`.
 */
export function compareOpenApiRouteRegistrationOrder(
  left: OpenApiRouteRegistrationKey,
  right: OpenApiRouteRegistrationKey,
): number {
  const byParamCount =
    extractOpenApiPathParamNames(left.path).length -
    extractOpenApiPathParamNames(right.path).length;
  if (byParamCount !== 0) return byParamCount;
  return compareText(left.operationId, right.operationId);
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
