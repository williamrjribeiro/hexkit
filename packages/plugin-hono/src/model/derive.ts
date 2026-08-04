import type {
  ApplicationArtifact,
  ApplicationUseCase,
} from "@hexkit/plugin-architecture-hexagonal";
import type {
  ContractArtifact,
  ContractMedia,
  ContractOperation,
  ContractResponse,
} from "@hexkit/plugin-apical";

import type { HttpArtifact, HttpOperationBinding, HttpRepositoryBinding } from "../artifact.ts";

export const CONTROLLERS_FILE_PATH = "src/adapters/http/controllers.ts";
export const ROUTES_FILE_PATH = "src/adapters/http/routes.ts";
export const RUNTIME_FILE_PATH = "src/runtime/app.ts";

export type HttpModel = {
  repositories: readonly HttpRepositoryBinding[];
  operations: readonly HttpOperationBinding[];
};

export function deriveHttpModel(
  contract: ContractArtifact,
  application: ApplicationArtifact,
): HttpModel {
  const useCasesByOperationId = new Map(
    application.useCases.map((useCase) => [useCase.operationId, useCase] as const),
  );

  const operations = contract.operations
    .toSorted((left, right) => compareText(left.operationId, right.operationId))
    .map((operation) => {
      const useCase = useCasesByOperationId.get(operation.operationId);
      if (useCase === undefined) {
        throw new Error(
          `ApplicationArtifact is missing use case for operation "${operation.operationId}".`,
        );
      }
      return deriveOperation(operation, useCase);
    });

  const repositories = application.repositories
    .toSorted((left, right) => compareText(left.parameterName, right.parameterName))
    .map(
      (repository): HttpRepositoryBinding => ({
        parameterName: repository.parameterName,
        repositoryName: repository.name,
        repositoryFilePath: repository.filePath,
      }),
    );

  return { repositories, operations };
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
  };
}

function deriveOperation(
  operation: ContractOperation,
  useCase: ApplicationUseCase,
): HttpOperationBinding {
  const successResponse = findSuccessResponse(operation);
  if (successResponse === undefined) {
    throw new Error(
      `Operation "${operation.operationId}" has no 2xx response for HTTP adapter generation.`,
    );
  }

  const jsonSuccessMedia = findJsonMedia(successResponse.media);
  const hasJsonRequestBody = Boolean(
    operation.requestBody?.media.some(
      (media) => media.mediaType === "application/json" && media.type !== undefined,
    ),
  );
  const hasNotFound = operation.responses.some((response) => response.status === "404");
  const wrapperName = `${operation.operationId}Wrapper`;
  const responseMapName =
    jsonSuccessMedia === undefined ? undefined : `${operation.operationId}ResponseMap`;

  return {
    operationId: operation.operationId,
    method: operation.method,
    openApiPath: operation.path,
    honoPath: toHonoPath(operation.path),
    useCaseTypeName: useCase.typeName,
    useCaseFactoryName: useCase.factoryName,
    useCaseFilePath: useCase.filePath,
    repositoryParameterName: useCase.repositoryParameterName,
    wrapperName,
    wrapperImportPath: `src/generated/contracts/server/${operation.operationId}.ts`,
    ...(responseMapName === undefined
      ? {}
      : {
          responseMapName,
          responseMapImportPath: `src/generated/contracts/${operation.modulePath}`,
        }),
    successStatus: successResponse.status,
    ...(hasNotFound ? { notFoundStatus: "404" } : {}),
    hasJsonRequestBody,
    hasJsonSuccessBody: jsonSuccessMedia !== undefined,
    ...(jsonSuccessMedia === undefined ? {} : { successMediaType: jsonSuccessMedia.mediaType }),
    useCaseArgumentExpressions: deriveUseCaseArguments(useCase, hasJsonRequestBody),
  };
}

function deriveUseCaseArguments(
  useCase: ApplicationUseCase,
  hasJsonRequestBody: boolean,
): string[] {
  if (hasJsonRequestBody) {
    return ["request.value.body"];
  }

  return useCase.parameters.map((parameter) => `request.value.path.${parameter.name}`);
}

function findSuccessResponse(operation: ContractOperation): ContractResponse | undefined {
  return operation.responses.find((response) => isSuccessStatus(response.status));
}

function findJsonMedia(media: readonly ContractMedia[]): ContractMedia | undefined {
  return media.find((entry) => entry.mediaType === "application/json" && entry.type !== undefined);
}

function toHonoPath(openApiPath: string): string {
  return openApiPath.replaceAll(/\{([^}]+)\}/g, ":$1");
}

function isSuccessStatus(status: string): boolean {
  return /^2\d\d$/.test(status);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
