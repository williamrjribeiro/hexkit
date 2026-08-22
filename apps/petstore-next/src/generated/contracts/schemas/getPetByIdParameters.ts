import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const getPetByIdPathSchema = z.object({ "petId": z.number().int() });
const getPetByIdHeadersSchema = z.object({ "api_key": z.string() });

/* Server parameter schemas with coercion and lowercase headers */
const getPetByIdServerPathSchema = z.object({ "petId": z.coerce.number().int() });
const getPetByIdServerHeadersSchema = z.object({ "api_key": z.string() });

/* Export schemas for external use */
export { getPetByIdPathSchema };
export { getPetByIdHeadersSchema };

/* Export server schemas */
export { getPetByIdServerPathSchema };
export { getPetByIdServerHeadersSchema };

/* Export types for external use */
export type getPetByIdPathSchema = StandardSchemaV1.InferOutput<typeof getPetByIdPathSchema>;
export type getPetByIdHeadersSchema = StandardSchemaV1.InferOutput<typeof getPetByIdHeadersSchema>;

/* Combined parsed parameters object */
export const getPetByIdParsedParams = z.object({
  path: getPetByIdPathSchema,
  headers: getPetByIdHeadersSchema
});

/* Combined parsed parameters type */
export type getPetByIdParsedParamsType = StandardSchemaV1.InferOutput<typeof getPetByIdParsedParams>;

/* Combined server parsed parameters object */
export const getPetByIdServerParsedParams = z.object({
  path: getPetByIdServerPathSchema,
  headers: getPetByIdServerHeadersSchema
});

/* Combined server parsed parameters type */
export type getPetByIdServerParsedParamsType = StandardSchemaV1.InferOutput<typeof getPetByIdServerParsedParams>;
