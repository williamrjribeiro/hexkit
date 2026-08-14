import Link from "next/link";
import { notFound } from "next/navigation";

import { getServerAccess } from "@/adapters/http-next/server-access";

import { deleteOrderAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function OrderDetailPage(props: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await props.params;
  const numericOrderId = Number(orderId);
  if (!Number.isInteger(numericOrderId)) {
    notFound();
  }

  const order = await getServerAccess().getOrderById(numericOrderId);
  if (order == null) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/orders" className="text-sm font-semibold text-amber-700 hover:text-amber-800">
        Back to orders
      </Link>
      <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-stone-200">
        <p className="text-sm font-semibold uppercase tracking-wide text-stone-500">
          Order #{order.id}
        </p>
        <h1 className="mt-2 text-3xl font-semibold">Pet #{order.petId}</h1>
        <dl className="mt-5 grid gap-3 text-sm text-stone-700 sm:grid-cols-2">
          <div>
            <dt className="font-semibold">Quantity</dt>
            <dd>{order.quantity}</dd>
          </div>
          <div>
            <dt className="font-semibold">Status</dt>
            <dd>{order.status}</dd>
          </div>
          <div>
            <dt className="font-semibold">Complete</dt>
            <dd>{order.complete ? "yes" : "no"}</dd>
          </div>
        </dl>
        <pre className="mt-5 overflow-auto rounded-xl bg-stone-950 p-4 text-sm text-stone-50">
          {JSON.stringify(order, null, 2)}
        </pre>
      </section>

      <form action={deleteOrderAction} className="mt-6">
        <input type="hidden" name="orderId" value={order.id} />
        <button className="rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">
          Delete order
        </button>
      </form>
    </main>
  );
}
