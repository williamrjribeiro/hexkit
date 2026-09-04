import { toCamelCase, unique } from "@hexkit/codegen";
import type { ContractOperation, ContractParameter, ContractType } from "@hexkit/plugin-apical";
import { findJsonMedia, isSuccessStatus } from "@hexkit/shared";

import type { ApplicationParameter, ResultCardinality } from "../artifact.ts";
import { renderContractType } from "./type-render.ts";

export function deriveParameters(operation: ContractOperation): {
  parameters: ApplicationParameter[];
  referencedSchemas: readonly string[];
} {
  const unsupportedParameter = operation.parameters.find(
    (parameter) => parameter.location === "header" || parameter.location === "cookie",
  );
  if (unsupportedParameter !== undefined) {
    throw new Error(
      `Operation "${operation.operationId}" declares unsupported ${unsupportedParameter.location} parameter "${unsupportedParameter.name}".`,
    );
  }

  const requestMedia = findJsonMedia(operation.requestBody?.media);

  if (operation.requestBody !== undefined && requestMedia?.type === undefined) {
    throw new Error(
      `Operation "${operation.operationId}" declares an unsupported request body. Hexagonal generation supports application/json request bodies with a schema.`,
    );
  }

  const pathParameters = operation.parameters.filter((parameter) => parameter.location === "path");
  const queryParameters = operation.parameters.filter(
    (parameter) => parameter.location === "query",
  );
  const renderedPathAndQuery = [...pathParameters, ...queryParameters].map((parameter) =>
    renderOperationParameter(parameter),
  );

  const body = deriveBodyParameter(requestMedia?.type);
  const parameters = [
    ...renderedPathAndQuery.map((entry) => entry.parameter),
    ...(body === undefined ? [] : [body.parameter]),
  ];

  if (parameters.length === 0) {
    return { parameters: [], referencedSchemas: [] };
  }

  return {
    parameters,
    referencedSchemas: unique([
      ...renderedPathAndQuery.flatMap((entry) => entry.referencedSchemas),
      ...(body?.referencedSchemas ?? []),
    ]),
  };
}

function deriveBodyParameter(type: ContractType | undefined):
  | {
      parameter: ApplicationParameter;
      referencedSchemas: readonly string[];
    }
  | undefined {
  if (type === undefined) return undefined;

  if (type.kind === "reference") {
    return {
      parameter: {
        name: toCamelCase(type.schema),
        typeExpression: type.schema,
      },
      referencedSchemas: [type.schema],
    };
  }

  const rendered = renderContractType(type);
  return {
    parameter: {
      name: "body",
      typeExpression: rendered.expression,
    },
    referencedSchemas: [...rendered.referencedSchemas],
  };
}

function renderOperationParameter(parameter: ContractParameter): {
  parameter: ApplicationParameter;
  referencedSchemas: readonly string[];
} {
  const rendered = renderContractType(parameter.type);
  const typeExpression = parameter.required
    ? rendered.expression
    : `${rendered.expression} | undefined`;
  return {
    parameter: {
      name: parameter.name,
      typeExpression,
      location: parameter.location === "query" ? "query" : "path",
    },
    referencedSchemas: rendered.referencedSchemas,
  };
}

export function deriveReturnType(operation: ContractOperation): {
  expression: string;
  payloadExpression: string;
  successHeaders: readonly { name: string; typeExpression: string }[];
  referencedSchemas: readonly string[];
  resultCardinality: ResultCardinality;
} {
  const hasNotFound = operation.responses.some((response) => response.status === "404");
  const successResponses = operation.responses.filter((response) =>
    isSuccessStatus(response.status),
  );

  for (const response of successResponses) {
    const media = findJsonMedia(response.media);
    if (media?.type === undefined) continue;

    const rendered = renderTypeExpression(media.type);
    const resultCardinality: ResultCardinality = media.type.kind === "array" ? "many" : "one";
    const successHeaders = renderSuccessHeaders(response.headers ?? []);
    const payloadExpression = hasNotFound
      ? `${rendered.expression} | undefined`
      : rendered.expression;
    return {
      expression: wrapReturnExpression(rendered.expression, successHeaders, hasNotFound),
      payloadExpression,
      successHeaders,
      referencedSchemas: rendered.referencedSchemas,
      resultCardinality,
    };
  }

  if (hasNotFound) {
    return {
      expression: "boolean",
      payloadExpression: "boolean",
      successHeaders: [],
      referencedSchemas: [],
      resultCardinality: "one",
    };
  }

  return {
    expression: "void",
    payloadExpression: "void",
    successHeaders: [],
    referencedSchemas: [],
    resultCardinality: "void",
  };
}

function renderSuccessHeaders(
  headers: readonly { name: string; type: ContractType }[],
): readonly { name: string; typeExpression: string }[] {
  return headers.map((header) => ({
    // Apical Craft lowercases response header keys in generated TypeScript types.
    name: header.name.toLowerCase(),
    typeExpression: renderContractType(header.type).expression,
  }));
}

function wrapReturnExpression(
  innerExpression: string,
  successHeaders: readonly { name: string; typeExpression: string }[],
  hasNotFound: boolean,
): string {
  if (successHeaders.length === 0) {
    return hasNotFound ? `${innerExpression} | undefined` : innerExpression;
  }

  const headerFields = successHeaders
    .map((header) => `${JSON.stringify(header.name)}: ${header.typeExpression}`)
    .join("; ");
  const envelope = `{ data: ${innerExpression}; headers: { ${headerFields} } }`;
  return hasNotFound ? `${envelope} | undefined` : envelope;
}

function renderTypeExpression(type: ContractType): {
  expression: string;
  referencedSchemas: readonly string[];
} {
  const rendered = renderContractType(type);
  return {
    expression: rendered.expression,
    referencedSchemas: rendered.referencedSchemas,
  };
}
