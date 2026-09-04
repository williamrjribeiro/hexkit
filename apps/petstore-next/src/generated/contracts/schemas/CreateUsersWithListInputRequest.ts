import * as z from 'zod';
import { User } from "./User.ts";

export type CreateUsersWithListInputRequest = z.infer<typeof CreateUsersWithListInputRequest>;
/**
 * Request schema for createUsersWithListInput operation
 */
export const CreateUsersWithListInputRequest = z.array(User);