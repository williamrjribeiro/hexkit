import * as z from 'zod';

export type User = z.infer<typeof User>;
export const User = z.object({"id": z.number().int(), "username": z.string(), "firstName": z.string().optional(), "lastName": z.string().optional(), "email": z.string().optional(), "password": z.string().optional(), "phone": z.string().optional(), "userStatus": z.number().int().optional().describe("User Status")});