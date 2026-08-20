import * as z from 'zod';
import { Category } from "./Category.ts";
import { Tag } from "./Tag.ts";

export type Pet = z.infer<typeof Pet>;
export const Pet = z.object({"id": z.number().int(), "name": z.string(), "status": z.enum(["available", "pending", "sold"]).optional(), "category": Category.optional(), "photoUrls": z.array(z.string()), "tags": z.array(Tag).optional()});