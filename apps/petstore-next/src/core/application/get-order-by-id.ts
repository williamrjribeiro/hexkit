import type { Order } from "../domain/order.ts";
import type { OrderRepository } from "../ports/order-repository.ts";

export type GetOrderById = (orderId: number) => Promise<Order | undefined>;

export function createGetOrderById(orders: OrderRepository): GetOrderById {
  return (orderId) => orders.getOrderById(orderId);
}
