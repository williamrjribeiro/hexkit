import * as z from 'zod';

export type ApiResponseSchema = z.infer<typeof ApiResponseSchema>;
export const ApiResponseSchema = z.object({"code": z.number().int().optional(), "type": z.string().optional(), "message": z.string().optional()});