import * as z from 'zod';

export type Order = z.infer<typeof Order>;
export const Order = z.object({"id": z.number().int(), "petId": z.number().int(), "quantity": z.number().min(1).int(), "status": z.enum(["placed", "approved", "delivered"]), "complete": z.boolean()});