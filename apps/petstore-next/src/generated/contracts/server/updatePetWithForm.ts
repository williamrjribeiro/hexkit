import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as updatePetWithFormRouteMetadata } from "../routes/updatePetWithForm.ts";

import type { updatePetWithFormRouteResponse } from "../routes/updatePetWithForm.ts";

import { updatePetWithFormResponseMap } from "../routes/updatePetWithForm.ts";

import type { updatePetWithFormServerParsedParamsType } from "../schemas/updatePetWithFormParameters.ts";

type updatePetWithFormValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type updatePetWithFormParsedParams = updatePetWithFormServerParsedParamsType & { body?: undefined };

export type updatePetWithFormHandler = (
  params: { isValid: true; value: updatePetWithFormParsedParams } | updatePetWithFormValidationError,
) => Promise<updatePetWithFormRouteResponse>;

export function updatePetWithFormWrapper(
  handler: updatePetWithFormHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: string;
  }): Promise<updatePetWithFormRouteResponse> => {
  const queryParse = await validateStandardSchema(updatePetWithFormRouteMetadata.params.shape.query, req.query);
  if (!queryParse.success) return handler({ kind: "query-error", error: queryParse.error, isValid: false });
  const pathParse = await validateStandardSchema(updatePetWithFormRouteMetadata.params.shape.path, req.path);
  if (!pathParse.success) return handler({ kind: "path-error", error: pathParse.error, isValid: false });
  let parsedBody: undefined | undefined = undefined;
  return handler({
    isValid: true,
    value: {
      query: queryParse.value,
      path: pathParse.value,
      body: parsedBody
    },
  });
  };
}

export function route() {
  return {
    ...updatePetWithFormRouteMetadata,
    wrapper: updatePetWithFormWrapper,
  } as const;
}