import type { Pet } from "../../core/domain/pet.ts";
import type { PetRepository } from "../../core/ports/pet-repository.ts";
import { mapPetRow } from "./mappers.ts";
import { pets } from "./schema.ts";
import { eq, inArray } from "drizzle-orm";
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
    async findPetsByStatus(status: Array<"available" | "pending" | "sold">): Promise<Array<Pet>> {
      const rows = await db
        .select()
        .from(pets)
        .where(inArray(pets.status, status));
      return rows.map(mapPetRow);
    },
    async findPetsByTags(tags: Array<string>): Promise<Array<Pet>> {
      const rows = await db.select().from(pets);
      return rows
        .filter((row) => {
          const values = row.tags as Array<{ name?: string }> | null;
          if (values == null) return false;
          return values.some((entry) => entry.name !== undefined && tags.includes(entry.name));
        })
        .map(mapPetRow);
    },
    async getPetById(petId: number): Promise<Pet | undefined> {
      const [row] = await db.select().from(pets).where(eq(pets.id, petId)).limit(1);
      return row ? mapPetRow(row) : undefined;
    },
    async updatePet(pet: Pet): Promise<Pet> {
      const [row] = await db
        .update(pets)
        .set({ name: pet.name, status: pet.status, category: pet.category, photoUrls: pet.photoUrls, tags: pet.tags })
        .where(eq(pets.id, pet.id))
        .returning();
      if (!row) throw new Error(`Pet ${pet.id} was not found`);
      return mapPetRow(row);
    },
  };
}
