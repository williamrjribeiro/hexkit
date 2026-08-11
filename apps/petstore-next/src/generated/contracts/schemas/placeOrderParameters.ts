import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */

/* Combined parsed parameters object */
export const placeOrderParsedParams = z.object({});

/* Combined parsed parameters type */
export type placeOrderParsedParamsType = StandardSchemaV1.InferOutput<
  typeof placeOrderParsedParams
>;

/* Combined server parsed parameters object */
export const placeOrderServerParsedParams = z.object({});

/* Combined server parsed parameters type */
export type placeOrderServerParsedParamsType = StandardSchemaV1.InferOutput<
  typeof placeOrderServerParsedParams
>;
