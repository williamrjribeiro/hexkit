import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const updatePetWithFormQuerySchema = z.object({ "name": z.string().optional(), "status": z.enum(["available", "pending", "sold"]).optional() });
const updatePetWithFormPathSchema = z.object({ "petId": z.number().int() });

/* Server parameter schemas with coercion and lowercase headers */
const updatePetWithFormServerQuerySchema = z.object({ "name": z.string().optional(), "status": z.enum(["available", "pending", "sold"]).optional() });
const updatePetWithFormServerPathSchema = z.object({ "petId": z.coerce.number().int() });

/* Export schemas for external use */
export { updatePetWithFormQuerySchema };
export { updatePetWithFormPathSchema };

/* Export server schemas */
export { updatePetWithFormServerQuerySchema };
export { updatePetWithFormServerPathSchema };

/* Export types for external use */
export type updatePetWithFormQuerySchema = StandardSchemaV1.InferOutput<typeof updatePetWithFormQuerySchema>;
export type updatePetWithFormPathSchema = StandardSchemaV1.InferOutput<typeof updatePetWithFormPathSchema>;

/* Combined parsed parameters object */
export const updatePetWithFormParsedParams = z.object({
  query: updatePetWithFormQuerySchema.optional(),
  path: updatePetWithFormPathSchema
});

/* Combined parsed parameters type */
export type updatePetWithFormParsedParamsType = StandardSchemaV1.InferOutput<typeof updatePetWithFormParsedParams>;

/* Combined server parsed parameters object */
export const updatePetWithFormServerParsedParams = z.object({
  query: updatePetWithFormServerQuerySchema.optional(),
  path: updatePetWithFormServerPathSchema
});

/* Combined server parsed parameters type */
export type updatePetWithFormServerParsedParamsType = StandardSchemaV1.InferOutput<typeof updatePetWithFormServerParsedParams>;
