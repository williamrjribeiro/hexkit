import { normalizeApplication } from "./application.ts";
import type { GeneratedApicalModules } from "./generated-index.ts";
import { createRefResolver } from "./json-pointer.ts";
import { normalizeOperations } from "./operation-normalize.ts";
import { normalizeGlobalSecurity, normalizeSecuritySchemes } from "./security.ts";
import { normalizeSchemas } from "./type-normalize.ts";
import type { ContractArtifact } from "./types.ts";
import { validateArtifactReferences } from "./validate-artifact.ts";
import { asRecord, optionalRecord, requiredString } from "./values.ts";

export { normalizeContractType } from "./type-normalize.ts";

export function normalizeContractArtifact(
  value: unknown,
  generatedModules: GeneratedApicalModules,
): ContractArtifact {
  const document = asRecord(value, "OpenAPI document");
  const openapiVersion = requiredString(document.openapi, "OpenAPI openapi");
  if (!openapiVersion.startsWith("3.1.")) {
    throw new Error(`Hexkit requires OpenAPI 3.1.x; received "${openapiVersion}".`);
  }

  const components = optionalRecord(document.components, "OpenAPI components") ?? {};
  const securitySchemes = normalizeSecuritySchemes(
    optionalRecord(components.securitySchemes, "OpenAPI components.securitySchemes") ?? {},
  );
  const globalSecurity = normalizeGlobalSecurity(document);
  const resolver = createRefResolver(document);

  const artifact: ContractArtifact = {
    artifactVersion: 1,
    openapiVersion,
    application: normalizeApplication(asRecord(document.info, "OpenAPI info")),
    schemas: normalizeSchemas(document, generatedModules),
    securitySchemes,
    globalSecurity,
    operations: normalizeOperations(
      document,
      generatedModules,
      securitySchemes,
      globalSecurity,
      resolver.resolve,
    ),
  };

  validateArtifactReferences(artifact);
  return artifact;
}
