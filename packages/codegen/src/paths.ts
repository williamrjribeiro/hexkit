import { dirname, relative } from "node:path";

/** Project-relative import specifier from one generated file to another. */
export function relativeImportPath(fromFilePath: string, toFilePath: string): string {
  const specifier = relative(dirname(fromFilePath), toFilePath).split("\\").join("/");
  return specifier.startsWith(".") ? specifier : `./${specifier}`;
}
