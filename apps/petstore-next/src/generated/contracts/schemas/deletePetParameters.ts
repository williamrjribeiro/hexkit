import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const deletePetPathSchema = z.object({ petId: z.number().int() });

/* Server parameter schemas with coercion and lowercase headers */
const deletePetServerPathSchema = z.object({ petId: z.coerce.number().int() });

/* Export schemas for external use */
export { deletePetPathSchema };

/* Export server schemas */
export { deletePetServerPathSchema };

/* Export types for external use */
export type deletePetPathSchema = StandardSchemaV1.InferOutput<typeof deletePetPathSchema>;

/* Combined parsed parameters object */
export const deletePetParsedParams = z.object({
  path: deletePetPathSchema,
});

/* Combined parsed parameters type */
export type deletePetParsedParamsType = StandardSchemaV1.InferOutput<typeof deletePetParsedParams>;

/* Combined server parsed parameters object */
export const deletePetServerParsedParams = z.object({
  path: deletePetServerPathSchema,
});

/* Combined server parsed parameters type */
export type deletePetServerParsedParamsType = StandardSchemaV1.InferOutput<
  typeof deletePetServerParsedParams
>;
