import { describe, expect, it } from "vite-plus/test";

import { createArtifactRegistry, type GeneratedFile } from "@hexkit/plugin-api";

import { createDrizzlePlugin } from "./plugin.ts";

async function collectGeneratedFiles(): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];

  await createDrizzlePlugin().generate({
    inputPath: "/workspace/apps/petstore-sample/openapi.poc.yaml",
    outputDirectory: "/tmp/generated-petstore",
    artifacts: createArtifactRegistry(),
    writeFile(file: GeneratedFile) {
      files.push(file);
    },
    log() {},
  });

  return files;
}

describe("Given the Petstore domain and generated Apical contracts", () => {
  it("when the Drizzle plugin runs, then it generates Postgres tables and a pet-order foreign key", async () => {
    const [schema, migration] = await collectGeneratedFiles();

    expect([schema, migration]).toMatchInlineSnapshot(`
      [
        {
          "contents": "import { boolean, integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core";

      export const petStatus = pgEnum("pet_status", ["available", "pending", "sold"]);
      export const orderStatus = pgEnum("order_status", ["placed", "approved", "delivered"]);

      export const pets = pgTable("pets", {
        id: integer("id").primaryKey(),
        name: text("name").notNull(),
        status: petStatus("status"),
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
      ",
          "ownership": "generated",
          "path": "src/adapters/db/schema.ts",
        },
        {
          "contents": "DO $$
      BEGIN
        CREATE TYPE "pet_status" AS ENUM ('available', 'pending', 'sold');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$;

      DO $$
      BEGIN
        CREATE TYPE "order_status" AS ENUM ('placed', 'approved', 'delivered');
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END
      $$;

      CREATE TABLE IF NOT EXISTS "pets" (
        "id" integer PRIMARY KEY NOT NULL,
        "name" text NOT NULL,
        "status" "pet_status"
      );

      CREATE TABLE IF NOT EXISTS "orders" (
        "id" integer PRIMARY KEY NOT NULL,
        "pet_id" integer NOT NULL,
        "quantity" integer NOT NULL,
        "status" "order_status" NOT NULL,
        "complete" boolean NOT NULL,
        CONSTRAINT "orders_pet_id_pets_id_fk"
          FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id")
      );
      ",
          "ownership": "generated",
          "path": "drizzle/0000_petstore.sql",
        },
      ]
    `);
  });

  it("when the generated migration is applied again, then existing enums and tables are tolerated", async () => {
    const migration = (await collectGeneratedFiles()).find(
      (file: GeneratedFile) => file.path === "drizzle/0000_petstore.sql",
    );

    expect(migration?.contents.match(/WHEN duplicate_object THEN NULL;/g) ?? []).toHaveLength(2);
    expect(migration?.contents).toContain('CREATE TABLE IF NOT EXISTS "pets"');
    expect(migration?.contents).toContain('CREATE TABLE IF NOT EXISTS "orders"');
  });

  it("when repository adapters are generated, then they implement every Pet and Order port operation", async () => {
    const files = await collectGeneratedFiles();
    const repositories = files.filter((file: GeneratedFile) =>
      file.path.endsWith("-repository.ts"),
    );

    expect(repositories).toMatchInlineSnapshot(`
      [
        {
          "contents": "import { eq } from "drizzle-orm";
      import type { NodePgDatabase } from "drizzle-orm/node-postgres";

      import type { Pet } from "../../core/domain/pet.ts";
      import type { PetRepository } from "../../core/ports/pet-repository.ts";
      import { mapPetRow } from "./mappers.ts";
      import { pets } from "./schema.ts";

      export function createDrizzlePetRepository(
        db: NodePgDatabase,
      ): PetRepository {
        return {
          async add(pet: Pet): Promise<Pet> {
            const [row] = await db.insert(pets).values(pet).returning();
            if (!row) throw new Error("Drizzle did not return the inserted pet");
            return mapPetRow(row);
          },
          async update(pet: Pet): Promise<Pet> {
            const [row] = await db
              .update(pets)
              .set({ name: pet.name, status: pet.status })
              .where(eq(pets.id, pet.id))
              .returning();
            if (!row) throw new Error(\`Pet \${pet.id} was not found\`);
            return mapPetRow(row);
          },
          async getById(petId: number): Promise<Pet | undefined> {
            const [row] = await db.select().from(pets).where(eq(pets.id, petId)).limit(1);
            return row ? mapPetRow(row) : undefined;
          },
          async delete(petId: number): Promise<void> {
            await db.delete(pets).where(eq(pets.id, petId));
          },
        };
      }
      ",
          "ownership": "generated",
          "path": "src/adapters/db/pet-repository.ts",
        },
        {
          "contents": "import { eq } from "drizzle-orm";
      import type { NodePgDatabase } from "drizzle-orm/node-postgres";

      import type { Order } from "../../core/domain/order.ts";
      import type { OrderRepository } from "../../core/ports/order-repository.ts";
      import { mapOrderRow } from "./mappers.ts";
      import { orders } from "./schema.ts";

      export function createDrizzleOrderRepository(
        db: NodePgDatabase,
      ): OrderRepository {
        return {
          async place(order: Order): Promise<Order> {
            const [row] = await db.insert(orders).values(order).returning();
            if (!row) throw new Error("Drizzle did not return the inserted order");
            return mapOrderRow(row);
          },
          async getById(orderId: number): Promise<Order | undefined> {
            const [row] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
            return row ? mapOrderRow(row) : undefined;
          },
          async delete(orderId: number): Promise<void> {
            await db.delete(orders).where(eq(orders.id, orderId));
          },
        };
      }
      ",
          "ownership": "generated",
          "path": "src/adapters/db/order-repository.ts",
        },
      ]
    `);
  });

  it("when database rows are mapped, then generated Apical Zod contracts validate every read", async () => {
    const mapper = (await collectGeneratedFiles()).find(
      (file: GeneratedFile) => file.path === "src/adapters/db/mappers.ts",
    );

    expect(mapper).toMatchInlineSnapshot(`
      {
        "contents": "import type { Order } from "../../core/domain/order.ts";
      import type { Pet } from "../../core/domain/pet.ts";
      import { Order as OrderSchema } from "../../generated/contracts/schemas/Order.ts";
      import { Pet as PetSchema } from "../../generated/contracts/schemas/Pet.ts";
      import type { orders, pets } from "./schema.ts";

      type PetRow = typeof pets.$inferSelect;
      type OrderRow = typeof orders.$inferSelect;

      export function mapPetRow(row: PetRow): Pet {
        return PetSchema.parse({ ...row, status: row.status ?? undefined });
      }

      export function mapOrderRow(row: OrderRow): Order {
        return OrderSchema.parse(row);
      }
      ",
        "ownership": "generated",
        "path": "src/adapters/db/mappers.ts",
      }
    `);

    expect(mapper?.contents).toContain("PetSchema.parse");
    expect(mapper?.contents).toContain("OrderSchema.parse");
    expect(mapper?.contents).not.toMatch(/\bbigint\b|Number\(/);
    expect(mapper?.contents).not.toContain("z.object");
    expect(mapper?.contents).not.toMatch(/RequestSchema|ResponseSchema/);
  });
});
