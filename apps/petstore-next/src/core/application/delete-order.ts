import type { OrderRepository } from "../ports/order-repository.ts";

export type DeleteOrder = (orderId: number) => Promise<void>;

export function createDeleteOrder(orders: OrderRepository): DeleteOrder {
  return (orderId) => orders.deleteOrder(orderId);
}
