import * as z from 'zod';
import { Pet } from "./Pet.ts";

export type FindPetsByTags200Response = z.infer<typeof FindPetsByTags200Response>;
/**
 * Response schema for FindPetsByTags200
 */
export const FindPetsByTags200Response = z.array(Pet);