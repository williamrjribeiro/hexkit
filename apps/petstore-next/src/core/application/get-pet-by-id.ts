import type { Pet } from "../domain/pet.ts";
import type { PetRepository } from "../ports/pet-repository.ts";

export type GetPetById = (petId: number) => Promise<Pet | undefined>;

export function createGetPetById(pets: PetRepository): GetPetById {
  return (petId) => pets.getPetById(petId);
}
