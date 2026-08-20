import { boolean, integer, jsonb, pgEnum, pgTable, text } from "drizzle-orm/pg-core";

export const orderStatus = pgEnum("order_status", ["placed", "approved", "delivered"]);

export const petStatus = pgEnum("pet_status", ["available", "pending", "sold"]);

export const pets = pgTable("pets", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(),
  status: petStatus("status"),
  category: jsonb("category"),
  photoUrls: jsonb("photo_urls").notNull(),
  tags: jsonb("tags"),
});

export const orders = pgTable("orders", {
  id: integer("id").primaryKey(),
  petId: integer("pet_id")
    .notNull()
    .references(() => pets.id),
  quantity: integer("quantity").notNull(),
  status: orderStatus("status").notNull(),
  complete: boolean("complete").notNull(),
});
