import * as z from 'zod';
import { Pet } from "./Pet.ts";

export type FindPetsByStatus200Response = z.infer<typeof FindPetsByStatus200Response>;
/**
 * Response schema for FindPetsByStatus200
 */
export const FindPetsByStatus200Response = z.array(Pet);