import type { Pet } from "../domain/pet.ts";
import type { PetRepository } from "../ports/pet-repository.ts";

export type UpdatePet = (pet: Pet) => Promise<Pet>;

export function createUpdatePet(pets: PetRepository): UpdatePet {
  return (pet) => pets.updatePet(pet);
}
