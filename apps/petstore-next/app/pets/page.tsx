import Link from "next/link";

import { viewPetAction } from "./actions";
import { catalogRouteHint, catalogTagOptions, loadPetCatalog } from "./catalog";

export const dynamic = "force-dynamic";

type PetsPageProps = {
  searchParams: Promise<{ status?: string | string[]; tags?: string | string[] }>;
};

function normalizeSingleParam(value: string | string[] | undefined): string {
  if (value === undefined) return "";
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function selectedTags(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

export default async function PetsPage({ searchParams }: PetsPageProps) {
  const resolvedSearchParams = await searchParams;
  const pets = await loadPetCatalog(resolvedSearchParams);
  const activeStatus = normalizeSingleParam(resolvedSearchParams.status);
  const activeTags = selectedTags(resolvedSearchParams.tags);
  const routeHint = catalogRouteHint(resolvedSearchParams);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Pets</p>
          <h1 className="mt-2 text-3xl font-semibold">Pet catalog</h1>
          <p className="mt-2 text-stone-600">
            Filter pets by status or tag. Reads call generated server access in-process (
            <code className="rounded bg-stone-100 px-1 py-0.5 text-sm">findPetsByStatus</code> /{" "}
            <code className="rounded bg-stone-100 px-1 py-0.5 text-sm">findPetsByTags</code>).
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
        method="get"
        className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-stone-200"
      >
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-stone-700" htmlFor="status">
              Status
            </label>
            <select
              id="status"
              name="status"
              defaultValue={activeStatus}
              className="mt-2 w-full rounded-xl border border-stone-300 px-3 py-2"
            >
              <option value="">All statuses</option>
              <option value="available">available</option>
              <option value="pending">pending</option>
              <option value="sold">sold</option>
            </select>
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-stone-700">Tags</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {catalogTagOptions.map((tag) => (
                <label key={tag} className="inline-flex items-center gap-2 text-sm text-stone-700">
                  <input
                    type="checkbox"
                    name="tags"
                    value={tag}
                    defaultChecked={activeTags.includes(tag)}
                    className="rounded border-stone-300"
                  />
                  {tag}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Apply filters
          </button>
          <Link
            href="/pets"
            className="rounded-xl border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100"
          >
            Clear
          </Link>
        </div>
      </form>

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

      <p className="text-sm text-stone-600">
        Showing {pets.length} pet{pets.length === 1 ? "" : "s"}.
      </p>

      {pets.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-stone-300 bg-white p-6">
          <h2 className="text-lg font-semibold">No pets found</h2>
          <p className="mt-2 text-stone-600">
            Try a different status or tag filter, or add a new pet.
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
                  <p className="mt-1 text-sm text-stone-600">
                    Status:{" "}
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                      {pet.status ?? "unknown"}
                    </span>
                  </p>
                  {pet.tags != null && pet.tags.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {pet.tags.map((tag) => (
                        <span
                          key={`${String(pet.id)}-${String(tag.id ?? tag.name)}`}
                          className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-medium text-stone-700"
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Link href={`/pets/${pet.id}`} className="text-sm font-semibold text-amber-700">
                  Details
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-stone-500">
        Equivalent Route Handler: <code className="rounded bg-stone-100 px-1 py-0.5">{routeHint}</code>
      </p>
    </main>
  );
}
