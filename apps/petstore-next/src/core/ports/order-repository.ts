import type { Order } from "../domain/order.ts";

export interface OrderRepository {
  deleteOrder(orderId: number): Promise<void>;
  getOrderById(orderId: number): Promise<Order | undefined>;
  placeOrder(order: Order): Promise<Order>;
}
