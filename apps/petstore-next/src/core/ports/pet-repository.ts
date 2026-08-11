import type { Pet } from "../domain/pet.ts";

export interface PetRepository {
  addPet(pet: Pet): Promise<Pet>;
  deletePet(petId: number): Promise<void>;
  getPetById(petId: number): Promise<Pet | undefined>;
  updatePet(pet: Pet): Promise<Pet>;
}
