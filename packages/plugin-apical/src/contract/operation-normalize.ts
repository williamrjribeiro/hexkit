import { readOperationExtension } from "./extensions.ts";
import type { GeneratedApicalModules } from "./generated-index.ts";
import type { RefResolver } from "./json-pointer.ts";
import { normalizeContractType } from "./type-normalize.ts";
import type {
  ContractHttpMethod,
  ContractMedia,
  ContractOperation,
  ContractParameter,
  ContractParameterLocation,
  ContractRequestBody,
  ContractResponse,
  ContractResponseHeader,
  ContractSecurityRequirement,
  ContractSecurityScheme,
} from "./types.ts";
import { resolveOperationSecurity } from "./security.ts";
import { validateEnforceableSecurity } from "./validate-artifact.ts";
import {
  asRecord,
  optionalBoolean,
  optionalDescription,
  optionalRecord,
  optionalString,
  requiredString,
} from "./values.ts";

const httpMethods = new Set<ContractHttpMethod>([
  "delete",
  "get",
  "head",
  "options",
  "patch",
  "post",
  "put",
  "trace",
]);

const parameterLocations = new Set<ContractParameterLocation>([
  "cookie",
  "header",
  "path",
  "query",
]);

export function normalizeParameter(
  resolve: RefResolver["resolve"],
  value: unknown,
  location: string,
): ContractParameter {
  const parameter = resolve(value, location);
  const rawLocation = requiredString(parameter.in, `${location}.in`);
  if (!parameterLocations.has(rawLocation as ContractParameterLocation)) {
    throw new Error(`${location}.in "${rawLocation}" is not a supported parameter location.`);
  }
  if (parameter.schema === undefined) {
    throw new Error(`${location}.schema is required.`);
  }

  return {
    name: requiredString(parameter.name, `${location}.name`),
    location: rawLocation as ContractParameterLocation,
    required:
      rawLocation === "path" ||
      (optionalBoolean(parameter.required, `${location}.required`) ?? false),
    type: normalizeContractType(parameter.schema, `${location}.schema`),
    ...optionalDescription(parameter, location),
  };
}

export function normalizeParameters(
  resolve: RefResolver["resolve"],
  pathItem: Record<string, unknown>,
  operation: Record<string, unknown>,
  location: string,
): readonly ContractParameter[] {
  const pathParameters = pathItem.parameters ?? [];
  const operationParameters = operation.parameters ?? [];
  if (!Array.isArray(pathParameters) || !Array.isArray(operationParameters)) {
    throw new Error(`${location}.parameters must be an array.`);
  }

  const parameters = new Map<string, ContractParameter>();
  for (const [scope, values] of [
    ["path", pathParameters],
    ["operation", operationParameters],
  ] as const) {
    values.forEach((value, index) => {
      const parameter = normalizeParameter(
        resolve,
        value,
        `${location}.${scope}Parameters[${String(index)}]`,
      );
      parameters.set(`${parameter.location}:${parameter.name}`, parameter);
    });
  }

  return [...parameters.values()];
}

export function normalizeMedia(content: unknown, location: string): readonly ContractMedia[] {
  const media = optionalRecord(content, location) ?? {};
  return Object.entries(media).map(([mediaType, value]) => {
    const mediaObject = asRecord(value, `${location}.${mediaType}`);
    return {
      mediaType,
      ...(mediaObject.schema === undefined
        ? {}
        : { type: normalizeContractType(mediaObject.schema, `${location}.${mediaType}.schema`) }),
    };
  });
}

export function normalizeRequestBody(
  resolve: RefResolver["resolve"],
  value: unknown,
  location: string,
): ContractRequestBody {
  const requestBody = resolve(value, location);
  return {
    required: optionalBoolean(requestBody.required, `${location}.required`) ?? false,
    media: normalizeMedia(requestBody.content, `${location}.content`),
    ...optionalDescription(requestBody, location),
  };
}

export function normalizeResponses(
  resolve: RefResolver["resolve"],
  value: unknown,
  location: string,
): readonly ContractResponse[] {
  const responses = asRecord(value, location);
  return Object.entries(responses).map(([status, responseValue]) => {
    const response = resolve(responseValue, `${location}.${status}`);
    const headers = normalizeResponseHeaders(response.headers, `${location}.${status}.headers`);
    return {
      status,
      description: requiredString(response.description, `${location}.${status}.description`),
      media: normalizeMedia(response.content, `${location}.${status}.content`),
      ...(headers.length === 0 ? {} : { headers }),
    };
  });
}

function normalizeResponseHeaders(
  value: unknown,
  location: string,
): readonly ContractResponseHeader[] {
  const headers = optionalRecord(value, location);
  if (headers === undefined) return [];

  return Object.entries(headers).map(([name, headerValue]) => {
    const header = asRecord(headerValue, `${location}.${name}`);
    if (header.schema === undefined) {
      throw new Error(`${location}.${name}.schema is required.`);
    }
    return {
      name,
      required: optionalBoolean(header.required, `${location}.${name}.required`) ?? false,
      type: normalizeContractType(header.schema, `${location}.${name}.schema`),
    };
  });
}

export function normalizeOperations(
  document: Record<string, unknown>,
  generatedModules: GeneratedApicalModules,
  securitySchemes: readonly ContractSecurityScheme[],
  globalSecurity: readonly ContractSecurityRequirement[],
  resolve: RefResolver["resolve"],
): readonly ContractOperation[] {
  const paths = asRecord(document.paths, "OpenAPI paths");
  const operations: ContractOperation[] = [];

  for (const [path, pathValue] of Object.entries(paths)) {
    const pathItem = resolve(pathValue, `OpenAPI paths.${path}`);

    for (const [method, operationValue] of Object.entries(pathItem)) {
      if (!httpMethods.has(method as ContractHttpMethod)) continue;

      const location = `OpenAPI paths.${path}.${method}`;
      const operation = asRecord(operationValue, location);
      const operationId = requiredString(operation.operationId, `${location}.operationId`);
      const modulePath = generatedModules.operations.get(operationId);
      if (modulePath === undefined) {
        throw new Error(
          `OpenAPI operation "${operationId}" has no matching entry in Apical routes/index.ts.`,
        );
      }
      if (operation.responses === undefined) {
        throw new Error(`${location}.responses is required.`);
      }

      const requestBody =
        operation.requestBody === undefined
          ? undefined
          : normalizeRequestBody(resolve, operation.requestBody, `${location}.requestBody`);
      const extension = readOperationExtension(operation, location);
      const summary = optionalString(operation.summary, `${location}.summary`);
      const security = resolveOperationSecurity({
        operationSecurity: operation.security,
        pathItemSecurity: pathItem.security,
        globalSecurity,
        schemes: securitySchemes,
      });
      validateEnforceableSecurity(operationId, security, securitySchemes);

      operations.push({
        operationId,
        method: method as ContractHttpMethod,
        path,
        modulePath,
        parameters: normalizeParameters(resolve, pathItem, operation, location),
        responses: normalizeResponses(resolve, operation.responses, `${location}.responses`),
        security,
        ...(requestBody === undefined ? {} : { requestBody }),
        ...(extension === undefined ? {} : { extension }),
        ...optionalDescription(operation, location),
        ...(summary === undefined ? {} : { summary }),
      });
    }
  }

  return operations;
}
