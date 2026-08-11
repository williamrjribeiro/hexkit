import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const getPetByIdPathSchema = z.object({ "petId": z.number().int() });

/* Server parameter schemas with coercion and lowercase headers */
const getPetByIdServerPathSchema = z.object({ "petId": z.coerce.number().int() });

/* Export schemas for external use */
export { getPetByIdPathSchema };

/* Export server schemas */
export { getPetByIdServerPathSchema };

/* Export types for external use */
export type getPetByIdPathSchema = StandardSchemaV1.InferOutput<typeof getPetByIdPathSchema>;

/* Combined parsed parameters object */
export const getPetByIdParsedParams = z.object({
  path: getPetByIdPathSchema
});

/* Combined parsed parameters type */
export type getPetByIdParsedParamsType = StandardSchemaV1.InferOutput<typeof getPetByIdParsedParams>;

/* Combined server parsed parameters object */
export const getPetByIdServerParsedParams = z.object({
  path: getPetByIdServerPathSchema
});

/* Combined server parsed parameters type */
export type getPetByIdServerParsedParamsType = StandardSchemaV1.InferOutput<typeof getPetByIdServerParsedParams>;
