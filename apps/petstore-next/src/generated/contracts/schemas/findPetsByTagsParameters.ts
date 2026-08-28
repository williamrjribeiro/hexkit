import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const findPetsByTagsQuerySchema = z.object({ "tags": z.array(z.string()) });

/* Server parameter schemas with coercion and lowercase headers */
const findPetsByTagsServerQuerySchema = z.object({ "tags": z.array(z.string()) });

/* Export schemas for external use */
export { findPetsByTagsQuerySchema };

/* Export server schemas */
export { findPetsByTagsServerQuerySchema };

/* Export types for external use */
export type findPetsByTagsQuerySchema = StandardSchemaV1.InferOutput<typeof findPetsByTagsQuerySchema>;

/* Combined parsed parameters object */
export const findPetsByTagsParsedParams = z.object({
  query: findPetsByTagsQuerySchema
});

/* Combined parsed parameters type */
export type findPetsByTagsParsedParamsType = StandardSchemaV1.InferOutput<typeof findPetsByTagsParsedParams>;

/* Combined server parsed parameters object */
export const findPetsByTagsServerParsedParams = z.object({
  query: findPetsByTagsServerQuerySchema
});

/* Combined server parsed parameters type */
export type findPetsByTagsServerParsedParamsType = StandardSchemaV1.InferOutput<typeof findPetsByTagsServerParsedParams>;
