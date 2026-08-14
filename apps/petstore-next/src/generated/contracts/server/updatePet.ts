import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as updatePetRouteMetadata } from "../routes/updatePet.ts";

import type { updatePetRouteResponse } from "../routes/updatePet.ts";

import { updatePetRequestMap } from "../routes/updatePet.ts";

import { updatePetResponseMap } from "../routes/updatePet.ts";

type updatePetValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type updatePetParsedParams = { body?: StandardSchemaV1.InferOutput<(typeof updatePetRequestMap)[keyof typeof updatePetRequestMap]> };

export type updatePetHandler = (
  params: { isValid: true; value: updatePetParsedParams } | updatePetValidationError,
) => Promise<updatePetRouteResponse>;

export function updatePetWrapper(
  handler: updatePetHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: keyof updatePetRequestMap;
  }): Promise<updatePetRouteResponse> => {

  let parsedBody: StandardSchemaV1.InferOutput<(typeof updatePetRequestMap)[keyof typeof updatePetRequestMap]> | undefined = undefined;
  if (req.body !== undefined) {
    /* Content type must be provided for request body validation */
    if (!req.contentType) {
      return handler({ kind: "body-error", error: createStandardSchemaValidationError("Content-Type header is required"), isValid: false });
    }
    const schema = updatePetRequestMap[req.contentType];
    if (schema) {
      const bodyParse = await validateStandardSchema(schema, req.body);
      if (!bodyParse.success) return handler({ kind: "body-error", error: bodyParse.error, isValid: false });
      parsedBody = bodyParse.value as StandardSchemaV1.InferOutput<(typeof updatePetRequestMap)[keyof typeof updatePetRequestMap]>;
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
    ...updatePetRouteMetadata,
    wrapper: updatePetWrapper,
  } as const;
}