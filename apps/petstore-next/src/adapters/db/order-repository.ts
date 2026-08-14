import type { Order } from "../../core/domain/order.ts";
import type { OrderRepository } from "../../core/ports/order-repository.ts";
import { mapOrderRow } from "./mappers.ts";
import { orders } from "./schema.ts";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

export function createDrizzleOrderRepository(
  db: NodePgDatabase<Record<string, unknown>>,
): OrderRepository {
  return {
    async deleteOrder(orderId: number): Promise<void> {
      await db.delete(orders).where(eq(orders.id, orderId));
    },
    async getOrderById(orderId: number): Promise<Order | undefined> {
      const [row] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
      return row ? mapOrderRow(row) : undefined;
    },
    async placeOrder(order: Order): Promise<Order> {
      const [row] = await db.insert(orders).values(order).returning();
      if (!row) throw new Error("Drizzle did not return the inserted order");
      return mapOrderRow(row);
    },
  };
}
