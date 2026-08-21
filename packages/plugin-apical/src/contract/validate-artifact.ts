import { isFullyEnforceableRequirement } from "./security.ts";
import type {
  ContractArtifact,
  ContractOperation,
  ContractSecurityScheme,
  ContractType,
} from "./types.ts";

function describeSecurityScheme(name: string, scheme: ContractSecurityScheme | undefined): string {
  if (scheme === undefined) return `${name} (unknown)`;
  if (scheme.type === "unsupported") return `${name} (${scheme.openApiType})`;
  return name;
}

export function validateEnforceableSecurity(
  operationId: string,
  security: ContractOperation["security"],
  securitySchemes: readonly ContractSecurityScheme[],
): void {
  const schemesByName = new Map(securitySchemes.map((scheme) => [scheme.name, scheme]));
  const nonEmptyRequirements = security.requirements.filter(
    (requirement) => requirement.schemes.length > 0,
  );
  if (nonEmptyRequirements.length === 0) return;

  for (const requirement of nonEmptyRequirements) {
    if (requirement.schemes.length > 1) {
      throw new Error(
        `Operation "${operationId}" requires AND of multiple security schemes (${requirement.schemes.join(", ")}); Hexkit v1 supports only one scheme per OpenAPI security requirement object.`,
      );
    }
  }

  // OpenAPI security is OR across requirement objects: pass when any branch is enforceable.
  const hasEnforceableBranch = nonEmptyRequirements.some((requirement) =>
    isFullyEnforceableRequirement(requirement, schemesByName),
  );
  if (hasEnforceableBranch) return;

  const unsupported = [
    ...new Set(nonEmptyRequirements.flatMap((requirement) => requirement.schemes)),
  ];
  throw new Error(
    `Operation "${operationId}" requires OpenAPI security schemes that Hexkit cannot enforce at runtime: ${unsupported
      .map((schemeName) => describeSecurityScheme(schemeName, schemesByName.get(schemeName)))
      .join(", ")}.`,
  );
}

export function validateArtifactReferences(artifact: ContractArtifact): void {
  const schemas = new Map(artifact.schemas.map((schema) => [schema.name, schema]));

  const validateType = (type: ContractType, location: string): void => {
    if (type.kind === "reference" && !schemas.has(type.schema)) {
      throw new Error(`${location} references unknown schema "${type.schema}".`);
    }
    if (type.kind === "array") validateType(type.items, `${location}.items`);
    if (type.kind === "object") {
      for (const property of type.properties) {
        validateType(property.type, `${location}.properties.${property.name}`);
      }
    }
  };

  for (const schema of artifact.schemas) {
    if (
      schema.persistence !== undefined &&
      !schema.properties.some((property) => property.name === schema.persistence?.identity)
    ) {
      throw new Error(
        `Schema "${schema.name}" persistence identity "${schema.persistence.identity}" is not a property.`,
      );
    }

    for (const property of schema.properties) {
      validateType(property.type, `Schema "${schema.name}" property "${property.name}"`);
      if (property.reference !== undefined) {
        const target = schemas.get(property.reference.schema);
        if (target === undefined) {
          throw new Error(
            `Schema "${schema.name}" property "${property.name}" references unknown schema "${property.reference.schema}".`,
          );
        }
        if (!target.properties.some(({ name }) => name === property.reference?.property)) {
          throw new Error(
            `Schema "${schema.name}" property "${property.name}" references unknown property "${property.reference.schema}.${property.reference.property}".`,
          );
        }
      }
    }
  }

  for (const operation of artifact.operations) {
    if (operation.extension !== undefined && !schemas.has(operation.extension.aggregate)) {
      throw new Error(
        `Operation "${operation.operationId}" names unknown aggregate "${operation.extension.aggregate}".`,
      );
    }
    for (const parameter of operation.parameters) {
      validateType(
        parameter.type,
        `Operation "${operation.operationId}" parameter "${parameter.name}"`,
      );
    }
    for (const media of operation.requestBody?.media ?? []) {
      if (media.type !== undefined) {
        validateType(media.type, `Operation "${operation.operationId}" request ${media.mediaType}`);
      }
    }
    for (const response of operation.responses) {
      for (const media of response.media) {
        if (media.type !== undefined) {
          validateType(
            media.type,
            `Operation "${operation.operationId}" response ${response.status} ${media.mediaType}`,
          );
        }
      }
    }
  }
}
