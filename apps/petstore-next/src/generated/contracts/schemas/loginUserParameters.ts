import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const loginUserQuerySchema = z.object({ "username": z.string(), "password": z.string() });

/* Server parameter schemas with coercion and lowercase headers */
const loginUserServerQuerySchema = z.object({ "username": z.string(), "password": z.string() });

/* Export schemas for external use */
export { loginUserQuerySchema };

/* Export server schemas */
export { loginUserServerQuerySchema };

/* Export types for external use */
export type loginUserQuerySchema = StandardSchemaV1.InferOutput<typeof loginUserQuerySchema>;

/* Combined parsed parameters object */
export const loginUserParsedParams = z.object({
  query: loginUserQuerySchema
});

/* Combined parsed parameters type */
export type loginUserParsedParamsType = StandardSchemaV1.InferOutput<typeof loginUserParsedParams>;

/* Combined server parsed parameters object */
export const loginUserServerParsedParams = z.object({
  query: loginUserServerQuerySchema
});

/* Combined server parsed parameters type */
export type loginUserServerParsedParamsType = StandardSchemaV1.InferOutput<typeof loginUserServerParsedParams>;
