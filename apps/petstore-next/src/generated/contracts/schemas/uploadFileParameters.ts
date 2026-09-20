import type { StandardSchemaV1 } from "@standard-schema/spec";
import * as z from "zod";

/* Parameter schemas for type-safe inputs */
const uploadFileQuerySchema = z.object({ "additionalMetadata": z.string().optional() });
const uploadFilePathSchema = z.object({ "petId": z.number().int() });

/* Server parameter schemas with coercion and lowercase headers */
const uploadFileServerQuerySchema = z.object({ "additionalMetadata": z.string().optional() });
const uploadFileServerPathSchema = z.object({ "petId": z.coerce.number().int() });

/* Export schemas for external use */
export { uploadFileQuerySchema };
export { uploadFilePathSchema };

/* Export server schemas */
export { uploadFileServerQuerySchema };
export { uploadFileServerPathSchema };

/* Export types for external use */
export type uploadFileQuerySchema = StandardSchemaV1.InferOutput<typeof uploadFileQuerySchema>;
export type uploadFilePathSchema = StandardSchemaV1.InferOutput<typeof uploadFilePathSchema>;

/* Combined parsed parameters object */
export const uploadFileParsedParams = z.object({
  query: uploadFileQuerySchema.optional(),
  path: uploadFilePathSchema
});

/* Combined parsed parameters type */
export type uploadFileParsedParamsType = StandardSchemaV1.InferOutput<typeof uploadFileParsedParams>;

/* Combined server parsed parameters object */
export const uploadFileServerParsedParams = z.object({
  query: uploadFileServerQuerySchema.optional(),
  path: uploadFileServerPathSchema
});

/* Combined server parsed parameters type */
export type uploadFileServerParsedParamsType = StandardSchemaV1.InferOutput<typeof uploadFileServerParsedParams>;
