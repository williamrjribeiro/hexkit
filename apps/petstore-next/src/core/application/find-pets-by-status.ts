import type { Pet } from "../domain/pet.ts";
import type { PetRepository } from "../ports/pet-repository.ts";

export type FindPetsByStatus = (status: Array<"available" | "pending" | "sold">) => Promise<Array<Pet>>;

export function createFindPetsByStatus(pets: PetRepository): FindPetsByStatus {
  return (status) => pets.findPetsByStatus(status);
}
