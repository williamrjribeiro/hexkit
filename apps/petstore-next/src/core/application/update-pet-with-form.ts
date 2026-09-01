import type { Pet } from "../domain/pet.ts";
import type { PetRepository } from "../ports/pet-repository.ts";

export type UpdatePetWithForm = (petId: number, name: string | undefined, status: "available" | "pending" | "sold" | undefined) => Promise<Pet | undefined>;

export function createUpdatePetWithForm(pets: PetRepository): UpdatePetWithForm {
  return (petId, name, status) => pets.updatePetWithForm(petId, name, status);
}
