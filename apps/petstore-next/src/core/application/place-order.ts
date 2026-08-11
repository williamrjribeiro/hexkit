import type { Order } from "../domain/order.ts";
import type { OrderRepository } from "../ports/order-repository.ts";

export type PlaceOrder = (order: Order) => Promise<Order>;

export function createPlaceOrder(orders: OrderRepository): PlaceOrder {
  return (order) => orders.placeOrder(order);
}
