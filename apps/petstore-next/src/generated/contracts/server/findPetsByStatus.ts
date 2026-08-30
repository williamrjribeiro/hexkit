import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as findPetsByStatusRouteMetadata } from "../routes/findPetsByStatus.ts";

import type { findPetsByStatusRouteResponse } from "../routes/findPetsByStatus.ts";

import { findPetsByStatusResponseMap } from "../routes/findPetsByStatus.ts";

import type { findPetsByStatusServerParsedParamsType } from "../schemas/findPetsByStatusParameters.ts";

type findPetsByStatusValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type findPetsByStatusParsedParams = findPetsByStatusServerParsedParamsType & { body?: undefined };

export type findPetsByStatusHandler = (
  params: { isValid: true; value: findPetsByStatusParsedParams } | findPetsByStatusValidationError,
) => Promise<findPetsByStatusRouteResponse>;

export function findPetsByStatusWrapper(
  handler: findPetsByStatusHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: string;
  }): Promise<findPetsByStatusRouteResponse> => {
  const queryParse = await validateStandardSchema(findPetsByStatusRouteMetadata.params.shape.query, req.query);
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
    ...findPetsByStatusRouteMetadata,
    wrapper: findPetsByStatusWrapper,
  } as const;
}