import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as createUsersWithListInputRouteMetadata } from "../routes/createUsersWithListInput.ts";

import type { createUsersWithListInputRouteResponse } from "../routes/createUsersWithListInput.ts";

import { createUsersWithListInputRequestMap } from "../routes/createUsersWithListInput.ts";

import { createUsersWithListInputResponseMap } from "../routes/createUsersWithListInput.ts";

type createUsersWithListInputValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type createUsersWithListInputParsedParams = { body?: StandardSchemaV1.InferOutput<(typeof createUsersWithListInputRequestMap)[keyof typeof createUsersWithListInputRequestMap]> };

export type createUsersWithListInputHandler = (
  params: { isValid: true; value: createUsersWithListInputParsedParams } | createUsersWithListInputValidationError,
) => Promise<createUsersWithListInputRouteResponse>;

export function createUsersWithListInputWrapper(
  handler: createUsersWithListInputHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: keyof createUsersWithListInputRequestMap;
  }): Promise<createUsersWithListInputRouteResponse> => {

  let parsedBody: StandardSchemaV1.InferOutput<(typeof createUsersWithListInputRequestMap)[keyof typeof createUsersWithListInputRequestMap]> | undefined = undefined;
  if (req.body !== undefined) {
    /* Content type must be provided for request body validation */
    if (!req.contentType) {
      return handler({ kind: "body-error", error: createStandardSchemaValidationError("Content-Type header is required"), isValid: false });
    }
    const schema = createUsersWithListInputRequestMap[req.contentType];
    if (schema) {
      const bodyParse = await validateStandardSchema(schema, req.body);
      if (!bodyParse.success) return handler({ kind: "body-error", error: bodyParse.error, isValid: false });
      parsedBody = bodyParse.value as StandardSchemaV1.InferOutput<(typeof createUsersWithListInputRequestMap)[keyof typeof createUsersWithListInputRequestMap]>;
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
    ...createUsersWithListInputRouteMetadata,
    wrapper: createUsersWithListInputWrapper,
  } as const;
}