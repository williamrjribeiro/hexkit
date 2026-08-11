import type { StandardSchemaV1 } from "@standard-schema/spec";

import {
  createStandardSchemaValidationError,
  type StandardSchemaValidationError,
  validateStandardSchema,
} from "../standard-schema.ts";

import { serverRoute as placeOrderRouteMetadata } from "../routes/placeOrder.ts";

import type { placeOrderRouteResponse } from "../routes/placeOrder.ts";

import { placeOrderRequestMap } from "../routes/placeOrder.ts";

import { placeOrderResponseMap } from "../routes/placeOrder.ts";

type placeOrderValidationError =
  | { kind: "query-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "path-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "headers-error"; error: StandardSchemaValidationError; isValid: false }
  | { kind: "body-error"; error: StandardSchemaValidationError; isValid: false };

type placeOrderParsedParams = {
  body?: StandardSchemaV1.InferOutput<
    (typeof placeOrderRequestMap)[keyof typeof placeOrderRequestMap]
  >;
};

export type placeOrderHandler = (
  params: { isValid: true; value: placeOrderParsedParams } | placeOrderValidationError,
) => Promise<placeOrderRouteResponse>;

export function placeOrderWrapper(handler: placeOrderHandler) {
  return async (req: {
    query: unknown;
    path: unknown;
    headers: unknown;
    body?: unknown;
    contentType?: keyof placeOrderRequestMap;
  }): Promise<placeOrderRouteResponse> => {
    let parsedBody:
      | StandardSchemaV1.InferOutput<
          (typeof placeOrderRequestMap)[keyof typeof placeOrderRequestMap]
        >
      | undefined = undefined;
    if (req.body !== undefined) {
      /* Content type must be provided for request body validation */
      if (!req.contentType) {
        return handler({
          kind: "body-error",
          error: createStandardSchemaValidationError("Content-Type header is required"),
          isValid: false,
        });
      }
      const schema = placeOrderRequestMap[req.contentType];
      if (schema) {
        const bodyParse = await validateStandardSchema(schema, req.body);
        if (!bodyParse.success)
          return handler({ kind: "body-error", error: bodyParse.error, isValid: false });
        parsedBody = bodyParse.value as StandardSchemaV1.InferOutput<
          (typeof placeOrderRequestMap)[keyof typeof placeOrderRequestMap]
        >;
      } else {
        /* Unknown content-type: reject */
        return handler({
          kind: "body-error",
          error: createStandardSchemaValidationError(
            `Unsupported Content-Type: ${req.contentType}`,
          ),
          isValid: false,
        });
      }
    }
    return handler({
      isValid: true,
      value: {
        body: parsedBody,
      },
    });
  };
}

export function route() {
  return {
    ...placeOrderRouteMetadata,
    wrapper: placeOrderWrapper,
  } as const;
}
