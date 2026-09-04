import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const updateUserPathSchema = z.object({ "username": z.string() });

/* Server parameter schemas with coercion and lowercase headers */
const updateUserServerPathSchema = z.object({ "username": z.string() });

/* Export schemas for external use */
export { updateUserPathSchema };

/* Export server schemas */
export { updateUserServerPathSchema };

/* Export types for external use */
export type updateUserPathSchema = StandardSchemaV1.InferOutput<typeof updateUserPathSchema>;

/* Combined parsed parameters object */
export const updateUserParsedParams = z.object({
  path: updateUserPathSchema
});

/* Combined parsed parameters type */
export type updateUserParsedParamsType = StandardSchemaV1.InferOutput<typeof updateUserParsedParams>;

/* Combined server parsed parameters object */
export const updateUserServerParsedParams = z.object({
  path: updateUserServerPathSchema
});

/* Combined server parsed parameters type */
export type updateUserServerParsedParamsType = StandardSchemaV1.InferOutput<typeof updateUserServerParsedParams>;
