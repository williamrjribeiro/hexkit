import type { Pet } from "../domain/pet.ts";

export interface PetRepository {
  addPet(pet: Pet): Promise<Pet>;
  deletePet(petId: number): Promise<void>;
  findPetsByStatus(status: Array<"available" | "pending" | "sold">): Promise<Array<Pet>>;
  findPetsByTags(tags: Array<string>): Promise<Array<Pet>>;
  getPetById(petId: number): Promise<Pet | undefined>;
  updatePet(pet: Pet): Promise<Pet>;
  updatePetWithForm(petId: number, name: string | undefined, status: "available" | "pending" | "sold" | undefined): Promise<Pet | undefined>;
}
