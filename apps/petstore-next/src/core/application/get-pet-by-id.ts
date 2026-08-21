import type { Principal } from "../domain/auth-principal.ts";
import type { Pet } from "../domain/pet.ts";
import type { PetRepository } from "../ports/pet-repository.ts";

export type GetPetById = (principal: Principal, petId: number) => Promise<Pet | undefined>;

export function createGetPetById(pets: PetRepository): GetPetById {
  return (principal, petId) => pets.getPetById(petId);
}
