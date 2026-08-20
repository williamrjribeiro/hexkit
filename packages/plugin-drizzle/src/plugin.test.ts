import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { beforeAll, describe, expect, it } from "vite-plus/test";

import {
  APICAL_CONTRACT_ARTIFACT,
  loadValidatedOpenApi,
  normalizeContractArtifact,
  type ContractArtifact,
} from "@hexkit/plugin-apical";
import {
  APPLICATION_ARTIFACT,
  deriveApplicationModel,
  toApplicationArtifact,
  type ApplicationArtifact,
} from "@hexkit/plugin-architecture-hexagonal";
import {
  createArtifactRegistry,
  type GeneratedFile,
  type GenerationContext,
} from "@hexkit/plugin-api";

import { PERSISTENCE_ARTIFACT, type PersistenceArtifact } from "./artifact.ts";
import { createDrizzlePlugin } from "./plugin.ts";

const petstoreOpenApi = new URL("../../../apps/petstore-sample/openapi.poc.yaml", import.meta.url)
  .pathname;
const libraryOpenApi = new URL("../../../apps/fixtures/library-api/openapi.yaml", import.meta.url)
  .pathname;
const authOpenApi = new URL("../../../apps/fixtures/auth-api/openapi.yaml", import.meta.url)
  .pathname;

const petstoreModules = {
  schemas: new Map([
    ["Order", "schemas/Order.ts"],
    ["Pet", "schemas/Pet.ts"],
  ]),
  operations: new Map([
    ["addPet", "routes/addPet.ts"],
    ["updatePet", "routes/updatePet.ts"],
    ["getPetById", "routes/getPetById.ts"],
    ["deletePet", "routes/deletePet.ts"],
    ["placeOrder", "routes/placeOrder.ts"],
    ["getOrderById", "routes/getOrderById.ts"],
    ["deleteOrder", "routes/deleteOrder.ts"],
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

let petstoreContract: ContractArtifact;
let libraryContract: ContractArtifact;
let authContract: ContractArtifact;
let petstoreApplication: ApplicationArtifact;

beforeAll(async () => {
  [petstoreContract, libraryContract, authContract] = await Promise.all([
    loadContract(petstoreOpenApi, petstoreModules),
    loadContract(libraryOpenApi, libraryModules),
    loadContract(authOpenApi, authModules),
  ]);
  petstoreApplication = applicationFromContract(petstoreContract);
});

async function loadContract(
  openApiPath: string,
  modules: {
    schemas: ReadonlyMap<string, string>;
    operations: ReadonlyMap<string, string>;
  },
): Promise<ContractArtifact> {
  return normalizeContractArtifact(await loadValidatedOpenApi(openApiPath), modules);
}

function applicationFromContract(contract: ContractArtifact): ApplicationArtifact {
  return toApplicationArtifact(deriveApplicationModel(contract));
}

async function collectGeneratedFiles(
  contract: ContractArtifact,
  application: ApplicationArtifact,
): Promise<{ files: GeneratedFile[]; artifact: PersistenceArtifact }> {
  const files: GeneratedFile[] = [];
  const context: GenerationContext = {
    inputPath: "openapi.yaml",
    outputDirectory: "/tmp/generated-app",
    artifacts: createArtifactRegistry(),
    writeFile(file: GeneratedFile) {
      files.push(file);
    },
    log() {},
  };

  context.artifacts.publish(APICAL_CONTRACT_ARTIFACT, contract);
  context.artifacts.publish(APPLICATION_ARTIFACT, application);
  await createDrizzlePlugin().generate(context);

  return {
    files,
    artifact: context.artifacts.require(PERSISTENCE_ARTIFACT),
  };
}

describe("Given ContractArtifact and ApplicationArtifact for Petstore", () => {
  it("when the Drizzle plugin runs, then it generates pets/orders, explicit Pet FK, and PersistenceArtifact", async () => {
    const { files, artifact } = await collectGeneratedFiles(petstoreContract, petstoreApplication);

    const schema = files.find((file) => file.path === "src/adapters/db/schema.ts");
    const migration = files.find((file) => file.path === "drizzle/0000_hexkit-petstore-poc.sql");

    expect(schema?.contents).toContain('export const pets = pgTable("pets"');
    expect(schema?.contents).toContain('export const orders = pgTable("orders"');
    expect(schema?.contents).toContain(".references(() => pets.id)");
    expect(migration?.contents).toContain('CREATE TABLE IF NOT EXISTS "pets"');
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
      ]),
    });

    expect(files.find((file) => file.path === "src/adapters/db/schema.ts")?.contents)
      .toMatchInlineSnapshot(`
      "import { boolean, integer, pgEnum, pgTable, text } from "drizzle-orm/pg-core";

      export const orderStatus = pgEnum("order_status", ["placed", "approved", "delivered"]);

      export const petStatus = pgEnum("pet_status", ["available", "pending", "sold"]);

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
      import { eq } from "drizzle-orm";
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
          async getPetById(petId: number): Promise<Pet | undefined> {
            const [row] = await db.select().from(pets).where(eq(pets.id, petId)).limit(1);
            return row ? mapPetRow(row) : undefined;
          },
          async updatePet(pet: Pet): Promise<Pet> {
            const [row] = await db
              .update(pets)
              .set({ name: pet.name, status: pet.status })
              .where(eq(pets.id, pet.id))
              .returning();
            if (!row) throw new Error(\`Pet \${pet.id} was not found\`);
            return mapPetRow(row);
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
    expect(mapper?.contents).not.toMatch(/\bbigint\b|Number\(/);
    expect(mapper?.contents).not.toContain("z.object");
    expect(mapper?.contents).not.toMatch(/RequestSchema|ResponseSchema/);
    expect(mapper?.contents).toMatchInlineSnapshot(`
      "import type { Order } from "../../core/domain/order.ts";
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
        return PetSchema.parse({ ...row, status: row.status ?? undefined });
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
    const schema = files.find((file) => file.path === "src/adapters/db/schema.ts")?.contents ?? "";
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
    const schema = files.find((file) => file.path === "src/adapters/db/schema.ts")?.contents ?? "";
    const migration =
      files.find((file) => file.path === "drizzle/0000_nested-embed-api.sql")?.contents ?? "";

    expect(schema).toContain('import { integer, jsonb, pgTable, text } from "drizzle-orm/pg-core"');
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

    await expect(collectGeneratedFiles(contract, applicationFromContract(contract))).rejects.toThrow(
      /Schema "Widget" property "owner".*cannot combine \$ref with x-hexkit\.reference/i,
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
      /\bPet\b|\bOrder\b|petstore|addPet|placeOrder|getPetById|available|pending|sold|placed|approved|delivered/;

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
