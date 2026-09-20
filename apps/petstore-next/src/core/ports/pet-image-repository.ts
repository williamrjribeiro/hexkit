import type { PetImage } from "../domain/pet-image.ts";

export interface PetImageRepository {
  uploadFile(petId: number, storageKey: string, additionalMetadata: string | undefined): Promise<PetImage | undefined>;
}
