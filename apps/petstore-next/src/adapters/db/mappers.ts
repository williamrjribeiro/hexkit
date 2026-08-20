import type { Order } from "../../core/domain/order.ts";
import type { Pet } from "../../core/domain/pet.ts";
import { Order as OrderSchema } from "../../generated/contracts/schemas/Order.ts";
import { Pet as PetSchema } from "../../generated/contracts/schemas/Pet.ts";
import type { orders, pets } from "./schema.ts";

type OrderRow = typeof orders.$inferSelect;
type PetRow = typeof pets.$inferSelect;

export function mapOrderRow(row: OrderRow): Order {
  return OrderSchema.parse(row);
}

export function mapPetRow(row: PetRow): Pet {
  return PetSchema.parse({ ...row, status: row.status ?? undefined, category: row.category ?? undefined, tags: row.tags ?? undefined });
}
