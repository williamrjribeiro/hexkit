import Link from "next/link";
import { notFound } from "next/navigation";

import { getServerAccess } from "@/adapters/http-next/server-access";

import { updatePetAction } from "../../actions";

export default async function EditPetPage(props: { params: Promise<{ petId: string }> }) {
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
      <Link
        href={`/pets/${pet.id}`}
        className="text-sm font-semibold text-amber-700 hover:text-amber-800"
      >
        Back to pet
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Update {pet.name}</h1>
      <form
        action={updatePetAction}
        className="mt-6 grid gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
      >
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Pet id
          <input
            name="id"
            type="number"
            min="1"
            defaultValue={pet.id}
            className="rounded-xl border border-stone-300 px-3 py-2"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Name
          <input
            name="name"
            defaultValue={pet.name}
            className="rounded-xl border border-stone-300 px-3 py-2"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Status
          <select
            name="status"
            defaultValue={pet.status ?? "available"}
            className="rounded-xl border border-stone-300 px-3 py-2"
          >
            <option value="available">available</option>
            <option value="pending">pending</option>
            <option value="sold">sold</option>
          </select>
        </label>
        <button className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700">
          Update pet
        </button>
      </form>
    </main>
  );
}
