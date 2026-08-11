import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */

/* Combined parsed parameters object */
export const updatePetParsedParams = z.object({});

/* Combined parsed parameters type */
export type updatePetParsedParamsType = StandardSchemaV1.InferOutput<typeof updatePetParsedParams>;

/* Combined server parsed parameters object */
export const updatePetServerParsedParams = z.object({});

/* Combined server parsed parameters type */
export type updatePetServerParsedParamsType = StandardSchemaV1.InferOutput<
  typeof updatePetServerParsedParams
>;
