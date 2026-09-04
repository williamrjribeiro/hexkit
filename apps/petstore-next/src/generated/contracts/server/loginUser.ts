import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as loginUserRouteMetadata } from "../routes/loginUser.ts";

import type { loginUserRouteResponse } from "../routes/loginUser.ts";

import { loginUserResponseMap } from "../routes/loginUser.ts";

import type { loginUserServerParsedParamsType } from "../schemas/loginUserParameters.ts";

type loginUserValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type loginUserParsedParams = loginUserServerParsedParamsType & { body?: undefined };

export type loginUserHandler = (
  params: { isValid: true; value: loginUserParsedParams } | loginUserValidationError,
) => Promise<loginUserRouteResponse>;

export function loginUserWrapper(
  handler: loginUserHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: string;
  }): Promise<loginUserRouteResponse> => {
  const queryParse = await validateStandardSchema(loginUserRouteMetadata.params.shape.query, req.query);
  if (!queryParse.success) return handler({ kind: "query-error", error: queryParse.error, isValid: false });
  let parsedBody: undefined | undefined = undefined;
  return handler({
    isValid: true,
    value: {
      query: queryParse.value,
      body: parsedBody
    },
  });
  };
}

export function route() {
  return {
    ...loginUserRouteMetadata,
    wrapper: loginUserWrapper,
  } as const;
}