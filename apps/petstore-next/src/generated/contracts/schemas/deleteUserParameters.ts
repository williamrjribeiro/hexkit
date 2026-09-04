import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const deleteUserPathSchema = z.object({ "username": z.string() });

/* Server parameter schemas with coercion and lowercase headers */
const deleteUserServerPathSchema = z.object({ "username": z.string() });

/* Export schemas for external use */
export { deleteUserPathSchema };

/* Export server schemas */
export { deleteUserServerPathSchema };

/* Export types for external use */
export type deleteUserPathSchema = StandardSchemaV1.InferOutput<typeof deleteUserPathSchema>;

/* Combined parsed parameters object */
export const deleteUserParsedParams = z.object({
  path: deleteUserPathSchema
});

/* Combined parsed parameters type */
export type deleteUserParsedParamsType = StandardSchemaV1.InferOutput<typeof deleteUserParsedParams>;

/* Combined server parsed parameters object */
export const deleteUserServerParsedParams = z.object({
  path: deleteUserServerPathSchema
});

/* Combined server parsed parameters type */
export type deleteUserServerParsedParamsType = StandardSchemaV1.InferOutput<typeof deleteUserServerParsedParams>;
