import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as updateUserRouteMetadata } from "../routes/updateUser.ts";

import type { updateUserRouteResponse } from "../routes/updateUser.ts";

import { updateUserRequestMap } from "../routes/updateUser.ts";

import { updateUserResponseMap } from "../routes/updateUser.ts";

import type { updateUserServerParsedParamsType } from "../schemas/updateUserParameters.ts";

type updateUserValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type updateUserParsedParams = updateUserServerParsedParamsType & { body?: StandardSchemaV1.InferOutput<(typeof updateUserRequestMap)[keyof typeof updateUserRequestMap]> };

export type updateUserHandler = (
  params: { isValid: true; value: updateUserParsedParams } | updateUserValidationError,
) => Promise<updateUserRouteResponse>;

export function updateUserWrapper(
  handler: updateUserHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: keyof updateUserRequestMap;
  }): Promise<updateUserRouteResponse> => {
  const pathParse = await validateStandardSchema(updateUserRouteMetadata.params.shape.path, req.path);
  if (!pathParse.success) return handler({ kind: "path-error", error: pathParse.error, isValid: false });
  let parsedBody: StandardSchemaV1.InferOutput<(typeof updateUserRequestMap)[keyof typeof updateUserRequestMap]> | undefined = undefined;
  if (req.body !== undefined) {
    /* Content type must be provided for request body validation */
    if (!req.contentType) {
      return handler({ kind: "body-error", error: createStandardSchemaValidationError("Content-Type header is required"), isValid: false });
    }
    const schema = updateUserRequestMap[req.contentType];
    if (schema) {
      const bodyParse = await validateStandardSchema(schema, req.body);
      if (!bodyParse.success) return handler({ kind: "body-error", error: bodyParse.error, isValid: false });
      parsedBody = bodyParse.value as StandardSchemaV1.InferOutput<(typeof updateUserRequestMap)[keyof typeof updateUserRequestMap]>;
    } else {
      /* Unknown content-type: reject */
      return handler({ kind: "body-error", error: createStandardSchemaValidationError(`Unsupported Content-Type: ${req.contentType}`), isValid: false });
    }
  }
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
    ...updateUserRouteMetadata,
    wrapper: updateUserWrapper,
  } as const;
}