import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as getPetByIdRouteMetadata } from "../routes/getPetById.ts";

import type { getPetByIdRouteResponse } from "../routes/getPetById.ts";

import { getPetByIdResponseMap } from "../routes/getPetById.ts";

import type { getPetByIdServerParsedParamsType } from "../schemas/getPetByIdParameters.ts";

type getPetByIdValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type getPetByIdParsedParams = getPetByIdServerParsedParamsType & { body?: undefined };

export type getPetByIdHandler = (
  params: { isValid: true; value: getPetByIdParsedParams } | getPetByIdValidationError,
) => Promise<getPetByIdRouteResponse>;

export function getPetByIdWrapper(
  handler: getPetByIdHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: string;
  }): Promise<getPetByIdRouteResponse> => {
  const pathParse = await validateStandardSchema(getPetByIdRouteMetadata.params.shape.path, req.path);
  if (!pathParse.success) return handler({ kind: "path-error", error: pathParse.error, isValid: false });
  const headersParse = await validateStandardSchema(getPetByIdRouteMetadata.params.shape.headers, req.headers);
  if (!headersParse.success) return handler({ kind: "headers-error", error: headersParse.error, isValid: false });
  let parsedBody: undefined | undefined = undefined;
  return handler({
    isValid: true,
    value: {
      path: pathParse.value,
      headers: headersParse.value,
      body: parsedBody
    },
  });
  };
}

export function route() {
  return {
    ...getPetByIdRouteMetadata,
    wrapper: getPetByIdWrapper,
  } as const;
}