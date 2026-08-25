import { compareText } from "@hexkit/codegen";
import type {
  ApplicationArtifact,
  ApplicationUseCase,
} from "@hexkit/plugin-architecture-hexagonal";
import type {
  ContractArtifact,
  ContractHttpMethod,
  ContractOperation,
} from "@hexkit/plugin-apical";
import {
  deriveHttpControllerBinding,
  extractOpenApiPathParamNames,
  IN_MEMORY_AUTH_ADAPTER_PATH,
} from "@hexkit/shared";

import type {
  NextHttpModel,
  NextMethodBinding,
  NextRouteFile,
  NextSurface,
  NextUiPage,
} from "../artifact.ts";
import { openApiPathToAppRouteFile, openApiPathToUiPageFile } from "./paths.ts";

export const HELPERS_FILE_PATH = "src/adapters/http-next/helpers.ts";
export const CONTROLLERS_FILE_PATH = "src/adapters/http-next/controllers.ts";
export const RUNTIME_FILE_PATH = "src/adapters/http-next/runtime.ts";
export const SERVER_ACCESS_FILE_PATH = "src/adapters/http-next/server-access.ts";
export const AUTH_ADAPTER_FILE_PATH = IN_MEMORY_AUTH_ADAPTER_PATH;

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
  securitySchemes: ContractArtifact["securitySchemes"],
): NextMethodBinding {
  const binding = deriveHttpControllerBinding(operation, useCase, securitySchemes);
  return {
    ...binding,
    method: toNextMethod(operation.method),
  };
}

function groupMethodBindingsIntoRoutes(
  methodBindings: readonly NextMethodBinding[],
): NextRouteFile[] {
  const routesByPath = new Map<string, NextMethodBinding[]>();

  for (const binding of methodBindings) {
    const methods = routesByPath.get(binding.openApiPath) ?? [];
    methods.push(binding);
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
  methodBindings: readonly NextMethodBinding[],
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
      if (binding.requiresAuth) {
        return [];
      }

      return [
        {
          filePath: openApiPathToUiPageFile(operation.path, { surface }),
          openApiPath: operation.path,
          operationId: operation.operationId,
          useCaseAccessorName: operation.operationId,
          paramNames: [...extractOpenApiPathParamNames(operation.path)],
          parameters: useCase.parameters,
        },
      ];
    });
}

function toNextMethod(method: ContractHttpMethod): NextMethodBinding["method"] {
  if (method === "trace") {
    throw new Error(`HTTP method "trace" is not supported by the Next.js adapter.`);
  }
  return method;
}
