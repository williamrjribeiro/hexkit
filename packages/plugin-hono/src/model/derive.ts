import { compareText } from "@hexkit/codegen";
import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import type { ContractArtifact } from "@hexkit/plugin-apical";
import {
  compareOpenApiRouteRegistrationOrder,
  deriveHttpControllerBinding,
  IN_MEMORY_AUTH_ADAPTER_PATH,
  openApiPathToHonoPath,
} from "@hexkit/shared";

import type {
  HttpArtifact,
  HttpAuthenticatorBinding,
  HttpBlobStoreBinding,
  HttpOperationBinding,
  HttpRepositoryBinding,
} from "../artifact.ts";

export const CONTROLLERS_FILE_PATH = "src/adapters/http/controllers.ts";
export const ROUTES_FILE_PATH = "src/adapters/http/routes.ts";
export const RUNTIME_FILE_PATH = "src/runtime/app.ts";
export const AUTH_ADAPTER_FILE_PATH = IN_MEMORY_AUTH_ADAPTER_PATH;

export type HttpModel = {
  repositories: readonly HttpRepositoryBinding[];
  operations: readonly HttpOperationBinding[];
  authenticator?: HttpAuthenticatorBinding;
  blobStore?: HttpBlobStoreBinding;
};

export function deriveHttpModel(
  contract: ContractArtifact,
  application: ApplicationArtifact,
): HttpModel {
  const useCasesByOperationId = new Map(
    application.useCases.map((useCase) => [useCase.operationId, useCase] as const),
  );

  const operations = contract.operations
    .toSorted(compareOpenApiRouteRegistrationOrder)
    .map((operation) => {
      const useCase = useCasesByOperationId.get(operation.operationId);
      if (useCase === undefined) {
        throw new Error(
          `ApplicationArtifact is missing use case for operation "${operation.operationId}".`,
        );
      }
      const binding = deriveHttpControllerBinding(operation, useCase, contract.securitySchemes);
      return {
        ...binding,
        honoPath: openApiPathToHonoPath(operation.path),
        ...(useCase.usesBlobStore ? { usesBlobStore: true } : {}),
        ...(useCase.requiresAuth ? { authMiddlewareName: `authenticate${useCase.typeName}` } : {}),
      } satisfies HttpOperationBinding;
    });

  const repositories = application.repositories
    .toSorted((left, right) => compareText(left.parameterName, right.parameterName))
    .map((repository): HttpRepositoryBinding => ({
      parameterName: repository.parameterName,
      repositoryName: repository.name,
      repositoryFilePath: repository.filePath,
    }));

  const authenticator =
    application.authenticatorPort === undefined
      ? undefined
      : ({
          portName: application.authenticatorPort.name,
          portFilePath: application.authenticatorPort.filePath,
          adapterFilePath: AUTH_ADAPTER_FILE_PATH,
          adapterFactoryName: "createInMemoryAuthenticator",
        } satisfies HttpAuthenticatorBinding);

  const blobStore =
    application.blobStorePort === undefined
      ? undefined
      : ({
          portName: application.blobStorePort.name,
          portFilePath: application.blobStorePort.filePath,
          adapterFilePath: "src/adapters/persistence/drizzle-blob-store.ts",
          adapterFactoryName: "createDrizzleBlobStore",
        } satisfies HttpBlobStoreBinding);

  return {
    repositories,
    operations,
    ...(authenticator === undefined ? {} : { authenticator }),
    ...(blobStore === undefined ? {} : { blobStore }),
  };
}

export function toHttpArtifact(model: HttpModel): HttpArtifact {
  return {
    artifactVersion: 1,
    controllersFilePath: CONTROLLERS_FILE_PATH,
    routesFilePath: ROUTES_FILE_PATH,
    runtimeFilePath: RUNTIME_FILE_PATH,
    createAppFactoryName: "createApp",
    createHonoAppFactoryName: "createHonoApp",
    runtimeRepositoriesTypeName: "RuntimeRepositories",
    repositories: model.repositories,
    operations: model.operations,
    ...(model.authenticator === undefined ? {} : { authenticator: model.authenticator }),
    ...(model.blobStore === undefined ? {} : { blobStore: model.blobStore }),
  };
}
