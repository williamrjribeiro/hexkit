import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as createUserRouteMetadata } from "../routes/createUser.ts";

import type { createUserRouteResponse } from "../routes/createUser.ts";

import { createUserRequestMap } from "../routes/createUser.ts";

import { createUserResponseMap } from "../routes/createUser.ts";

type createUserValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type createUserParsedParams = { body?: StandardSchemaV1.InferOutput<(typeof createUserRequestMap)[keyof typeof createUserRequestMap]> };

export type createUserHandler = (
  params: { isValid: true; value: createUserParsedParams } | createUserValidationError,
) => Promise<createUserRouteResponse>;

export function createUserWrapper(
  handler: createUserHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: keyof createUserRequestMap;
  }): Promise<createUserRouteResponse> => {

  let parsedBody: StandardSchemaV1.InferOutput<(typeof createUserRequestMap)[keyof typeof createUserRequestMap]> | undefined = undefined;
  if (req.body !== undefined) {
    /* Content type must be provided for request body validation */
    if (!req.contentType) {
      return handler({ kind: "body-error", error: createStandardSchemaValidationError("Content-Type header is required"), isValid: false });
    }
    const schema = createUserRequestMap[req.contentType];
    if (schema) {
      const bodyParse = await validateStandardSchema(schema, req.body);
      if (!bodyParse.success) return handler({ kind: "body-error", error: bodyParse.error, isValid: false });
      parsedBody = bodyParse.value as StandardSchemaV1.InferOutput<(typeof createUserRequestMap)[keyof typeof createUserRequestMap]>;
    } else {
      /* Unknown content-type: reject */
      return handler({ kind: "body-error", error: createStandardSchemaValidationError(`Unsupported Content-Type: ${req.contentType}`), isValid: false });
    }
  }
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
    ...createUserRouteMetadata,
    wrapper: createUserWrapper,
  } as const;
}