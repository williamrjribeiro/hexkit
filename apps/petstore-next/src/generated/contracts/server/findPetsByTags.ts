import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as findPetsByTagsRouteMetadata } from "../routes/findPetsByTags.ts";

import type { findPetsByTagsRouteResponse } from "../routes/findPetsByTags.ts";

import { findPetsByTagsResponseMap } from "../routes/findPetsByTags.ts";

import type { findPetsByTagsServerParsedParamsType } from "../schemas/findPetsByTagsParameters.ts";

type findPetsByTagsValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type findPetsByTagsParsedParams = findPetsByTagsServerParsedParamsType & { body?: undefined };

export type findPetsByTagsHandler = (
  params: { isValid: true; value: findPetsByTagsParsedParams } | findPetsByTagsValidationError,
) => Promise<findPetsByTagsRouteResponse>;

export function findPetsByTagsWrapper(
  handler: findPetsByTagsHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: string;
  }): Promise<findPetsByTagsRouteResponse> => {
  const queryParse = await validateStandardSchema(findPetsByTagsRouteMetadata.params.shape.query, req.query);
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
    ...findPetsByTagsRouteMetadata,
    wrapper: findPetsByTagsWrapper,
  } as const;
}