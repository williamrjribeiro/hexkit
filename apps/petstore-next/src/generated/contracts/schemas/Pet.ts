import * as z from 'zod';

export type Pet = z.infer<typeof Pet>;
export const Pet = z.object({"id": z.number().int(), "name": z.string(), "status": z.enum(["available", "pending", "sold"]).optional()});