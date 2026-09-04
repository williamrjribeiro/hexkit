import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as logoutUserRouteMetadata } from "../routes/logoutUser.ts";

import type { logoutUserRouteResponse } from "../routes/logoutUser.ts";

import { logoutUserResponseMap } from "../routes/logoutUser.ts";

type logoutUserValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type logoutUserParsedParams = { body?: undefined };

export type logoutUserHandler = (
  params: { isValid: true; value: logoutUserParsedParams } | logoutUserValidationError,
) => Promise<logoutUserRouteResponse>;

export function logoutUserWrapper(
  handler: logoutUserHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: string;
  }): Promise<logoutUserRouteResponse> => {

  let parsedBody: undefined | undefined = undefined;
  return handler({
    isValid: true,
    value: {
      body: parsedBody
    },
  });
  };
}

export function route() {
  return {
    ...logoutUserRouteMetadata,
    wrapper: logoutUserWrapper,
  } as const;
}