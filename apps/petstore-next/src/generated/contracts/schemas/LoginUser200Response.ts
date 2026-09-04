import * as z from 'zod';

export type LoginUser200Response = z.infer<typeof LoginUser200Response>;
/**
 * Response schema for LoginUser200
 */
export const LoginUser200Response = z.string();