import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vite-plus/test";

import { APICAL_CONTRACT_ARTIFACT, type ContractArtifact } from "@hexkit/plugin-apical";
import {
  APPLICATION_ARTIFACT,
  deriveApplicationModel,
  toApplicationArtifact,
  type ApplicationArtifact,
} from "@hexkit/plugin-architecture-hexagonal";
import { type GeneratedFile } from "@hexkit/plugin-api";
import { collectPluginOutput, loadNormalizedContract } from "@hexkit/shared/testing";

import { PERSISTENCE_ARTIFACT, type PersistenceArtifact } from "./artifact.ts";
import { createDrizzlePlugin } from "./plugin.ts";

describe("@hexkit/plugin-drizzle", () => {
  const petstoreOpenApi = new URL("../../../apps/petstore-sample/openapi.poc.yaml", import.meta.url)
    .pathname;
  const libraryOpenApi = new URL("../../../apps/fixtures/library-api/openapi.yaml", import.meta.url)
    .pathname;
  const authOpenApi = new URL("../../../apps/fixtures/auth-api/openapi.yaml", import.meta.url)
    .pathname;
  const patchOpenApi = new URL("../../../apps/fixtures/patch-api/openapi.yaml", import.meta.url)
    .pathname;
  const keyOpenApi = new URL("../../../apps/fixtures/key-api/openapi.yaml", import.meta.url)
    .pathname;

  const petstoreModules = {
    schemas: new Map([
      ["Category", "schemas/Category.ts"],
      ["Order", "schemas/Order.ts"],
      ["Pet", "schemas/Pet.ts"],
      ["Tag", "schemas/Tag.ts"],
      ["User", "schemas/User.ts"],
    ]),
    operations: new Map([
      ["addPet", "routes/addPet.ts"],
      ["updatePet", "routes/updatePet.ts"],
      ["getPetById", "routes/getPetById.ts"],
      ["deletePet", "routes/deletePet.ts"],
      ["updatePetWithForm", "routes/updatePetWithForm.ts"],
      ["findPetsByStatus", "routes/findPetsByStatus.ts"],
      ["findPetsByTags", "routes/findPetsByTags.ts"],
      ["placeOrder", "routes/placeOrder.ts"],
      ["getOrderById", "routes/getOrderById.ts"],
      ["deleteOrder", "routes/deleteOrder.ts"],
      ["createUser", "routes/createUser.ts"],
      ["createUsersWithListInput", "routes/createUsersWithListInput.ts"],
      ["loginUser", "routes/loginUser.ts"],
      ["logoutUser", "routes/logoutUser.ts"],
      ["getUserByName", "routes/getUserByName.ts"],
      ["updateUser", "routes/updateUser.ts"],
      ["deleteUser", "routes/deleteUser.ts"],
    ]),
  };

  const libraryModules = {
    schemas: new Map([
      ["Author", "schemas/Author.ts"],
      ["Book", "schemas/Book.ts"],
    ]),
    operations: new Map([
      ["createBook", "routes/createBook.ts"],
      ["getBook", "routes/getBook.ts"],
    ]),
  };

  const authModules = {
    schemas: new Map([["Item", "schemas/Item.ts"]]),
    operations: new Map([
      ["getHealth", "routes/getHealth.ts"],
      ["listItems", "routes/listItems.ts"],
      ["createItem", "routes/createItem.ts"],
    ]),
  };

  const patchModules = {
    schemas: new Map([["Widget", "schemas/Widget.ts"]]),
    operations: new Map([
      ["getWidgetById", "routes/getWidgetById.ts"],
      ["updateWidgetWithForm", "routes/updateWidgetWithForm.ts"],
    ]),
  };

  const keyModules = {
    schemas: new Map([["Widget", "schemas/Widget.ts"]]),
    operations: new Map([
      ["createWidget", "routes/createWidget.ts"],
      ["createWidgets", "routes/createWidgets.ts"],
      ["logoutWidgets", "routes/logoutWidgets.ts"],
      ["issueWidgetToken", "routes/issueWidgetToken.ts"],
      ["getWidgetBySku", "routes/getWidgetBySku.ts"],
      ["updateWidgetBySku", "routes/updateWidgetBySku.ts"],
      ["deleteWidgetBySku", "routes/deleteWidgetBySku.ts"],
    ]),
  };

  let petstoreContract: ContractArtifact;
  let libraryContract: ContractArtifact;
  let authContract: ContractArtifact;
  let patchContract: ContractArtifact;
  let keyContract: ContractArtifact;
  let petstoreApplication: ApplicationArtifact;

  beforeAll(async () => {
    [petstoreContract, libraryContract, authContract, patchContract, keyContract] =
      await Promise.all([
        loadNormalizedContract(petstoreOpenApi, petstoreModules),
        loadNormalizedContract(libraryOpenApi, libraryModules),
        loadNormalizedContract(authOpenApi, authModules),
        loadNormalizedContract(patchOpenApi, patchModules),
        loadNormalizedContract(keyOpenApi, keyModules),
      ]);
    petstoreApplication = applicationFromContract(petstoreContract);
  });

  function applicationFromContract(contract: ContractArtifact): ApplicationArtifact {
    return toApplicationArtifact(deriveApplicationModel(contract));
  }

  async function collectGeneratedFiles(
    contract: ContractArtifact,
    application: ApplicationArtifact,
  ): Promise<{ files: GeneratedFile[]; artifact: PersistenceArtifact }> {
    const { context, files } = await collectPluginOutput(createDrizzlePlugin(), (generation) => {
      generation.artifacts.publish(APICAL_CONTRACT_ARTIFACT, contract);
      generation.artifacts.publish(APPLICATION_ARTIFACT, application);
    });

    return {
      files,
      artifact: context.artifacts.require(PERSISTENCE_ARTIFACT),
    };
  }

  describe("Given ContractArtifact and ApplicationArtifact for Petstore", () => {
    it("when the Drizzle plugin runs, then it generates pets/orders, explicit Pet FK, and PersistenceArtifact", async () => {
      const { files, artifact } = await collectGeneratedFiles(
        petstoreContract,
        petstoreApplication,
      );

      const schema = files.find((file) => file.path === "src/adapters/db/schema.ts");
      const migration = files.find((file) => file.path === "drizzle/0000_hexkit-petstore-poc.sql");

      expect(schema?.contents).toContain('export const pets = pgTable("pets"');
      expect(schema?.contents).toContain('export const users = pgTable("users"');
      expect(schema?.contents).toContain('export const orders = pgTable("orders"');
      expect(schema?.contents).toContain(".references(() => pets.id)");
      expect(migration?.contents).toContain('CREATE TABLE IF NOT EXISTS "pets"');
      expect(migration?.contents).toContain('CREATE TABLE IF NOT EXISTS "users"');
      expect(migration?.contents).toContain('CREATE TABLE IF NOT EXISTS "orders"');
      expect(migration?.contents).toContain(
        'FOREIGN KEY ("pet_id") REFERENCES "public"."pets"("id")',
      );
      expect(migration?.contents.match(/WHEN duplicate_object THEN NULL;/g) ?? []).toHaveLength(2);

      expect(artifact).toMatchObject({
        artifactVersion: 1,
        schemaFilePath: "src/adapters/db/schema.ts",
        mapperFilePath: "src/adapters/db/mappers.ts",
        migrationPath: "drizzle/0000_hexkit-petstore-poc.sql",
        tables: [
          { schemaName: "Pet", exportName: "pets", tableName: "pets" },
          { schemaName: "User", exportName: "users", tableName: "users" },
          { schemaName: "Order", exportName: "orders", tableName: "orders" },
        ],
        repositories: expect.arrayContaining([
          expect.objectContaining({
            aggregate: "Pet",
            factoryName: "createDrizzlePetRepository",
            runtimeKey: "pets",
            filePath: "src/adapters/db/pet-repository.ts",
          }),
          expect.objectContaining({
            aggregate: "Order",
            factoryName: "createDrizzleOrderRepository",
            runtimeKey: "orders",
            filePath: "src/adapters/db/order-repository.ts",
          }),
          expect.objectContaining({
            aggregate: "User",
            factoryName: "createDrizzleUserRepository",
            runtimeKey: "users",
            filePath: "src/adapters/db/user-repository.ts",
          }),
        ]),
      });

      expect(files.find((file) => file.path === "src/adapters/db/schema.ts")?.contents)
        .toMatchInlineSnapshot(`
          "import { boolean, integer, jsonb, pgEnum, pgTable, text } from "drizzle-orm/pg-core";

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
          "
        `);
    });

    it("when repository adapters are generated, then they implement every ApplicationArtifact port method", async () => {
      const { files } = await collectGeneratedFiles(petstoreContract, petstoreApplication);
      const repositories = files.filter((file) => file.path.endsWith("-repository.ts"));
      const source = repositories.map((file) => file.contents).join("\n");

      for (const repository of petstoreApplication.repositories) {
        for (const method of repository.methods) {
          expect(source).toContain(`async ${method.name}(`);
        }
      }

      expect(files.find((file) => file.path === "src/adapters/db/pet-repository.ts")?.contents)
        .toMatchInlineSnapshot(`
          "import type { Pet } from "../../core/domain/pet.ts";
          import type { PetRepository } from "../../core/ports/pet-repository.ts";
          import { mapPetRow } from "./mappers.ts";
          import { pets } from "./schema.ts";
          import { eq, inArray } from "drizzle-orm";
          import type { NodePgDatabase } from "drizzle-orm/node-postgres";

          export function createDrizzlePetRepository(
            db: NodePgDatabase<Record<string, unknown>>,
          ): PetRepository {
            return {
              async addPet(pet: Pet): Promise<Pet> {
                const [row] = await db.insert(pets).values(pet).returning();
                if (!row) throw new Error("Drizzle did not return the inserted pet");
                return mapPetRow(row);
              },
              async deletePet(petId: number): Promise<void> {
                await db.delete(pets).where(eq(pets.id, petId));
              },
              async findPetsByStatus(status: Array<"available" | "pending" | "sold">): Promise<Array<Pet>> {
                const rows = await db
                  .select()
                  .from(pets)
                  .where(inArray(pets.status, status));
                return rows.map(mapPetRow);
              },
              async findPetsByTags(tags: Array<string>): Promise<Array<Pet>> {
                const rows = await db.select().from(pets);
                return rows
                  .filter((row) => {
                    const values = row.tags as Array<{ name?: string }> | null;
                    if (values == null) return false;
                    return values.some((entry) => entry.name !== undefined && tags.includes(entry.name));
                  })
                  .map(mapPetRow);
              },
              async getPetById(petId: number): Promise<Pet | undefined> {
                const [row] = await db.select().from(pets).where(eq(pets.id, petId)).limit(1);
                return row ? mapPetRow(row) : undefined;
              },
              async updatePet(pet: Pet): Promise<Pet> {
                const [row] = await db
                  .update(pets)
                  .set({ name: pet.name, status: pet.status, category: pet.category, photoUrls: pet.photoUrls, tags: pet.tags })
                  .where(eq(pets.id, pet.id))
                  .returning();
                if (!row) throw new Error(\`Pet \${pet.id} was not found\`);
                return mapPetRow(row);
              },
              async updatePetWithForm(petId: number, name: string | undefined, status: "available" | "pending" | "sold" | undefined): Promise<Pet | undefined> {
                const patch: { name?: string; status?: "available" | "pending" | "sold" } = {};
                if (name !== undefined) patch.name = name;
                if (status !== undefined) patch.status = status;
                if (Object.keys(patch).length === 0) {
                  const [existing] = await db
                    .select()
                    .from(pets)
                    .where(eq(pets.id, petId))
                    .limit(1);
                  return existing ? mapPetRow(existing) : undefined;
                }
                const [row] = await db
                  .update(pets)
                  .set(patch)
                  .where(eq(pets.id, petId))
                  .returning();
                return row ? mapPetRow(row) : undefined;
              },
            };
          }
          "
        `);
    });

    it("when database rows are mapped, then generated Apical Zod contracts validate every read", async () => {
      const { files } = await collectGeneratedFiles(petstoreContract, petstoreApplication);
      const mapper = files.find((file) => file.path === "src/adapters/db/mappers.ts");

      expect(mapper?.contents).toContain("PetSchema.parse");
      expect(mapper?.contents).toContain("OrderSchema.parse");
      expect(mapper?.contents).toContain("UserSchema.parse");
      expect(mapper?.contents).not.toMatch(/\bbigint\b|Number\(/);
      expect(mapper?.contents).not.toContain("z.object");
      expect(mapper?.contents).not.toMatch(/RequestSchema|ResponseSchema/);
      expect(mapper?.contents).toMatchInlineSnapshot(`
        "import type { Order } from "../../core/domain/order.ts";
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
        "
      `);
    });
  });

  describe("Given ContractArtifact and ApplicationArtifact for Auth API", () => {
    it("when the Drizzle plugin runs, then list selects all rows and getHealth returns a readiness stub", async () => {
      const { files } = await collectGeneratedFiles(
        authContract,
        applicationFromContract(authContract),
      );
      const repository =
        files.find((file) => file.path === "src/adapters/db/item-repository.ts")?.contents ?? "";

      expect(repository).toContain("async createItem(");
      expect(repository).toContain("async listItems(): Promise<Array<Item>>");
      expect(repository).toContain("const rows = await db.select().from(items);");
      expect(repository).toContain("return rows.map(mapItemRow);");
      expect(repository).not.toMatch(/listItems[\s\S]*eq\(items\.id/);
      expect(repository).toContain("async getHealth(): Promise<{");
      expect(repository).toContain("return { ok: true };");
      expect(repository).not.toMatch(/getHealth[\s\S]*eq\(items\.id/);
    });
  });

  describe("Given ContractArtifact and ApplicationArtifact for Patch API", () => {
    it("when the Drizzle plugin runs, then updateWidgetWithForm emits a conditional field patch", async () => {
      const { files } = await collectGeneratedFiles(
        patchContract,
        applicationFromContract(patchContract),
      );
      const repository =
        files.find((file) => file.path === "src/adapters/db/widget-repository.ts")?.contents ?? "";

      expect(repository).toContain("async updateWidgetWithForm(");
      expect(repository).toContain("const patch:");
      expect(repository).toContain("if (name !== undefined) patch.name = name");
      expect(repository).toContain("if (status !== undefined) patch.status = status");
      expect(repository).toContain("Object.keys(patch).length === 0");
      expect(repository).toContain(".set(patch)");
      expect(repository).toContain("eq(widgets.id, widgetId)");
      expect(repository).toContain("return row ? mapWidgetRow(row) : undefined");
      expect(repository).not.toMatch(/\.set\(\{ name: /);
    });
  });

  describe("Given ContractArtifact and ApplicationArtifact for Key API", () => {
    it("when the Drizzle plugin runs, then lookup, keyed update, boolean delete, array insert, and stubs emit", async () => {
      const { files } = await collectGeneratedFiles(
        keyContract,
        applicationFromContract(keyContract),
      );
      const repository =
        files.find((file) => file.path === "src/adapters/db/widget-repository.ts")?.contents ?? "";

      expect(repository).toContain("eq(widgets.sku, sku)");
      expect(repository).toContain("return row !== undefined");
      expect(repository).toContain(".values(body).returning()");
      expect(repository).toContain("async logoutWidgets(): Promise<void>");
      expect(repository).toContain("return;");
      expect(repository).toContain("async issueWidgetToken(): Promise<string>");
      expect(repository).toContain('return ""');
      expect(repository).toContain("eq(widgets.sku, sku)");
      expect(repository).not.toContain("eq(widgets.id, sku)");
    });
  });

  describe("Given ContractArtifact and ApplicationArtifact for Library", () => {
    it("when the Drizzle plugin runs, then it emits authors/books with an explicit Author FK and no Petstore output", async () => {
      const { files, artifact } = await collectGeneratedFiles(
        libraryContract,
        applicationFromContract(libraryContract),
      );
      const source = files.map((file) => file.contents).join("\n");

      expect(files.map((file) => file.path)).toEqual([
        "src/adapters/db/schema.ts",
        "drizzle/0000_hexkit-library-api.sql",
        "src/adapters/db/mappers.ts",
        "src/adapters/db/book-repository.ts",
      ]);
      expect(source).not.toMatch(/\bPet\b|\bOrder\b|petstore|addPet|placeOrder/);
      expect(source).toContain('pgTable("authors"');
      expect(source).toContain('pgTable("books"');
      expect(source).toContain(".references(() => authors.id)");
      expect(source).toContain('FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id")');
      expect(artifact.migrationPath).toBe("drizzle/0000_hexkit-library-api.sql");
      expect(artifact.repositories).toEqual([
        expect.objectContaining({
          aggregate: "Book",
          factoryName: "createDrizzleBookRepository",
          runtimeKey: "books",
        }),
      ]);
    });
  });

  describe("Given a schema with an *Id property and no x-hexkit.reference", () => {
    it("when persistence is derived, then no foreign key is invented", async () => {
      const contract: ContractArtifact = {
        artifactVersion: 1,
        openapiVersion: "3.1.0",
        application: {
          title: "No Relation API",
          version: "1.0.0",
          slug: "no-relation-api",
        },
        schemas: [
          {
            name: "Widget",
            modulePath: "schemas/Widget.ts",
            persistence: {
              table: "widgets",
              identity: "id",
            },
            properties: [
              {
                name: "id",
                required: true,
                type: { kind: "integer", nullable: false, format: "int32" },
              },
              {
                name: "ownerId",
                required: true,
                type: { kind: "integer", nullable: false, format: "int32" },
              },
              {
                name: "name",
                required: true,
                type: { kind: "string", nullable: false },
              },
            ],
          },
        ],
        securitySchemes: [],
        globalSecurity: [],
        operations: [
          {
            operationId: "createWidget",
            method: "post",
            path: "/widgets",
            modulePath: "routes/createWidget.ts",
            parameters: [],
            responses: [
              {
                status: "201",
                description: "created",
                media: [
                  {
                    mediaType: "application/json",
                    type: { kind: "reference", nullable: false, schema: "Widget" },
                  },
                ],
              },
            ],
            security: {
              overridesGlobal: false,
              requirements: [],
              apicalServerHeaderNames: [],
            },
            requestBody: {
              required: true,
              media: [
                {
                  mediaType: "application/json",
                  type: { kind: "reference", nullable: false, schema: "Widget" },
                },
              ],
            },
          },
        ],
      };
      const application = applicationFromContract(contract);
      const { files } = await collectGeneratedFiles(contract, application);
      const schema =
        files.find((file) => file.path === "src/adapters/db/schema.ts")?.contents ?? "";
      const migration =
        files.find((file) => file.path === "drizzle/0000_no-relation-api.sql")?.contents ?? "";

      expect(schema).toContain('ownerId: integer("owner_id")');
      expect(schema).not.toContain(".references(");
      expect(migration).toContain('"owner_id" integer NOT NULL');
      expect(migration).not.toContain("FOREIGN KEY");
    });
  });

  describe("Given a persisted schema with nested object, array, and $ref properties", () => {
    it("when the Drizzle plugin runs, then those columns are jsonb and no child tables are emitted", async () => {
      const contract: ContractArtifact = {
        artifactVersion: 1,
        openapiVersion: "3.1.0",
        application: {
          title: "Nested Embed API",
          version: "1.0.0",
          slug: "nested-embed-api",
        },
        schemas: [
          {
            name: "Label",
            modulePath: "schemas/Label.ts",
            properties: [
              {
                name: "id",
                required: true,
                type: { kind: "integer", nullable: false, format: "int32" },
              },
              {
                name: "name",
                required: true,
                type: { kind: "string", nullable: false },
              },
            ],
          },
          {
            name: "Widget",
            modulePath: "schemas/Widget.ts",
            persistence: { table: "widgets", identity: "id" },
            properties: [
              {
                name: "id",
                required: true,
                type: { kind: "integer", nullable: false, format: "int32" },
              },
              {
                name: "name",
                required: true,
                type: { kind: "string", nullable: false },
              },
              {
                name: "meta",
                required: false,
                type: {
                  kind: "object",
                  nullable: false,
                  properties: [
                    {
                      name: "color",
                      required: true,
                      type: { kind: "string", nullable: false },
                    },
                  ],
                },
              },
              {
                name: "aliases",
                required: true,
                type: {
                  kind: "array",
                  nullable: false,
                  items: { kind: "string", nullable: false },
                },
              },
              {
                name: "label",
                required: false,
                type: { kind: "reference", nullable: false, schema: "Label" },
              },
            ],
          },
        ],
        securitySchemes: [],
        globalSecurity: [],
        operations: [
          {
            operationId: "createWidget",
            method: "post",
            path: "/widgets",
            modulePath: "routes/createWidget.ts",
            parameters: [],
            responses: [
              {
                status: "201",
                description: "created",
                media: [
                  {
                    mediaType: "application/json",
                    type: { kind: "reference", nullable: false, schema: "Widget" },
                  },
                ],
              },
            ],
            security: {
              overridesGlobal: false,
              requirements: [],
              apicalServerHeaderNames: [],
            },
            requestBody: {
              required: true,
              media: [
                {
                  mediaType: "application/json",
                  type: { kind: "reference", nullable: false, schema: "Widget" },
                },
              ],
            },
          },
        ],
      };

      const { files, artifact } = await collectGeneratedFiles(
        contract,
        applicationFromContract(contract),
      );
      const schema =
        files.find((file) => file.path === "src/adapters/db/schema.ts")?.contents ?? "";
      const migration =
        files.find((file) => file.path === "drizzle/0000_nested-embed-api.sql")?.contents ?? "";

      expect(schema).toContain(
        'import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core"',
      );
      expect(schema).toContain('meta: jsonb("meta")');
      expect(schema).toContain('aliases: jsonb("aliases").notNull()');
      expect(schema).toContain('label: jsonb("label")');
      expect(schema).not.toContain('pgTable("labels"');
      expect(migration).toContain('"meta" jsonb');
      expect(migration).toContain('"aliases" jsonb NOT NULL');
      expect(migration).toContain('"label" jsonb');
      expect(migration).not.toContain('CREATE TABLE IF NOT EXISTS "labels"');
      expect(artifact.tables).toEqual([
        expect.objectContaining({ schemaName: "Widget", tableName: "widgets" }),
      ]);

      const mapper =
        files.find((file) => file.path === "src/adapters/db/mappers.ts")?.contents ?? "";
      const repository =
        files.find((file) => file.path === "src/adapters/db/widget-repository.ts")?.contents ?? "";
      expect(mapper).toContain("row.meta ?? undefined");
      expect(mapper).toContain("row.label ?? undefined");
      expect(repository).toContain(".values(widget)");
    });
  });

  describe("Given a nested $ref whose target schema is itself persisted", () => {
    it("when the Drizzle plugin runs, then the embed stays jsonb and the target table has no FK from the parent", async () => {
      const contract = widgetCreateContract("persisted-embed-api", "Persisted Embed API", [
        {
          name: "Label",
          modulePath: "schemas/Label.ts",
          persistence: { table: "labels", identity: "id" },
          properties: [
            {
              name: "id",
              required: true,
              type: { kind: "integer", nullable: false, format: "int32" },
            },
            {
              name: "name",
              required: true,
              type: { kind: "string", nullable: false },
            },
          ],
        },
        {
          name: "Widget",
          modulePath: "schemas/Widget.ts",
          persistence: { table: "widgets", identity: "id" },
          properties: [
            {
              name: "id",
              required: true,
              type: { kind: "integer", nullable: false, format: "int32" },
            },
            {
              name: "label",
              required: false,
              type: { kind: "reference", nullable: false, schema: "Label" },
            },
          ],
        },
      ]);

      const { files, artifact } = await collectGeneratedFiles(
        contract,
        applicationFromContract(contract),
      );
      const schema =
        files.find((file) => file.path === "src/adapters/db/schema.ts")?.contents ?? "";
      const migration =
        files.find((file) => file.path === "drizzle/0000_persisted-embed-api.sql")?.contents ?? "";

      expect(schema).toContain('export const labels = pgTable("labels"');
      expect(schema).toContain('label: jsonb("label")');
      expect(schema).not.toContain(".references(");
      expect(migration).toContain('CREATE TABLE IF NOT EXISTS "labels"');
      expect(migration).toContain('"label" jsonb');
      expect(migration).not.toContain("FOREIGN KEY");
      expect(artifact.tables).toEqual([
        expect.objectContaining({ schemaName: "Label", tableName: "labels" }),
        expect.objectContaining({ schemaName: "Widget", tableName: "widgets" }),
      ]);
    });
  });

  describe("Given a persisted number property", () => {
    it("when persistence is derived, then generation still rejects number columns", async () => {
      const contract = widgetCreateContract("number-column-api", "Number Column API", [
        {
          name: "Widget",
          modulePath: "schemas/Widget.ts",
          persistence: { table: "widgets", identity: "id" },
          properties: [
            {
              name: "id",
              required: true,
              type: { kind: "integer", nullable: false, format: "int32" },
            },
            {
              name: "amount",
              required: true,
              type: { kind: "number", nullable: false },
            },
          ],
        },
      ]);

      await expect(
        collectGeneratedFiles(contract, applicationFromContract(contract)),
      ).rejects.toThrow(
        'Schema "Widget" property "amount" uses number, which is not supported for Drizzle persistence yet.',
      );
    });
  });

  describe("Given a property that combines $ref with x-hexkit.reference", () => {
    it("when persistence is derived, then generation fails with a clear error", async () => {
      const contract: ContractArtifact = {
        artifactVersion: 1,
        openapiVersion: "3.1.0",
        application: {
          title: "Bad Ref API",
          version: "1.0.0",
          slug: "bad-ref-api",
        },
        schemas: [
          {
            name: "Owner",
            modulePath: "schemas/Owner.ts",
            persistence: { table: "owners", identity: "id" },
            properties: [
              {
                name: "id",
                required: true,
                type: { kind: "integer", nullable: false, format: "int32" },
              },
            ],
          },
          {
            name: "Widget",
            modulePath: "schemas/Widget.ts",
            persistence: { table: "widgets", identity: "id" },
            properties: [
              {
                name: "id",
                required: true,
                type: { kind: "integer", nullable: false, format: "int32" },
              },
              {
                name: "owner",
                required: true,
                type: { kind: "reference", nullable: false, schema: "Owner" },
                reference: { schema: "Owner", property: "id" },
              },
            ],
          },
        ],
        securitySchemes: [],
        globalSecurity: [],
        operations: [
          {
            operationId: "createWidget",
            method: "post",
            path: "/widgets",
            modulePath: "routes/createWidget.ts",
            parameters: [],
            responses: [
              {
                status: "201",
                description: "created",
                media: [
                  {
                    mediaType: "application/json",
                    type: { kind: "reference", nullable: false, schema: "Widget" },
                  },
                ],
              },
            ],
            security: {
              overridesGlobal: false,
              requirements: [],
              apicalServerHeaderNames: [],
            },
            requestBody: {
              required: true,
              media: [
                {
                  mediaType: "application/json",
                  type: { kind: "reference", nullable: false, schema: "Widget" },
                },
              ],
            },
          },
        ],
      };

      await expect(
        collectGeneratedFiles(contract, applicationFromContract(contract)),
      ).rejects.toThrow(
        /Schema "Widget" property "owner".*cannot combine \$ref with x-hexkit\.reference/i,
      );
    });
  });

  describe("Given a property that combines an inline object with x-hexkit.reference", () => {
    it("when persistence is derived, then generation fails naming the object type", async () => {
      const contract: ContractArtifact = {
        artifactVersion: 1,
        openapiVersion: "3.1.0",
        application: {
          title: "Bad Object Ref API",
          version: "1.0.0",
          slug: "bad-object-ref-api",
        },
        schemas: [
          {
            name: "Owner",
            modulePath: "schemas/Owner.ts",
            persistence: { table: "owners", identity: "id" },
            properties: [
              {
                name: "id",
                required: true,
                type: { kind: "integer", nullable: false, format: "int32" },
              },
            ],
          },
          {
            name: "Widget",
            modulePath: "schemas/Widget.ts",
            persistence: { table: "widgets", identity: "id" },
            properties: [
              {
                name: "id",
                required: true,
                type: { kind: "integer", nullable: false, format: "int32" },
              },
              {
                name: "owner",
                required: true,
                type: {
                  kind: "object",
                  nullable: false,
                  properties: [
                    {
                      name: "id",
                      required: true,
                      type: { kind: "integer", nullable: false, format: "int32" },
                    },
                  ],
                },
                reference: { schema: "Owner", property: "id" },
              },
            ],
          },
        ],
        securitySchemes: [],
        globalSecurity: [],
        operations: [
          {
            operationId: "createWidget",
            method: "post",
            path: "/widgets",
            modulePath: "routes/createWidget.ts",
            parameters: [],
            responses: [
              {
                status: "201",
                description: "created",
                media: [
                  {
                    mediaType: "application/json",
                    type: { kind: "reference", nullable: false, schema: "Widget" },
                  },
                ],
              },
            ],
            security: {
              overridesGlobal: false,
              requirements: [],
              apicalServerHeaderNames: [],
            },
            requestBody: {
              required: true,
              media: [
                {
                  mediaType: "application/json",
                  type: { kind: "reference", nullable: false, schema: "Widget" },
                },
              ],
            },
          },
        ],
      };

      await expect(
        collectGeneratedFiles(contract, applicationFromContract(contract)),
      ).rejects.toThrow(
        /Schema "Widget" property "owner" cannot combine object with x-hexkit\.reference/i,
      );
    });
  });

  describe("Given a property that combines an inline array with x-hexkit.reference", () => {
    it("when persistence is derived, then generation fails naming the array type", async () => {
      const contract = widgetCreateContract("bad-array-ref-api", "Bad Array Ref API", [
        {
          name: "Owner",
          modulePath: "schemas/Owner.ts",
          persistence: { table: "owners", identity: "id" },
          properties: [
            {
              name: "id",
              required: true,
              type: { kind: "integer", nullable: false, format: "int32" },
            },
          ],
        },
        {
          name: "Widget",
          modulePath: "schemas/Widget.ts",
          persistence: { table: "widgets", identity: "id" },
          properties: [
            {
              name: "id",
              required: true,
              type: { kind: "integer", nullable: false, format: "int32" },
            },
            {
              name: "owners",
              required: true,
              type: {
                kind: "array",
                nullable: false,
                items: { kind: "integer", nullable: false, format: "int32" },
              },
              reference: { schema: "Owner", property: "id" },
            },
          ],
        },
      ]);

      await expect(
        collectGeneratedFiles(contract, applicationFromContract(contract)),
      ).rejects.toThrow(
        /Schema "Widget" property "owners" cannot combine array with x-hexkit\.reference/i,
      );
    });
  });

  describe("Given OpenAPI YAML that combines $ref with x-hexkit.reference", () => {
    it("when the document is normalized and persisted, then generation fails with the same error", async () => {
      const yamlPath = new URL("./__fixtures__/ref-plus-fk.yaml", import.meta.url).pathname;
      const contract = await loadNormalizedContract(yamlPath, {
        schemas: new Map([
          ["Owner", "schemas/Owner.ts"],
          ["Widget", "schemas/Widget.ts"],
        ]),
        operations: new Map([["createWidget", "routes/createWidget.ts"]]),
      });

      await expect(
        collectGeneratedFiles(contract, applicationFromContract(contract)),
      ).rejects.toThrow(
        /Schema "Widget" property "owner" cannot combine \$ref with x-hexkit\.reference/i,
      );
    });
  });

  describe("Given drizzle production sources", () => {
    it("does not embed Petstore fixture literals outside tests", () => {
      const root = join(import.meta.dirname);
      const productionSources = listTypeScriptFiles(root).filter(
        (path) => !path.endsWith(".test.ts"),
      );
      const banned =
        /\bPet\b|\bOrder\b|\bCategory\b|\bTag\b|petstore|addPet|placeOrder|getPetById|available|pending|sold|placed|approved|delivered/;

      for (const path of productionSources) {
        const contents = readFileSync(path, "utf8");
        expect({ path, bannedMatch: banned.exec(contents)?.[0] ?? null }).toEqual({
          path,
          bannedMatch: null,
        });
      }
    });
  });

  function listTypeScriptFiles(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return listTypeScriptFiles(path);
      return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
    });
  }

  function widgetCreateContract(
    slug: string,
    title: string,
    schemas: ContractArtifact["schemas"],
  ): ContractArtifact {
    return {
      artifactVersion: 1,
      openapiVersion: "3.1.0",
      application: { title, version: "1.0.0", slug },
      schemas,
      securitySchemes: [],
      globalSecurity: [],
      operations: [
        {
          operationId: "createWidget",
          method: "post",
          path: "/widgets",
          modulePath: "routes/createWidget.ts",
          parameters: [],
          responses: [
            {
              status: "201",
              description: "created",
              media: [
                {
                  mediaType: "application/json",
                  type: { kind: "reference", nullable: false, schema: "Widget" },
                },
              ],
            },
          ],
          security: {
            overridesGlobal: false,
            requirements: [],
            apicalServerHeaderNames: [],
          },
          requestBody: {
            required: true,
            media: [
              {
                mediaType: "application/json",
                type: { kind: "reference", nullable: false, schema: "Widget" },
              },
            ],
          },
        },
      ],
    };
  }
});
