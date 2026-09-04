import type { ContractHttpMethod, ContractOperation } from "@hexkit/plugin-apical";

import { deriveAuthSchemes, type HttpAuthSchemeBinding } from "./auth-schemes.ts";
import {
  findJsonMedia,
  findSuccessResponse,
  hasJsonRequestBody,
  hasNotFoundResponse,
  type ContractSecurityScheme,
} from "./media.ts";
import { isSuccessStatus } from "./status.ts";
import { deriveUseCaseArgumentExpressions, type UseCaseArgumentInput } from "./use-case-args.ts";

/**
 * Use-case fields required to finish an HTTP controller binding.
 *
 * This is a structural slice of hexagonal `ApplicationUseCase` so HTTP plugins
 * can pass their artifact types without a hexagonal dependency here.
 */
export type HttpUseCaseBindingInput = UseCaseArgumentInput & {
  typeName: string;
  factoryName: string;
  filePath: string;
  repositoryParameterName: string;
};

/**
 * Framework-agnostic HTTP operation binding consumed by Hono and Next adapters.
 *
 * Framework-specific extras (`honoPath`, Next `trace` rejection, route grouping)
 * stay in the plugin that owns them.
 */
export type HttpControllerBinding = {
  operationId: string;
  method: ContractHttpMethod;
  openApiPath: string;
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
  requiresAuth: boolean;
  authSchemes: readonly HttpAuthSchemeBinding[];
  useCaseArgumentExpressions: readonly string[];
  /** Query parameter names whose OpenAPI schema is an array (Hono/Next must keep `string[]`). */
  arrayQueryParameterNames: readonly string[];
  successResponseHeaders: readonly string[];
};

/**
 * Fields the shared controller renderer needs. Hono and Next bindings both
 * satisfy this after `hasJsonRequestBody` / `requiresAuth` naming is aligned.
 */
export type HttpControllerOperation = Pick<
  HttpControllerBinding,
  | "operationId"
  | "useCaseTypeName"
  | "useCaseFilePath"
  | "wrapperName"
  | "wrapperImportPath"
  | "responseMapName"
  | "responseMapImportPath"
  | "hasJsonRequestBody"
  | "hasJsonSuccessBody"
  | "successStatus"
  | "notFoundStatus"
  | "successMediaType"
  | "requiresAuth"
  | "useCaseArgumentExpressions"
  | "arrayQueryParameterNames"
  | "successResponseHeaders"
>;

/**
 * Derive a complete HTTP controller binding from a contract operation and use case.
 *
 * @throws If the operation has no 2xx response, because adapters cannot choose a
 *   success status.
 */
export function deriveHttpControllerBinding(
  operation: ContractOperation,
  useCase: HttpUseCaseBindingInput,
  securitySchemes: readonly ContractSecurityScheme[],
): HttpControllerBinding {
  const successResponse = findSuccessResponse(operation);
  if (successResponse === undefined) {
    throw new Error(
      `Operation "${operation.operationId}" has no 2xx response for HTTP adapter generation.`,
    );
  }

  const jsonSuccessMedia = findJsonMedia(successResponse.media);
  const jsonRequestBody = hasJsonRequestBody(operation);
  const wrapperName = `${operation.operationId}Wrapper`;
  const responseMapName =
    jsonSuccessMedia === undefined ? undefined : `${operation.operationId}ResponseMap`;

  return {
    operationId: operation.operationId,
    method: operation.method,
    openApiPath: operation.path,
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
    ...(hasNotFoundResponse(operation) ? { notFoundStatus: "404" } : {}),
    hasJsonRequestBody: jsonRequestBody,
    hasJsonSuccessBody: jsonSuccessMedia !== undefined,
    ...(jsonSuccessMedia === undefined ? {} : { successMediaType: jsonSuccessMedia.mediaType }),
    requiresAuth: useCase.requiresAuth,
    authSchemes: deriveAuthSchemes(operation, securitySchemes),
    useCaseArgumentExpressions: deriveUseCaseArgumentExpressions(useCase, jsonRequestBody),
    arrayQueryParameterNames: operation.parameters
      .filter((parameter) => parameter.location === "query" && parameter.type.kind === "array")
      .map((parameter) => parameter.name),
    successResponseHeaders: (jsonSuccessMedia === undefined
      ? (successResponse.headers ?? [])
      : (operation.responses.find(
          (response) =>
            isSuccessStatus(response.status) && findJsonMedia(response.media) !== undefined,
        )?.headers ?? [])
    ).map((header) => header.name),
  };
}
