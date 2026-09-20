import type { PetImage } from "../../core/domain/pet-image.ts";
import type { PetImageRepository } from "../../core/ports/pet-image-repository.ts";
import { mapPetImageRow } from "./mappers.ts";
import { pet_images, pets } from "./schema.ts";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export function createDrizzlePetImageRepository(
  db: NodePgDatabase<Record<string, unknown>>,
): PetImageRepository {
  return {
    async uploadFile(petId: number, storageKey: string, additionalMetadata: string | undefined): Promise<PetImage | undefined> {
      const [parent] = await db.select().from(pets).where(eq(pets.id, petId)).limit(1);
      if (!parent) return undefined;
      const [row] = await db.insert(pet_images).values({
        petId,
        storageKey,
        ...(additionalMetadata !== undefined ? { additionalMetadata } : {}),
      }).returning();
      return row ? mapPetImageRow(row) : undefined;
    },
  };
}
