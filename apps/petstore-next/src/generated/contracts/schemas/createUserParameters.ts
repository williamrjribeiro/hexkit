import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */


/* Combined parsed parameters object */
export const createUserParsedParams = z.object({});

/* Combined parsed parameters type */
export type createUserParsedParamsType = StandardSchemaV1.InferOutput<typeof createUserParsedParams>;

/* Combined server parsed parameters object */
export const createUserServerParsedParams = z.object({});

/* Combined server parsed parameters type */
export type createUserServerParsedParamsType = StandardSchemaV1.InferOutput<typeof createUserServerParsedParams>;
