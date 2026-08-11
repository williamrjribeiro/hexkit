import Link from "next/link";
import { notFound } from "next/navigation";

import { getServerAccess } from "@/adapters/http-next/server-access";

import { deletePetAction } from "../actions";

export default async function PetDetailPage(props: { params: Promise<{ petId: string }> }) {
  const { petId } = await props.params;
  const numericPetId = Number(petId);
  if (!Number.isInteger(numericPetId)) {
    notFound();
  }

  const pet = await getServerAccess().getPetById(numericPetId);
  if (pet == null) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/pets" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
        Back to pets
      </Link>
      <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Pet #{pet.id}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">{pet.name}</h1>
        <p className="mt-2 text-stone-600">Status: {pet.status ?? "unknown"}</p>
        <pre className="mt-5 overflow-auto rounded-xl bg-stone-950 p-4 text-sm text-stone-50">
          {JSON.stringify(pet, null, 2)}
        </pre>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/pets/${pet.id}/edit`}
          className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Edit pet
        </Link>
        <form action={deletePetAction}>
          <input type="hidden" name="petId" value={pet.id} />
          <button className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
            Delete pet
          </button>
        </form>
      </div>
    </main>
  );
}
