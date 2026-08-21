import { toCamelCase } from "@hexkit/codegen";
import type { ContractOperation, ContractType } from "@hexkit/plugin-apical";

import type { ApplicationParameter, ResultCardinality } from "../artifact.ts";
import { isSuccessStatus } from "./aggregate.ts";
import { renderContractType } from "./type-render.ts";

export function deriveParameters(operation: ContractOperation): {
  parameters: ApplicationParameter[];
  referencedSchemas: readonly string[];
} {
  const unsupportedParameter = operation.parameters.find(
    (parameter) => parameter.location !== "path",
  );
  if (unsupportedParameter !== undefined) {
    throw new Error(
      `Operation "${operation.operationId}" declares unsupported ${unsupportedParameter.location} parameter "${unsupportedParameter.name}".`,
    );
  }

  const requestMedia = operation.requestBody?.media.find(
    (media) => media.mediaType === "application/json" && media.type !== undefined,
  );

  if (requestMedia?.type !== undefined) {
    if (requestMedia.type.kind === "reference") {
      return {
        parameters: [
          {
            name: toCamelCase(requestMedia.type.schema),
            typeExpression: requestMedia.type.schema,
          },
        ],
        referencedSchemas: [requestMedia.type.schema],
      };
    }

    const rendered = renderContractType(requestMedia.type);
    return {
      parameters: [
        {
          name: "body",
          typeExpression: rendered.expression,
        },
      ],
      referencedSchemas: [...rendered.referencedSchemas],
    };
  }

  if (operation.requestBody !== undefined) {
    throw new Error(
      `Operation "${operation.operationId}" declares an unsupported request body. Hexagonal generation supports application/json request bodies with a schema.`,
    );
  }

  const pathParameters = operation.parameters.filter((parameter) => parameter.location === "path");
  if (pathParameters.length === 0) return { parameters: [], referencedSchemas: [] };

  const renderedParameters = pathParameters.map((parameter) => {
    const rendered = renderContractType(parameter.type);
    return {
      parameter: {
        name: parameter.name,
        typeExpression: rendered.expression,
      },
      referencedSchemas: rendered.referencedSchemas,
    };
  });

  return {
    parameters: renderedParameters.map((entry) => entry.parameter),
    referencedSchemas: renderedParameters.flatMap((entry) => entry.referencedSchemas),
  };
}

export function deriveReturnType(operation: ContractOperation): {
  expression: string;
  referencedSchemas: readonly string[];
  resultCardinality: ResultCardinality;
} {
  const hasNotFound = operation.responses.some((response) => response.status === "404");
  const successResponses = operation.responses.filter((response) =>
    isSuccessStatus(response.status),
  );

  for (const response of successResponses) {
    const media = response.media.find(
      (entry) => entry.mediaType === "application/json" && entry.type !== undefined,
    );
    if (media?.type === undefined) continue;

    const rendered = renderTypeExpression(media.type);
    const resultCardinality: ResultCardinality = media.type.kind === "array" ? "many" : "one";
    return {
      expression: hasNotFound ? `${rendered.expression} | undefined` : rendered.expression,
      referencedSchemas: rendered.referencedSchemas,
      resultCardinality,
    };
  }

  return { expression: "void", referencedSchemas: [], resultCardinality: "void" };
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
