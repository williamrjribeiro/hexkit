import type { Pet } from "../../core/domain/pet.ts";
import type { PetRepository } from "../../core/ports/pet-repository.ts";
import { mapPetRow } from "./mappers.ts";
import { pets } from "./schema.ts";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export function createDrizzlePetRepository(
  db: NodePgDatabase<Record<string, unknown>>,
): PetRepository {
  return {
    async addPet(pet: Pet): Promise<Pet> {
      const [row] = await db.insert(pets).values(pet).returning();
      if (!row) throw new Error("Drizzle did not return the inserted pet");
      return mapPetRow(row);
    },
    async deletePet(petId: number): Promise<void> {
      await db.delete(pets).where(eq(pets.id, petId));
    },
    async getPetById(petId: number): Promise<Pet | undefined> {
      const [row] = await db.select().from(pets).where(eq(pets.id, petId)).limit(1);
      return row ? mapPetRow(row) : undefined;
    },
    async updatePet(pet: Pet): Promise<Pet> {
      const [row] = await db
        .update(pets)
        .set({ name: pet.name, status: pet.status })
        .where(eq(pets.id, pet.id))
        .returning();
      if (!row) throw new Error(`Pet ${pet.id} was not found`);
      return mapPetRow(row);
    },
  };
}
