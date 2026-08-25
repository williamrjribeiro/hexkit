import { openApiPathToNextSegments } from "@hexkit/shared";

export { relativeImportPath } from "@hexkit/codegen";

function openApiPathToAppRelativePath(openApiPath: string): string {
  return openApiPathToNextSegments(openApiPath).join("/");
}

/** Map an OpenAPI path to a Next.js App Router Route Handler file path. */
export function openApiPathToAppRouteFile(openApiPath: string): string {
  const relativePath = openApiPathToAppRelativePath(openApiPath);
  return relativePath.length > 0 ? `app/${relativePath}/route.ts` : "app/route.ts";
}

/** Map an OpenAPI path to a Next.js App Router RSC page file path. */
export function openApiPathToUiPageFile(
  openApiPath: string,
  options: { surface: "rsc" | "both" },
): string {
  const relativePath = openApiPathToAppRelativePath(openApiPath);
  const prefix = options.surface === "both" ? "app/ui" : "app";
  return relativePath.length > 0 ? `${prefix}/${relativePath}/page.tsx` : `${prefix}/page.tsx`;
}

/** Split an OpenAPI path into Next.js App Router dynamic segment names. */
export function openApiPathToAppRouteSegments(openApiPath: string): string[] {
  return [...openApiPathToNextSegments(openApiPath)];
}
