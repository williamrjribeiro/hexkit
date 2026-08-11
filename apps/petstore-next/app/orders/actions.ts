"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getServerAccess } from "@/adapters/http-next/server-access";

const orderStatuses = ["placed", "approved", "delivered"] as const;

function readText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function readRequiredInteger(formData: FormData, name: string): number {
  const value = Number(readText(formData, name));
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function readOrder(formData: FormData) {
  const status = readText(formData, "status");
  if (!orderStatuses.includes(status as (typeof orderStatuses)[number])) {
    throw new Error("status must be placed, approved, or delivered.");
  }

  return {
    id: readRequiredInteger(formData, "id"),
    petId: readRequiredInteger(formData, "petId"),
    quantity: readRequiredInteger(formData, "quantity"),
    status: status as (typeof orderStatuses)[number],
    complete: formData.get("complete") === "on",
  };
}

export async function placeOrderAction(formData: FormData) {
  const order = await getServerAccess().placeOrder(readOrder(formData));
  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

export async function viewOrderAction(formData: FormData) {
  const orderId = readRequiredInteger(formData, "orderId");
  await getServerAccess().getOrderById(orderId);
  redirect(`/orders/${orderId}`);
}

export async function deleteOrderAction(formData: FormData) {
  const orderId = readRequiredInteger(formData, "orderId");
  await getServerAccess().deleteOrder(orderId);
  revalidatePath("/orders");
  redirect("/orders");
}
