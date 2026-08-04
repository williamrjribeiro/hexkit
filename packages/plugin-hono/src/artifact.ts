import { createArtifactKey } from "@hexkit/plugin-api";
import type { ContractHttpMethod } from "@hexkit/plugin-apical";

export type HttpRepositoryBinding = {
  parameterName: string;
  repositoryName: string;
  repositoryFilePath: string;
};

export type HttpOperationBinding = {
  operationId: string;
  method: ContractHttpMethod;
  openApiPath: string;
  honoPath: string;
  useCaseTypeName: string;
  useCaseFactoryName: string;
  useCaseFilePath: string;
  repositoryParameterName: string;
  wrapperName: string;
  wrapperImportPath: string;
  responseMapName?: string;
  responseMapImportPath?: string;
  successStatus: string;
  notFoundStatus?: string;
  hasJsonRequestBody: boolean;
  hasJsonSuccessBody: boolean;
  successMediaType?: string;
  useCaseArgumentExpressions: readonly string[];
};

export type HttpArtifact = {
  artifactVersion: 1;
  controllersFilePath: string;
  routesFilePath: string;
  runtimeFilePath: string;
  createAppFactoryName: string;
  createHonoAppFactoryName: string;
  runtimeRepositoriesTypeName: string;
  repositories: readonly HttpRepositoryBinding[];
  operations: readonly HttpOperationBinding[];
};

export const HTTP_ARTIFACT = createArtifactKey<HttpArtifact>("hono.http.v1");
