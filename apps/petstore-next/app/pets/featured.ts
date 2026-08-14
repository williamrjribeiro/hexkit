import { getServerAccess } from "@/adapters/http-next/server-access";

export const featuredPetIds = [1, 2, 3] as const;

export async function loadFeaturedPets() {
  const access = getServerAccess();
  type PetResult = Awaited<ReturnType<typeof access.getPetById>>;
  const pets: NonNullable<PetResult>[] = [];

  for (const petId of featuredPetIds) {
    try {
      const pet = await access.getPetById(petId);
      if (pet != null) {
        pets.push(pet);
      }
    } catch {
      // Generated use cases may throw for missing rows; the fixture list can skip them.
    }
  }

  return pets;
}
