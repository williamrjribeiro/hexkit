import type { Pet } from "../domain/pet.ts";
import type { PetRepository } from "../ports/pet-repository.ts";

export type AddPet = (pet: Pet) => Promise<Pet>;

export function createAddPet(pets: PetRepository): AddPet {
  return (pet) => pets.addPet(pet);
}
