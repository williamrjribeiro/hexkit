import type { PetRepository } from "../ports/pet-repository.ts";

export type DeletePet = (petId: number) => Promise<void>;

export function createDeletePet(pets: PetRepository): DeletePet {
  return (petId) => pets.deletePet(petId);
}
