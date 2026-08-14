import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const deleteOrderPathSchema = z.object({ "orderId": z.number().int() });

/* Server parameter schemas with coercion and lowercase headers */
const deleteOrderServerPathSchema = z.object({ "orderId": z.coerce.number().int() });

/* Export schemas for external use */
export { deleteOrderPathSchema };

/* Export server schemas */
export { deleteOrderServerPathSchema };

/* Export types for external use */
export type deleteOrderPathSchema = StandardSchemaV1.InferOutput<typeof deleteOrderPathSchema>;

/* Combined parsed parameters object */
export const deleteOrderParsedParams = z.object({
  path: deleteOrderPathSchema
});

/* Combined parsed parameters type */
export type deleteOrderParsedParamsType = StandardSchemaV1.InferOutput<typeof deleteOrderParsedParams>;

/* Combined server parsed parameters object */
export const deleteOrderServerParsedParams = z.object({
  path: deleteOrderServerPathSchema
});

/* Combined server parsed parameters type */
export type deleteOrderServerParsedParamsType = StandardSchemaV1.InferOutput<typeof deleteOrderServerParsedParams>;
