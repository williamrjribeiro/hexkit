import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */


/* Combined parsed parameters object */
export const logoutUserParsedParams = z.object({});

/* Combined parsed parameters type */
export type logoutUserParsedParamsType = StandardSchemaV1.InferOutput<typeof logoutUserParsedParams>;

/* Combined server parsed parameters object */
export const logoutUserServerParsedParams = z.object({});

/* Combined server parsed parameters type */
export type logoutUserServerParsedParamsType = StandardSchemaV1.InferOutput<typeof logoutUserServerParsedParams>;
