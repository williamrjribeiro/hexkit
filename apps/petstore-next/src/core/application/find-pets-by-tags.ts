import type { Pet } from "../domain/pet.ts";
import type { PetRepository } from "../ports/pet-repository.ts";

export type FindPetsByTags = (tags: Array<string>) => Promise<Array<Pet>>;

export function createFindPetsByTags(pets: PetRepository): FindPetsByTags {
  return (tags) => pets.findPetsByTags(tags);
}
