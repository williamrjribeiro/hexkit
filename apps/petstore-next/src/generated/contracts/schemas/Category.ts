import * as z from 'zod';

export type Category = z.infer<typeof Category>;
export const Category = z.object({"id": z.number().int().optional(), "name": z.string().optional()});