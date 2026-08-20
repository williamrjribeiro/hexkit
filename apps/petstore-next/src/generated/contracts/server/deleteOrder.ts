import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as deleteOrderRouteMetadata } from "../routes/deleteOrder.ts";

import type { deleteOrderRouteResponse } from "../routes/deleteOrder.ts";

import { deleteOrderResponseMap } from "../routes/deleteOrder.ts";

import type { deleteOrderServerParsedParamsType } from "../schemas/deleteOrderParameters.ts";

type deleteOrderValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type deleteOrderParsedParams = deleteOrderServerParsedParamsType & { body?: undefined };

export type deleteOrderHandler = (
  params: { isValid: true; value: deleteOrderParsedParams } | deleteOrderValidationError,
) => Promise<deleteOrderRouteResponse>;

export function deleteOrderWrapper(
  handler: deleteOrderHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: string;
  }): Promise<deleteOrderRouteResponse> => {
  const pathParse = await validateStandardSchema(deleteOrderRouteMetadata.params.shape.path, req.path);
  if (!pathParse.success) return handler({ kind: "path-error", error: pathParse.error, isValid: false });
  let parsedBody: undefined   = undefined;
  return handler({
    isValid: true,
    value: {
      path: pathParse.value,
      body: parsedBody
    },
  });
  };
}

export function route() {
  return {
    ...deleteOrderRouteMetadata,
    wrapper: deleteOrderWrapper,
  } as const;
}