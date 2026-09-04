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

export const users = pgTable("users", {
  id: integer("id").primaryKey(),
  username: text("username").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  email: text("email"),
  password: text("password"),
  phone: text("phone"),
  userStatus: integer("user_status"),
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
