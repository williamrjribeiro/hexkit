import { createArtifactKey } from "@hexkit/plugin-api";

import type { ContractArtifact } from "./types.ts";

export const APICAL_CONTRACT_ARTIFACT = createArtifactKey<ContractArtifact>("apical.contract.v1");

export {
  readOperationExtension,
  readPersistenceExtension,
  readReferenceExtension,
} from "./extensions.ts";
export {
  inspectGeneratedIndexes,
  inspectRoutesIndex,
  inspectSchemaIndex,
} from "./generated-index.ts";
export type { GeneratedApicalModules } from "./generated-index.ts";
export { normalizeContractArtifact, normalizeContractType } from "./normalize.ts";
export { loadValidatedOpenApi } from "./openapi.ts";
export type { OpenApiLoader } from "./openapi.ts";
export type {
  ContractApplication,
  ContractArtifact,
  ContractArrayType,
  ContractHttpMethod,
  ContractMedia,
  ContractObjectType,
  ContractOperation,
  ContractOperationExtension,
  ContractParameter,
  ContractParameterLocation,
  ContractPersistenceExtension,
  ContractProperty,
  ContractReferenceExtension,
  ContractReferenceType,
  ContractRequestBody,
  ContractResponse,
  ContractScalarType,
  ContractScalarValue,
  ContractSchema,
  ContractType,
} from "./types.ts";
