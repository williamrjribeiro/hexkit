import { unique } from "@hexkit/codegen";
import type { ContractOperation } from "@hexkit/plugin-apical";

import type { ContractSecurityScheme } from "./media.ts";

/**
 * HTTP adapter view of a contract security scheme.
 *
 * Unsupported OpenAPI schemes are omitted during derivation rather than
 * represented here, so renderers never have to handle an invalid state.
 */
export type HttpAuthSchemeBinding =
  | {
      name: string;
      type: "apiKey";
      headerName: string;
    }
  | {
      name: string;
      type: "http";
      scheme: "bearer";
      headerName: "Authorization";
    };

/**
 * Derive ordered, unique auth scheme bindings for an operation.
 *
 * Returns an empty list when Apical did not emit server header names (the
 * operation is public). Unknown and unsupported schemes are skipped.
 *
 * @param operation - Contract operation whose `security` block is read.
 * @param securitySchemes - Document-level schemes keyed by `name`.
 */
export function deriveAuthSchemes(
  operation: ContractOperation,
  securitySchemes: readonly ContractSecurityScheme[],
): readonly HttpAuthSchemeBinding[] {
  if (operation.security.apicalServerHeaderNames.length === 0) return [];

  const schemesByName = new Map(securitySchemes.map((scheme) => [scheme.name, scheme] as const));
  const orderedNames = unique(
    operation.security.requirements.flatMap((requirement) => requirement.schemes),
  );

  return orderedNames.flatMap((name): HttpAuthSchemeBinding[] => {
    const scheme = schemesByName.get(name);
    if (scheme === undefined || scheme.type === "unsupported") return [];
    if (scheme.type === "apiKey") {
      return [{ name: scheme.name, type: "apiKey", headerName: scheme.headerName }];
    }
    return [
      {
        name: scheme.name,
        type: "http",
        scheme: "bearer",
        headerName: scheme.headerName,
      },
    ];
  });
}
