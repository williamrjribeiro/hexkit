/**
 * Apical craft emits server wrappers that often import ResponseMap /
 * createStandardSchemaValidationError / StandardSchemaV1 without using them.
 * Strip unused bindings so oxlint/eslint stay quiet on generated contracts.
 */
const RESPONSE_MAP_IMPORT = /^import \{ (\w+ResponseMap) \} from ("[^"]+");\r?\n(?:\r?\n)?/gm;
const STANDARD_SCHEMA_V1_IMPORT =
  /^import type \{ (StandardSchemaV1) \} from ("[^"]+");\r?\n(?:\r?\n)?/gm;
const STANDARD_SCHEMA_MODULE_IMPORT = new RegExp(
  String.raw`^import \{([^}]+)\} from ("(?:\.\./)+standard-schema\.ts");\r?\n(?:\r?\n)?`,
  "gm",
);

export function scrubUnusedCraftServerImports(source: string): string {
  let result = source;

  result = result.replace(RESPONSE_MAP_IMPORT, (full, name: string) =>
    isIdentifierUsedOutside(result, full, name) ? full : "",
  );

  result = result.replace(STANDARD_SCHEMA_V1_IMPORT, (full, name: string) =>
    isIdentifierUsedOutside(result, full, name) ? full : "",
  );

  result = result.replace(STANDARD_SCHEMA_MODULE_IMPORT, (full, bindings: string, from: string) => {
    const parts = bindings
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    const kept = parts.filter((part) => {
      const match = /^(?:type\s+)?(\w+)$/.exec(part);
      if (match === null) {
        return true;
      }
      return isIdentifierUsedOutside(result, full, match[1]!);
    });
    if (kept.length === 0) {
      return "";
    }
    if (kept.length === parts.length) {
      return full;
    }
    return `import { ${kept.join(", ")} } from ${from};\n\n`;
  });

  return result.replace(/\n{3,}/g, "\n\n");
}

function isIdentifierUsedOutside(source: string, importSnippet: string, name: string): boolean {
  const withoutImport = source.replace(importSnippet, "");
  return new RegExp(`\\b${name}\\b`).test(withoutImport);
}
