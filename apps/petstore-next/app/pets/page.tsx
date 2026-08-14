import Link from "next/link";

import { viewPetAction } from "./actions";
import { featuredPetIds, loadFeaturedPets } from "./featured";

export const dynamic = "force-dynamic";

export default async function PetsPage() {
  const pets = await loadFeaturedPets();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Pets</p>
          <h1 className="mt-2 text-3xl font-semibold">Pet list</h1>
          <p className="mt-2 text-stone-600">
            The OpenAPI fixture has point reads, so this page asks server access for a few known
            fixture ids.
          </p>
        </div>
        <Link
          href="/pets/new"
          className="rounded-full bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700"
        >
          Add pet
        </Link>
      </div>

      <form
        action={viewPetAction}
        className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200"
      >
        <label className="block text-sm font-medium text-stone-700" htmlFor="petId">
          Jump to pet id
        </label>
        <div className="mt-2 flex flex-wrap gap-3">
          <input
            id="petId"
            name="petId"
            type="number"
            min="1"
            placeholder="1"
            className="min-w-40 rounded-xl border border-stone-300 px-3 py-2"
            required
          />
          <button className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white">
            View pet
          </button>
        </div>
      </form>

      {pets.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-6">
          <h2 className="text-lg font-semibold">No pets found</h2>
          <p className="mt-2 text-stone-600">
            Tried fixture ids {featuredPetIds.join(", ")}. Generate the real DAL and seed data to
            populate this list.
          </p>
        </section>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {pets.map((pet) => (
            <li key={pet.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                    Pet #{pet.id}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold">{pet.name}</h2>
                  <p className="mt-1 text-sm text-stone-600">Status: {pet.status ?? "unknown"}</p>
                </div>
                <Link href={`/pets/${pet.id}`} className="text-sm font-semibold text-amber-700">
                  Details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
