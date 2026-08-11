import { placeOrderAction, viewOrderAction } from "./actions";

export default function OrdersPage() {
  return (
    <main className="mx-auto grid max-w-5xl gap-8 px-6 py-10 lg:grid-cols-[1.4fr_1fr]">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">Orders</p>
        <h1 className="mt-2 text-3xl font-semibold">Place an order</h1>
        <form
          action={placeOrderAction}
          className="mt-6 grid gap-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200"
        >
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Order id
            <input
              name="id"
              type="number"
              min="1"
              className="rounded-xl border border-stone-300 px-3 py-2"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Pet id
            <input
              name="petId"
              type="number"
              min="1"
              className="rounded-xl border border-stone-300 px-3 py-2"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Quantity
            <input
              name="quantity"
              type="number"
              min="1"
              defaultValue="1"
              className="rounded-xl border border-stone-300 px-3 py-2"
              required
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Status
            <select
              name="status"
              defaultValue="placed"
              className="rounded-xl border border-stone-300 px-3 py-2"
            >
              <option value="placed">placed</option>
              <option value="approved">approved</option>
              <option value="delivered">delivered</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
            <input name="complete" type="checkbox" className="size-4" /> Complete
          </label>
          <button className="rounded-xl bg-amber-600 px-5 py-3 text-sm font-semibold text-white hover:bg-amber-700">
            Place order
          </button>
        </form>
      </section>

      <aside className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <h2 className="text-xl font-semibold">Get or delete order</h2>
        <form action={viewOrderAction} className="mt-5 grid gap-3">
          <label className="grid gap-2 text-sm font-medium text-stone-700">
            Order id
            <input
              name="orderId"
              type="number"
              min="1"
              className="rounded-xl border border-stone-300 px-3 py-2"
              required
            />
          </label>
          <button className="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white">
            View order
          </button>
        </form>
        <p className="mt-4 text-sm text-stone-600">
          Delete controls are shown on the order detail page after the RSC read resolves through
          server access.
        </p>
      </aside>
    </main>
  );
}
