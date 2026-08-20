import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as deletePetRouteMetadata } from "../routes/deletePet.ts";

import type { deletePetRouteResponse } from "../routes/deletePet.ts";

import { deletePetResponseMap } from "../routes/deletePet.ts";

import type { deletePetServerParsedParamsType } from "../schemas/deletePetParameters.ts";

type deletePetValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type deletePetParsedParams = deletePetServerParsedParamsType & { body?: undefined };

export type deletePetHandler = (
  params: { isValid: true; value: deletePetParsedParams } | deletePetValidationError,
) => Promise<deletePetRouteResponse>;

export function deletePetWrapper(
  handler: deletePetHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: string;
  }): Promise<deletePetRouteResponse> => {
  const pathParse = await validateStandardSchema(deletePetRouteMetadata.params.shape.path, req.path);
  if (!pathParse.success) return handler({ kind: "path-error", error: pathParse.error, isValid: false });
  let parsedBody: undefined   = undefined;
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
    ...deletePetRouteMetadata,
    wrapper: deletePetWrapper,
  } as const;
}