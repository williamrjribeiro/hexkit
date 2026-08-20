import Link from "next/link";

import { addPetAction } from "../actions";

export default function NewPetPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/pets" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
        Back to pets
      </Link>
      <h1 className="mt-4 text-3xl font-semibold">Add pet</h1>
      <form
        action={addPetAction}
        className="mt-6 grid gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
      >
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Pet id
          <input
            name="id"
            type="number"
            min="1"
            className="rounded-xl border border-stone-300 px-3 py-2"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Name
          <input name="name" className="rounded-xl border border-stone-300 px-3 py-2" required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Status
          <select
            name="status"
            defaultValue="available"
            className="rounded-xl border border-stone-300 px-3 py-2"
          >
            <option value="available">available</option>
            <option value="pending">pending</option>
            <option value="sold">sold</option>
          </select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Photo URLs (one per line)
          <textarea
            name="photoUrls"
            rows={3}
            className="rounded-xl border border-stone-300 px-3 py-2"
          />
        </label>
        <button className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700">
          Save pet
        </button>
      </form>
    </main>
  );
}
