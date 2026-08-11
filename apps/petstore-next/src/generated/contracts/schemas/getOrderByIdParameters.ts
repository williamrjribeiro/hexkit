import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const getOrderByIdPathSchema = z.object({ orderId: z.number().int() });

/* Server parameter schemas with coercion and lowercase headers */
const getOrderByIdServerPathSchema = z.object({ orderId: z.coerce.number().int() });

/* Export schemas for external use */
export { getOrderByIdPathSchema };

/* Export server schemas */
export { getOrderByIdServerPathSchema };

/* Export types for external use */
export type getOrderByIdPathSchema = StandardSchemaV1.InferOutput<typeof getOrderByIdPathSchema>;

/* Combined parsed parameters object */
export const getOrderByIdParsedParams = z.object({
  path: getOrderByIdPathSchema,
});

/* Combined parsed parameters type */
export type getOrderByIdParsedParamsType = StandardSchemaV1.InferOutput<
  typeof getOrderByIdParsedParams
>;

/* Combined server parsed parameters object */
export const getOrderByIdServerParsedParams = z.object({
  path: getOrderByIdServerPathSchema,
});

/* Combined server parsed parameters type */
export type getOrderByIdServerParsedParamsType = StandardSchemaV1.InferOutput<
  typeof getOrderByIdServerParsedParams
>;
