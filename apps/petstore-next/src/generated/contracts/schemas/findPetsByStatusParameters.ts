import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const findPetsByStatusQuerySchema = z.object({ "status": z.array(z.enum(["available", "pending", "sold"])) });

/* Server parameter schemas with coercion and lowercase headers */
const findPetsByStatusServerQuerySchema = z.object({ "status": z.array(z.enum(["available", "pending", "sold"])) });

/* Export schemas for external use */
export { findPetsByStatusQuerySchema };

/* Export server schemas */
export { findPetsByStatusServerQuerySchema };

/* Export types for external use */
export type findPetsByStatusQuerySchema = StandardSchemaV1.InferOutput<typeof findPetsByStatusQuerySchema>;

/* Combined parsed parameters object */
export const findPetsByStatusParsedParams = z.object({
  query: findPetsByStatusQuerySchema
});

/* Combined parsed parameters type */
export type findPetsByStatusParsedParamsType = StandardSchemaV1.InferOutput<typeof findPetsByStatusParsedParams>;

/* Combined server parsed parameters object */
export const findPetsByStatusServerParsedParams = z.object({
  query: findPetsByStatusServerQuerySchema
});

/* Combined server parsed parameters type */
export type findPetsByStatusServerParsedParamsType = StandardSchemaV1.InferOutput<typeof findPetsByStatusServerParsedParams>;
