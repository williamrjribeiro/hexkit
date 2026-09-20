import type { StandardSchemaV1 } from "@standard-schema/spec";

import { createStandardSchemaValidationError, type StandardSchemaValidationError, validateStandardSchema } from "../standard-schema.ts";

import { serverRoute as uploadFileRouteMetadata } from "../routes/uploadFile.ts";

import type { uploadFileRouteResponse } from "../routes/uploadFile.ts";

import { uploadFileRequestMap } from "../routes/uploadFile.ts";

import { uploadFileResponseMap } from "../routes/uploadFile.ts";

import type { uploadFileServerParsedParamsType } from "../schemas/uploadFileParameters.ts";

type uploadFileValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type uploadFileParsedParams = uploadFileServerParsedParamsType & { body?: StandardSchemaV1.InferOutput<(typeof uploadFileRequestMap)[keyof typeof uploadFileRequestMap]> };

export type uploadFileHandler = (
  params: { isValid: true; value: uploadFileParsedParams } | uploadFileValidationError,
) => Promise<uploadFileRouteResponse>;

export function uploadFileWrapper(
  handler: uploadFileHandler,
) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: keyof uploadFileRequestMap;
  }): Promise<uploadFileRouteResponse> => {
  const queryParse = await validateStandardSchema(uploadFileRouteMetadata.params.shape.query, req.query);
  if (!queryParse.success) return handler({ kind: "query-error", error: queryParse.error, isValid: false });
  const pathParse = await validateStandardSchema(uploadFileRouteMetadata.params.shape.path, req.path);
  if (!pathParse.success) return handler({ kind: "path-error", error: pathParse.error, isValid: false });
  let parsedBody: StandardSchemaV1.InferOutput<(typeof uploadFileRequestMap)[keyof typeof uploadFileRequestMap]> | undefined = undefined;
  if (req.body !== undefined) {
    /* Content type must be provided for request body validation */
    if (!req.contentType) {
      return handler({ kind: "body-error", error: createStandardSchemaValidationError("Content-Type header is required"), isValid: false });
    }
    const schema = uploadFileRequestMap[req.contentType];
    if (schema) {
      const bodyParse = await validateStandardSchema(schema, req.body);
      if (!bodyParse.success) return handler({ kind: "body-error", error: bodyParse.error, isValid: false });
      parsedBody = bodyParse.value as StandardSchemaV1.InferOutput<(typeof uploadFileRequestMap)[keyof typeof uploadFileRequestMap]>;
    } else {
      /* Unknown content-type: reject */
      return handler({ kind: "body-error", error: createStandardSchemaValidationError(`Unsupported Content-Type: ${req.contentType}`), isValid: false });
    }
  }
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
    ...uploadFileRouteMetadata,
    wrapper: uploadFileWrapper,
  } as const;
}