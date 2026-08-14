import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as addPetRouteMetadata } from "../routes/addPet.ts";

import type { addPetRouteResponse } from "../routes/addPet.ts";

import { addPetRequestMap } from "../routes/addPet.ts";

import { addPetResponseMap } from "../routes/addPet.ts";

type addPetValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type addPetParsedParams = { body?: StandardSchemaV1.InferOutput<(typeof addPetRequestMap)[keyof typeof addPetRequestMap]> };

export type addPetHandler = (
  params: { isValid: true; value: addPetParsedParams } | addPetValidationError,
) => Promise<addPetRouteResponse>;

export function addPetWrapper(
  handler: addPetHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: keyof addPetRequestMap;
  }): Promise<addPetRouteResponse> => {

  let parsedBody: StandardSchemaV1.InferOutput<(typeof addPetRequestMap)[keyof typeof addPetRequestMap]> | undefined = undefined;
  if (req.body !== undefined) {
    /* Content type must be provided for request body validation */
    if (!req.contentType) {
      return handler({ kind: "body-error", error: createStandardSchemaValidationError("Content-Type header is required"), isValid: false });
    }
    const schema = addPetRequestMap[req.contentType];
    if (schema) {
      const bodyParse = await validateStandardSchema(schema, req.body);
      if (!bodyParse.success) return handler({ kind: "body-error", error: bodyParse.error, isValid: false });
      parsedBody = bodyParse.value as StandardSchemaV1.InferOutput<(typeof addPetRequestMap)[keyof typeof addPetRequestMap]>;
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
    ...addPetRouteMetadata,
    wrapper: addPetWrapper,
  } as const;
}