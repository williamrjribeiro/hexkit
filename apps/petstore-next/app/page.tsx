import Link from "next/link";

import { loadPetCatalog } from "./pets/catalog";

export const dynamic = "force-dynamic";

function statusBadge(status: string | undefined) {
  return status ?? "unknown";
}

export default async function Home() {
  const pets = await loadPetCatalog({});

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
      <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-stone-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Fixture-owned UI
        </p>
        <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight">
          Vanilla Next.js PetShop dogfood app
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-stone-700">
          This App Router fixture keeps the PetShop UI separate from generated OpenAPI Route
          Handlers. Reads call Hexkit server access in-process, and writes use plain HTML forms
          wired to Server Actions.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/pets"
            className="rounded-full bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Browse pets
          </Link>
          <Link
            href="/orders"
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-800 hover:bg-stone-100"
          >
            Manage orders
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="text-sm font-medium text-stone-600">Filter by status:</span>
          {(["available", "pending", "sold"] as const).map((status) => (
            <Link
              key={status}
              href={`/pets?status=${status}`}
              className="rounded-full bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-800 hover:bg-stone-200"
            >
              {status}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-2xl font-semibold">Featured pets</h2>
          <Link
            href="/pets/new"
            className="text-sm font-semibold text-amber-700 hover:text-amber-800"
          >
            Add a pet
          </Link>
        </div>
        {pets.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-stone-300 bg-white p-6 text-stone-600">
            No pets were returned by the current server access implementation.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-3">
            {pets.slice(0, 6).map((pet) => (
              <li key={pet.id} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  #{pet.id} / {statusBadge(pet.status)}
                </p>
                <h3 className="mt-2 text-xl font-semibold">{pet.name}</h3>
                <Link
                  href={`/pets/${pet.id}`}
                  className="mt-4 inline-flex text-sm font-semibold text-amber-700 hover:text-amber-800"
                >
                  View details
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
