import { unique } from "@hexkit/codegen";

import type { HttpAuthSchemeBinding } from "./auth-schemes.ts";

/**
 * Generated in-memory authenticator adapter path used by Hono and Next plugins.
 */
export const IN_MEMORY_AUTH_ADAPTER_PATH = "src/adapters/auth/in-memory-authenticator.ts";

/**
 * Render `{ schemes: [...] }` for generated Hono/Next security metadata.
 *
 * @param schemes - Bindings already derived for the operation.
 */
export function renderSecurityMetaLiteral(schemes: readonly HttpAuthSchemeBinding[]): string {
  const rendered = schemes.map((scheme) => {
    if (scheme.type === "apiKey") {
      return `{ name: ${JSON.stringify(scheme.name)}, type: "apiKey", headerName: ${JSON.stringify(scheme.headerName)} }`;
    }

    return `{ name: ${JSON.stringify(scheme.name)}, type: "http", scheme: "bearer", headerName: ${JSON.stringify(scheme.headerName)} }`;
  });

  return `{ schemes: [${rendered.join(", ")}] }`;
}

/**
 * Unique lowercased apiKey header names from a flat scheme list, first-seen order.
 *
 * @param schemes - Auth schemes collected from one or more operations.
 */
export function collectApiKeyHeaderNames(
  schemes: readonly HttpAuthSchemeBinding[],
): readonly string[] {
  return unique(
    schemes.flatMap((scheme) =>
      scheme.type === "apiKey" ? [scheme.headerName.toLowerCase()] : [],
    ),
  );
}

/**
 * Render the `new Map([...])` argument used by generated in-memory apiKey defaults.
 *
 * Empty scheme lists produce `"[]"` so callers can write `new Map([])`.
 *
 * @param schemes - Auth schemes collected from operations or route methods.
 */
export function renderApiKeyDefaultsMapLiteral(schemes: readonly HttpAuthSchemeBinding[]): string {
  const headerNames = collectApiKeyHeaderNames(schemes);
  if (headerNames.length === 0) return "[]";

  const entries = headerNames.map(
    (headerName) =>
      `[${JSON.stringify(headerName)}, new Set((process.env.AUTH_API_KEYS ?? "test-key").split(","))]`,
  );

  return `[${entries.join(", ")}]`;
}
