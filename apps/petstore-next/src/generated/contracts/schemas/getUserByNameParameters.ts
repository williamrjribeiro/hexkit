import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const getUserByNamePathSchema = z.object({ "username": z.string() });

/* Server parameter schemas with coercion and lowercase headers */
const getUserByNameServerPathSchema = z.object({ "username": z.string() });

/* Export schemas for external use */
export { getUserByNamePathSchema };

/* Export server schemas */
export { getUserByNameServerPathSchema };

/* Export types for external use */
export type getUserByNamePathSchema = StandardSchemaV1.InferOutput<typeof getUserByNamePathSchema>;

/* Combined parsed parameters object */
export const getUserByNameParsedParams = z.object({
  path: getUserByNamePathSchema
});

/* Combined parsed parameters type */
export type getUserByNameParsedParamsType = StandardSchemaV1.InferOutput<typeof getUserByNameParsedParams>;

/* Combined server parsed parameters object */
export const getUserByNameServerParsedParams = z.object({
  path: getUserByNameServerPathSchema
});

/* Combined server parsed parameters type */
export type getUserByNameServerParsedParamsType = StandardSchemaV1.InferOutput<typeof getUserByNameServerParsedParams>;
