import { compareText, unique } from "@hexkit/codegen";
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

import type {
  HttpArtifact,
  HttpAuthSchemeBinding,
  HttpAuthenticatorBinding,
  HttpOperationBinding,
  HttpRepositoryBinding,
} from "../artifact.ts";

type ContractSecurityScheme = ContractArtifact["securitySchemes"][number];

export const CONTROLLERS_FILE_PATH = "src/adapters/http/controllers.ts";
export const ROUTES_FILE_PATH = "src/adapters/http/routes.ts";
export const RUNTIME_FILE_PATH = "src/runtime/app.ts";
export const AUTH_ADAPTER_FILE_PATH = "src/adapters/auth/in-memory-authenticator.ts";

export type HttpModel = {
  repositories: readonly HttpRepositoryBinding[];
  operations: readonly HttpOperationBinding[];
  authenticator?: HttpAuthenticatorBinding;
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
      return deriveOperation(operation, useCase, contract.securitySchemes);
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

  const authenticator =
    application.authenticatorPort === undefined
      ? undefined
      : ({
          portName: application.authenticatorPort.name,
          portFilePath: application.authenticatorPort.filePath,
          adapterFilePath: AUTH_ADAPTER_FILE_PATH,
          adapterFactoryName: "createInMemoryAuthenticator",
        } satisfies HttpAuthenticatorBinding);

  return {
    repositories,
    operations,
    ...(authenticator === undefined ? {} : { authenticator }),
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
  };
}

function deriveOperation(
  operation: ContractOperation,
  useCase: ApplicationUseCase,
  securitySchemes: readonly ContractSecurityScheme[],
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
  const authSchemes = deriveAuthSchemes(operation, securitySchemes);

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
    requiresAuth: useCase.requiresAuth,
    ...(useCase.requiresAuth ? { authMiddlewareName: `authenticate${useCase.typeName}` } : {}),
    authSchemes,
    useCaseArgumentExpressions: deriveUseCaseArguments(useCase, hasJsonRequestBody),
  };
}

function deriveUseCaseArguments(
  useCase: ApplicationUseCase,
  hasJsonRequestBody: boolean,
): string[] {
  const principalExpression = useCase.requiresAuth ? ["principal"] : [];
  if (hasJsonRequestBody) {
    return [...principalExpression, "request.value.body"];
  }

  return [
    ...principalExpression,
    ...useCase.parameters.map((parameter) => `request.value.path.${parameter.name}`),
  ];
}

function deriveAuthSchemes(
  operation: ContractOperation,
  securitySchemes: readonly ContractSecurityScheme[],
): HttpAuthSchemeBinding[] {
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
