import * as z from 'zod';

export type PetImage = z.infer<typeof PetImage>;
export const PetImage = z.object({"id": z.number().int(), "petId": z.number().int(), "storageKey": z.string(), "additionalMetadata": z.string().optional()});