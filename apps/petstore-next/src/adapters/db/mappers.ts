import type { Order } from "../../core/domain/order.ts";
import type { Pet } from "../../core/domain/pet.ts";
import type { User } from "../../core/domain/user.ts";
import { Order as OrderSchema } from "../../generated/contracts/schemas/Order.ts";
import { Pet as PetSchema } from "../../generated/contracts/schemas/Pet.ts";
import { User as UserSchema } from "../../generated/contracts/schemas/User.ts";
import type { orders, pets, users } from "./schema.ts";

type OrderRow = typeof orders.$inferSelect;
type PetRow = typeof pets.$inferSelect;
type UserRow = typeof users.$inferSelect;

export function mapOrderRow(row: OrderRow): Order {
  return OrderSchema.parse(row);
}

export function mapPetRow(row: PetRow): Pet {
  return PetSchema.parse({ ...row, status: row.status ?? undefined, category: row.category ?? undefined, tags: row.tags ?? undefined });
}

export function mapUserRow(row: UserRow): User {
  return UserSchema.parse({ ...row, firstName: row.firstName ?? undefined, lastName: row.lastName ?? undefined, email: row.email ?? undefined, password: row.password ?? undefined, phone: row.phone ?? undefined, userStatus: row.userStatus ?? undefined });
}
