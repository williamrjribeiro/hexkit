import { dirname, relative } from "node:path";

/** Project-relative import specifier from one generated file to another. */
export function relativeImportPath(fromFilePath: string, toFilePath: string): string {
  const specifier = relative(dirname(fromFilePath), toFilePath).split("\\").join("/");
  return specifier.startsWith(".") ? specifier : `./${specifier}`;
}

function openApiPathToAppSegments(openApiPath: string): string[] {
  return openApiPath
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.replace(/^\{([^}]+)\}$/, "[$1]"));
}

function openApiPathToAppRelativePath(openApiPath: string): string {
  return openApiPathToAppSegments(openApiPath).join("/");
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
  return openApiPathToAppSegments(openApiPath);
}
