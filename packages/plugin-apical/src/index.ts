export { buildCraftGenerateArgs, generateContracts } from "./generate-contracts.ts";
export type { CraftRunner, GenerateContractsOptions } from "./generate-contracts.ts";
export {
  APICAL_CONTRACT_ARTIFACT,
  inspectGeneratedIndexes,
  inspectRoutesIndex,
  inspectSchemaIndex,
  loadValidatedOpenApi,
  normalizeContractArtifact,
  normalizeContractType,
  readOperationExtension,
  readPersistenceExtension,
  readReferenceExtension,
} from "./contract/index.ts";
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
  GeneratedApicalModules,
  OpenApiLoader,
} from "./contract/index.ts";
export { createApicalPlugin } from "./plugin.ts";
export type { ApicalPluginOptions, GeneratedFileReader } from "./plugin.ts";
