import type { StandardSchemaV1 } from "@standard-schema/spec";

import {
  createStandardSchemaValidationError,
  type StandardSchemaValidationError,
  validateStandardSchema,
} from "../standard-schema.ts";

import { serverRoute as getOrderByIdRouteMetadata } from "../routes/getOrderById.ts";

import type { getOrderByIdRouteResponse } from "../routes/getOrderById.ts";

import { getOrderByIdResponseMap } from "../routes/getOrderById.ts";

import type { getOrderByIdServerParsedParamsType } from "../schemas/getOrderByIdParameters.ts";

type getOrderByIdValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type getOrderByIdParsedParams = getOrderByIdServerParsedParamsType & { body?: undefined };

export type getOrderByIdHandler = (
  params: { isValid: true; value: getOrderByIdParsedParams } | getOrderByIdValidationError,
) => Promise<getOrderByIdRouteResponse>;

export function getOrderByIdWrapper(handler: getOrderByIdHandler) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: string;
  }): Promise<getOrderByIdRouteResponse> => {
    const pathParse = await validateStandardSchema(
      getOrderByIdRouteMetadata.params.shape.path,
      req.path,
    );
    if (!pathParse.success)
      return handler({ kind: "path-error", error: pathParse.error, isValid: false });
    let parsedBody: undefined = undefined;
    return handler({
      isValid: true,
      value: {
        path: pathParse.value,
        body: parsedBody,
      },
    });
  };
}

export function route() {
  return {
    ...getOrderByIdRouteMetadata,
    wrapper: getOrderByIdWrapper,
  } as const;
}
