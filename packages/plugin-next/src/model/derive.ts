import { compareText, unique } from "@hexkit/codegen";
import type {
  ApplicationArtifact,
  ApplicationUseCase,
} from "@hexkit/plugin-architecture-hexagonal";
import type {
  ContractArtifact,
  ContractHttpMethod,
  ContractMedia,
  ContractOperation,
  ContractResponse,
} from "@hexkit/plugin-apical";

import type {
  NextHttpModel,
  NextMethodBinding,
  NextRouteFile,
  NextSurface,
  NextUiPage,
} from "../artifact.ts";
import { openApiPathToAppRouteFile, openApiPathToUiPageFile } from "./paths.ts";

type ContractSecurityScheme = ContractArtifact["securitySchemes"][number];

export const HELPERS_FILE_PATH = "src/adapters/http-next/helpers.ts";
export const CONTROLLERS_FILE_PATH = "src/adapters/http-next/controllers.ts";
export const RUNTIME_FILE_PATH = "src/adapters/http-next/runtime.ts";
export const SERVER_ACCESS_FILE_PATH = "src/adapters/http-next/server-access.ts";
export const AUTH_ADAPTER_FILE_PATH = "src/adapters/auth/in-memory-authenticator.ts";

export function deriveNextHttpModel(
  contract: ContractArtifact,
  application: ApplicationArtifact,
  options?: { surface?: NextSurface },
): NextHttpModel {
  const surface = options?.surface ?? "both";
  const useCasesByOperationId = new Map(
    application.useCases.map((useCase) => [useCase.operationId, useCase] as const),
  );

  const methodBindings = contract.operations
    .toSorted((left, right) => compareText(left.operationId, right.operationId))
    .map((operation) => {
      const useCase = useCasesByOperationId.get(operation.operationId);
      if (useCase === undefined) {
        throw new Error(
          `ApplicationArtifact is missing use case for operation "${operation.operationId}".`,
        );
      }
      return deriveMethodBinding(operation, useCase, contract.securitySchemes);
    });

  const routes = surface === "rsc" ? [] : groupMethodBindingsIntoRoutes(methodBindings);

  const uiPages =
    surface === "routes"
      ? []
      : deriveUiPages(
          contract.operations,
          methodBindings,
          useCasesByOperationId,
          surface === "both" ? "both" : "rsc",
        );

  const authenticator =
    application.authenticatorPort === undefined
      ? undefined
      : {
          portFilePath: application.authenticatorPort.filePath,
          adapterFilePath: AUTH_ADAPTER_FILE_PATH,
          adapterFactoryName: "createInMemoryAuthenticator" as const,
        };

  return {
    surface,
    routes,
    uiPages,
    repositories: application.repositories,
    ...(authenticator === undefined ? {} : { authenticator }),
  };
}

function deriveMethodBinding(
  operation: ContractOperation,
  useCase: ApplicationUseCase,
  securitySchemes: readonly ContractSecurityScheme[],
): NextMethodBinding & { openApiPath: string } {
  const successResponse = findSuccessResponse(operation);
  if (successResponse === undefined) {
    throw new Error(
      `Operation "${operation.operationId}" has no 2xx response for HTTP adapter generation.`,
    );
  }

  const jsonSuccessMedia = findJsonMedia(successResponse.media);
  const hasJsonBody = Boolean(
    operation.requestBody?.media.some(
      (media) => media.mediaType === "application/json" && media.type !== undefined,
    ),
  );
  const hasNotFound = operation.responses.some((response) => response.status === "404");
  const responseMapName =
    jsonSuccessMedia === undefined ? undefined : `${operation.operationId}ResponseMap`;

  return {
    openApiPath: operation.path,
    method: toNextMethod(operation.method),
    operationId: operation.operationId,
    useCaseTypeName: useCase.typeName,
    useCaseFactoryName: useCase.factoryName,
    useCaseFilePath: useCase.filePath,
    repositoryParameterName: useCase.repositoryParameterName,
    wrapperName: `${operation.operationId}Wrapper`,
    wrapperImportPath: `src/generated/contracts/server/${operation.operationId}.ts`,
    ...(responseMapName === undefined
      ? {}
      : {
          responseMapName,
          responseMapImportPath: `src/generated/contracts/${operation.modulePath}`,
        }),
    hasJsonBody,
    hasJsonSuccessBody: jsonSuccessMedia !== undefined,
    successStatus: successResponse.status,
    ...(hasNotFound ? { notFoundStatus: "404" } : {}),
    ...(jsonSuccessMedia === undefined ? {} : { successMediaType: jsonSuccessMedia.mediaType }),
    requiresPrincipal: useCase.requiresAuth,
    authSchemes: useCase.requiresAuth ? deriveAuthSchemes(operation, securitySchemes) : [],
    useCaseArgumentExpressions: deriveUseCaseArguments(useCase, hasJsonBody),
  };
}

function groupMethodBindingsIntoRoutes(
  methodBindings: readonly (NextMethodBinding & { openApiPath: string })[],
): NextRouteFile[] {
  const routesByPath = new Map<string, NextMethodBinding[]>();

  for (const binding of methodBindings) {
    const methods = routesByPath.get(binding.openApiPath) ?? [];
    const { openApiPath: _openApiPath, ...method } = binding;
    methods.push(method);
    routesByPath.set(binding.openApiPath, methods);
  }

  return [...routesByPath.entries()]
    .toSorted(([leftPath], [rightPath]) => compareText(leftPath, rightPath))
    .map(([openApiPath, methods]) => ({
      filePath: openApiPathToAppRouteFile(openApiPath),
      openApiPath,
      methods: methods.toSorted((left, right) => {
        const methodCompare = compareText(left.method, right.method);
        if (methodCompare !== 0) return methodCompare;
        return compareText(left.operationId, right.operationId);
      }),
    }));
}

function deriveUiPages(
  operations: readonly ContractOperation[],
  methodBindings: readonly (NextMethodBinding & { openApiPath: string })[],
  useCasesByOperationId: ReadonlyMap<string, ApplicationUseCase>,
  surface: "both" | "rsc",
): NextUiPage[] {
  const bindingsByOperationId = new Map(
    methodBindings.map((binding) => [binding.operationId, binding] as const),
  );

  return operations
    .filter((operation) => operation.method === "get")
    .toSorted((left, right) => compareText(left.operationId, right.operationId))
    .flatMap((operation) => {
      const binding = bindingsByOperationId.get(operation.operationId);
      const useCase = useCasesByOperationId.get(operation.operationId);
      if (binding === undefined || useCase === undefined) {
        throw new Error(
          `ApplicationArtifact is missing use case for operation "${operation.operationId}".`,
        );
      }
      if (binding.requiresPrincipal) {
        return [];
      }

      return [
        {
          filePath: openApiPathToUiPageFile(operation.path, { surface }),
          openApiPath: operation.path,
          operationId: operation.operationId,
          useCaseAccessorName: operation.operationId,
          paramNames: extractPathParamNames(operation.path),
          parameters: useCase.parameters,
        },
      ];
    });
}

function deriveUseCaseArguments(useCase: ApplicationUseCase, hasJsonBody: boolean): string[] {
  const principalExpression = useCase.requiresAuth ? ["principal"] : [];
  if (hasJsonBody) {
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
): NextMethodBinding["authSchemes"] {
  if (operation.security.apicalServerHeaderNames.length === 0) return [];

  const schemesByName = new Map(securitySchemes.map((scheme) => [scheme.name, scheme] as const));
  const orderedNames = unique(
    operation.security.requirements.flatMap((requirement) => requirement.schemes),
  );

  return orderedNames.flatMap((name): NextMethodBinding["authSchemes"] => {
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

function extractPathParamNames(openApiPath: string): string[] {
  const matches = openApiPath.matchAll(/\{([^}]+)\}/g);
  return [...matches].map((match) => match[1] ?? "").filter((name) => name.length > 0);
}

function findSuccessResponse(operation: ContractOperation): ContractResponse | undefined {
  return operation.responses.find((response) => isSuccessStatus(response.status));
}

function findJsonMedia(media: readonly ContractMedia[]): ContractMedia | undefined {
  return media.find((entry) => entry.mediaType === "application/json" && entry.type !== undefined);
}

function isSuccessStatus(status: string): boolean {
  return /^2\d\d$/.test(status);
}

function toNextMethod(method: ContractHttpMethod): NextMethodBinding["method"] {
  if (method === "trace") {
    throw new Error(`HTTP method "trace" is not supported by the Next.js adapter.`);
  }
  return method;
}
