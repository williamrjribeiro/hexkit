import type {
  ContractOperationSecurity,
  ContractSecurityRequirement,
  ContractSecurityScheme,
} from "./types.ts";
import { asRecord, optionalRecord, optionalString, requiredString } from "./values.ts";

function unsupportedSecurityScheme(
  name: string,
  openApiType: string,
  reason: string,
): ContractSecurityScheme {
  return { name, type: "unsupported", openApiType, reason };
}

function normalizeSecurityRequirement(
  value: unknown,
  location: string,
): ContractSecurityRequirement {
  const requirement = asRecord(value, location);
  const scopes: Record<string, readonly string[]> = {};

  for (const [schemeName, rawScopes] of Object.entries(requirement)) {
    if (!Array.isArray(rawScopes)) {
      throw new Error(`${location}.${schemeName} must be an array of scope names.`);
    }

    scopes[schemeName] = rawScopes.map((scope, index) =>
      requiredString(scope, `${location}.${schemeName}[${String(index)}]`),
    );
  }

  return { schemes: Object.keys(requirement), scopes };
}

function normalizeSecurityRequirements(
  value: unknown,
  location: string,
): readonly ContractSecurityRequirement[] {
  if (!Array.isArray(value)) {
    throw new Error(`${location} must be an array.`);
  }

  return value.map((requirement, index) =>
    normalizeSecurityRequirement(requirement, `${location}[${String(index)}]`),
  );
}

export function isSupportedSecurityScheme(
  scheme: ContractSecurityScheme | undefined,
): scheme is Extract<ContractSecurityScheme, { type: "apiKey" | "http" }> {
  return scheme?.type === "apiKey" || scheme?.type === "http";
}

export function isFullyEnforceableRequirement(
  requirement: ContractSecurityRequirement,
  schemesByName: ReadonlyMap<string, ContractSecurityScheme>,
): boolean {
  return (
    requirement.schemes.length > 0 &&
    requirement.schemes.every((schemeName) =>
      isSupportedSecurityScheme(schemesByName.get(schemeName)),
    )
  );
}

export function normalizeSecuritySchemes(
  document: Record<string, unknown>,
): readonly ContractSecurityScheme[] {
  const components = optionalRecord(document.components, "OpenAPI components") ?? {};
  const securitySchemes =
    optionalRecord(components.securitySchemes, "OpenAPI components.securitySchemes") ?? {};

  return Object.entries(securitySchemes).map(([name, value]) => {
    const location = `OpenAPI components.securitySchemes.${name}`;
    const scheme = asRecord(value, location);
    const openApiType = requiredString(scheme.type, `${location}.type`);

    if (openApiType === "apiKey") {
      const apiKeyLocation = requiredString(scheme.in, `${location}.in`);
      const headerName = requiredString(scheme.name, `${location}.name`);

      if (apiKeyLocation === "header") {
        return { name, type: "apiKey", in: "header", headerName };
      }

      return unsupportedSecurityScheme(
        name,
        openApiType,
        `apiKey security scheme location "${apiKeyLocation}" is not supported; only header is supported.`,
      );
    }

    if (openApiType === "http") {
      const httpScheme = requiredString(scheme.scheme, `${location}.scheme`);

      if (httpScheme.toLowerCase() === "bearer") {
        const bearerFormat = optionalString(scheme.bearerFormat, `${location}.bearerFormat`);
        return {
          name,
          type: "http",
          scheme: "bearer",
          headerName: "Authorization",
          ...(bearerFormat === undefined ? {} : { bearerFormat }),
        };
      }

      return unsupportedSecurityScheme(
        name,
        openApiType,
        `http security scheme "${httpScheme}" is not supported; only bearer is supported.`,
      );
    }

    return unsupportedSecurityScheme(
      name,
      openApiType,
      `OpenAPI security scheme type "${openApiType}" is not supported.`,
    );
  });
}

export function normalizeGlobalSecurity(
  document: Record<string, unknown>,
): readonly ContractSecurityRequirement[] {
  if (document.security === undefined) return [];

  return normalizeSecurityRequirements(document.security, "OpenAPI security");
}

/**
 * Resolves effective security using OpenAPI precedence:
 * operation.security → path-item.security → document.security.
 */
export function resolveOperationSecurity(
  document: Record<string, unknown>,
  operation: Record<string, unknown>,
  schemes: readonly ContractSecurityScheme[],
  globalSecurity: readonly ContractSecurityRequirement[],
  pathItem: Record<string, unknown> = {},
): ContractOperationSecurity {
  void document;

  let overridesGlobal = false;
  let requirements: readonly ContractSecurityRequirement[];

  if (operation.security !== undefined) {
    overridesGlobal = true;
    requirements = normalizeSecurityRequirements(operation.security, "OpenAPI operation.security");
  } else if (pathItem.security !== undefined) {
    overridesGlobal = true;
    requirements = normalizeSecurityRequirements(pathItem.security, "OpenAPI pathItem.security");
  } else {
    requirements = globalSecurity;
  }

  const schemesByName = new Map(schemes.map((scheme) => [scheme.name, scheme]));
  const headerNames = new Set<string>();

  for (const requirement of requirements) {
    if (!isFullyEnforceableRequirement(requirement, schemesByName)) continue;

    for (const schemeName of requirement.schemes) {
      const scheme = schemesByName.get(schemeName);
      if (isSupportedSecurityScheme(scheme)) {
        headerNames.add(scheme.headerName.toLowerCase());
      }
    }
  }

  return {
    overridesGlobal,
    requirements,
    apicalServerHeaderNames: [...headerNames],
  };
}
