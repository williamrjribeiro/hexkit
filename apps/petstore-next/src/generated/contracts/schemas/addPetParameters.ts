import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */

/* Combined parsed parameters object */
export const addPetParsedParams = z.object({});

/* Combined parsed parameters type */
export type addPetParsedParamsType = StandardSchemaV1.InferOutput<typeof addPetParsedParams>;

/* Combined server parsed parameters object */
export const addPetServerParsedParams = z.object({});

/* Combined server parsed parameters type */
export type addPetServerParsedParamsType = StandardSchemaV1.InferOutput<
  typeof addPetServerParsedParams
>;
