import * as z from 'zod';

export type Tag = z.infer<typeof Tag>;
export const Tag = z.object({"id": z.number().int().optional(), "name": z.string().optional()});