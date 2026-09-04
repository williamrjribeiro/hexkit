import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as deleteUserRouteMetadata } from "../routes/deleteUser.ts";

import type { deleteUserRouteResponse } from "../routes/deleteUser.ts";

import { deleteUserResponseMap } from "../routes/deleteUser.ts";

import type { deleteUserServerParsedParamsType } from "../schemas/deleteUserParameters.ts";

type deleteUserValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type deleteUserParsedParams = deleteUserServerParsedParamsType & { body?: undefined };

export type deleteUserHandler = (
  params: { isValid: true; value: deleteUserParsedParams } | deleteUserValidationError,
) => Promise<deleteUserRouteResponse>;

export function deleteUserWrapper(
  handler: deleteUserHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: string;
  }): Promise<deleteUserRouteResponse> => {
  const pathParse = await validateStandardSchema(deleteUserRouteMetadata.params.shape.path, req.path);
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
    ...deleteUserRouteMetadata,
    wrapper: deleteUserWrapper,
  } as const;
}