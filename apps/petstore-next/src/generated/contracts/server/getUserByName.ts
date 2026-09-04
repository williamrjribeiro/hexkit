import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as getUserByNameRouteMetadata } from "../routes/getUserByName.ts";

import type { getUserByNameRouteResponse } from "../routes/getUserByName.ts";

import { getUserByNameResponseMap } from "../routes/getUserByName.ts";

import type { getUserByNameServerParsedParamsType } from "../schemas/getUserByNameParameters.ts";

type getUserByNameValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type getUserByNameParsedParams = getUserByNameServerParsedParamsType & { body?: undefined };

export type getUserByNameHandler = (
  params: { isValid: true; value: getUserByNameParsedParams } | getUserByNameValidationError,
) => Promise<getUserByNameRouteResponse>;

export function getUserByNameWrapper(
  handler: getUserByNameHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: string;
  }): Promise<getUserByNameRouteResponse> => {
  const pathParse = await validateStandardSchema(getUserByNameRouteMetadata.params.shape.path, req.path);
  if (!pathParse.success) return handler({ kind: "path-error", error: pathParse.error, isValid: false });
  let parsedBody: undefined | undefined = undefined;
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
    ...getUserByNameRouteMetadata,
    wrapper: getUserByNameWrapper,
  } as const;
}