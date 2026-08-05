import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import { runPipeline } from "@hexkit/core";
import {
  APICAL_CONTRACT_ARTIFACT,
  loadValidatedOpenApi,
  normalizeContractArtifact,
  type ContractArtifact,
} from "@hexkit/plugin-apical";
import {
  createArtifactRegistry,
  type GeneratedFile,
  type GenerationContext,
  type HexkitPlugin,
} from "@hexkit/plugin-api";

import { APPLICATION_ARTIFACT, type ApplicationArtifact } from "./artifact.ts";
import { createHexagonalPlugin } from "./plugin.ts";

const petstoreOpenApi = new URL("../../../apps/petstore-sample/openapi.poc.yaml", import.meta.url)
  .pathname;
const libraryOpenApi = new URL("../../../apps/fixtures/library-api/openapi.yaml", import.meta.url)
  .pathname;

async function loadContract(
  openApiPath: string,
  modules: {
    schemas: ReadonlyMap<string, string>;
    operations: ReadonlyMap<string, string>;
  },
): Promise<ContractArtifact> {
  return normalizeContractArtifact(await loadValidatedOpenApi(openApiPath), modules);
}

function createContractPublisher(contract: ContractArtifact): HexkitPlugin {
  return {
    name: "contract-fixture",
    generate(context) {
      context.artifacts.publish(APICAL_CONTRACT_ARTIFACT, contract);
    },
  };
}

async function collectGeneratedFiles(contract: ContractArtifact): Promise<{
  files: GeneratedFile[];
  artifact: ApplicationArtifact;
}> {
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
  await createHexagonalPlugin().generate(context);

  return {
    files,
    artifact: context.artifacts.require(APPLICATION_ARTIFACT),
  };
}

describe("Given a ContractArtifact for Petstore", () => {
  it("when the hexagonal plugin runs, then it generates domain, ports, protected use cases, and ApplicationArtifact", async () => {
    const contract = await loadContract(petstoreOpenApi, {
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
    });

    const { files, artifact } = await collectGeneratedFiles(contract);

    expect(files.map((file) => ({ path: file.path, ownership: file.ownership }))).toEqual([
      { path: "src/core/domain/order.ts", ownership: "generated" },
      { path: "src/core/domain/pet.ts", ownership: "generated" },
      { path: "src/core/ports/order-repository.ts", ownership: "generated" },
      { path: "src/core/ports/pet-repository.ts", ownership: "generated" },
      { path: "src/core/application/add-pet.ts", ownership: "protected" },
      { path: "src/core/application/delete-order.ts", ownership: "protected" },
      { path: "src/core/application/delete-pet.ts", ownership: "protected" },
      { path: "src/core/application/get-order-by-id.ts", ownership: "protected" },
      { path: "src/core/application/get-pet-by-id.ts", ownership: "protected" },
      { path: "src/core/application/place-order.ts", ownership: "protected" },
      { path: "src/core/application/update-pet.ts", ownership: "protected" },
    ]);

    expect(files.find((file) => file.path === "src/core/domain/pet.ts")?.contents)
      .toMatchInlineSnapshot(`
        "export type PetStatus = "available" | "pending" | "sold";

        export type Pet = {
          id: number;
          name: string;
          status?: PetStatus;
        };
        "
      `);

    expect(files.find((file) => file.path === "src/core/ports/pet-repository.ts")?.contents)
      .toMatchInlineSnapshot(`
        "import type { Pet } from "../domain/pet.ts";

        export interface PetRepository {
          addPet(pet: Pet): Promise<Pet>;
          deletePet(petId: number): Promise<void>;
          getPetById(petId: number): Promise<Pet | undefined>;
          updatePet(pet: Pet): Promise<Pet>;
        }
        "
      `);

    expect(files.find((file) => file.path === "src/core/application/add-pet.ts")?.contents)
      .toMatchInlineSnapshot(`
        "import type { Pet } from "../domain/pet.ts";
        import type { PetRepository } from "../ports/pet-repository.ts";

        export type AddPet = (pet: Pet) => Promise<Pet>;

        export function createAddPet(pets: PetRepository): AddPet {
          return (pet) => pets.addPet(pet);
        }
        "
      `);

    expect(artifact).toMatchObject({
      artifactVersion: 1,
      entities: [
        { name: "Order", filePath: "src/core/domain/order.ts" },
        { name: "Pet", filePath: "src/core/domain/pet.ts" },
      ],
      repositories: [
        {
          aggregate: "Order",
          name: "OrderRepository",
          parameterName: "orders",
          methods: [
            { operationId: "deleteOrder", name: "deleteOrder" },
            { operationId: "getOrderById", name: "getOrderById" },
            { operationId: "placeOrder", name: "placeOrder" },
          ],
        },
        {
          aggregate: "Pet",
          name: "PetRepository",
          parameterName: "pets",
          methods: [
            { operationId: "addPet", name: "addPet" },
            { operationId: "deletePet", name: "deletePet" },
            { operationId: "getPetById", name: "getPetById" },
            { operationId: "updatePet", name: "updatePet" },
          ],
        },
      ],
      useCases: expect.arrayContaining([
        expect.objectContaining({
          operationId: "addPet",
          factoryName: "createAddPet",
          methodName: "addPet",
          repositoryParameterName: "pets",
        }),
        expect.objectContaining({
          operationId: "placeOrder",
          factoryName: "createPlaceOrder",
          methodName: "placeOrder",
          repositoryParameterName: "orders",
        }),
      ]),
    });
  });
});

describe("Given a ContractArtifact for Library", () => {
  it("when the hexagonal plugin runs, then it emits author/book domain files without Petstore output", async () => {
    const contract = await loadContract(libraryOpenApi, {
      schemas: new Map([
        ["Author", "schemas/Author.ts"],
        ["Book", "schemas/Book.ts"],
      ]),
      operations: new Map([
        ["createBook", "routes/createBook.ts"],
        ["getBook", "routes/getBook.ts"],
      ]),
    });

    const { files, artifact } = await collectGeneratedFiles(contract);
    const source = files.map((file) => file.contents).join("\n");

    expect(files.map((file) => file.path)).toEqual([
      "src/core/domain/author.ts",
      "src/core/domain/book.ts",
      "src/core/ports/book-repository.ts",
      "src/core/application/create-book.ts",
      "src/core/application/get-book.ts",
    ]);
    expect(source).not.toMatch(/\bPet\b|\bOrder\b|petstore|addPet|placeOrder/);
    expect(files.find((file) => file.path === "src/core/domain/book.ts")?.contents)
      .toMatchInlineSnapshot(`
        "export type Book = {
          id: number;
          authorId: number;
          title: string;
        };
        "
      `);
    expect(files.find((file) => file.path === "src/core/ports/book-repository.ts")?.contents)
      .toMatchInlineSnapshot(`
        "import type { Book } from "../domain/book.ts";

        export interface BookRepository {
          createBook(book: Book): Promise<Book>;
          getBook(bookId: number): Promise<Book | undefined>;
        }
        "
      `);
    expect(artifact.repositories).toEqual([
      expect.objectContaining({
        aggregate: "Book",
        parameterName: "books",
        methods: [
          expect.objectContaining({ operationId: "createBook", action: "create" }),
          expect.objectContaining({ operationId: "getBook", action: "getBook" }),
        ],
      }),
    ]);
  });
});

describe("Given a ContractArtifact with secured and public operations", () => {
  it("when an operation requires security, then the use case type accepts Principal first", async () => {
    const { files } = await collectGeneratedFiles(createAuthContract());

    const source = files.find(
      (file) => file.path === "src/core/application/create-item.ts",
    )?.contents;

    expect(source).toContain('import type { Principal } from "../domain/principal.ts";');
    expect(source).toContain(
      "export type CreateItem = (principal: Principal, item: Item) => Promise<Item>;",
    );
  });

  it("when an operation is public, then the use case type has no Principal", async () => {
    const { files } = await collectGeneratedFiles(createAuthContract());

    const source = files.find(
      (file) => file.path === "src/core/application/get-health.ts",
    )?.contents;

    expect(source).toContain("export type GetHealth = () => Promise<Item>;");
    expect(source).not.toContain("Principal");
  });

  it("when an operation only has a query parameter, then generation reports unsupported input", async () => {
    await expect(collectGeneratedFiles(createQueryOnlyContract())).rejects.toThrow(
      'Operation "searchItems" declares unsupported query parameter "term".',
    );
  });

  it("when any secured operation exists, then principal and authenticator port files are emitted", async () => {
    const { files, artifact } = await collectGeneratedFiles(createAuthContract());

    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining(["src/core/domain/principal.ts", "src/core/ports/authenticator.ts"]),
    );
    expect(files.find((file) => file.path === "src/core/domain/principal.ts")?.contents)
      .toMatchInlineSnapshot(`
        "export type Principal = {
          id: string;
          scheme: string;
          scopes: readonly string[];
        };
        "
      `);
    expect(files.find((file) => file.path === "src/core/ports/authenticator.ts")?.contents)
      .toMatchInlineSnapshot(`
        "import type { Principal } from "../domain/principal.ts";

        export type AuthCredentials =
          | { kind: "bearer"; schemeName: string; token: string }
          | { kind: "apiKey"; schemeName: string; headerName: string; apiKey: string };

        export type Authenticator = {
          authenticate(credentials: AuthCredentials): Promise<Principal | null>;
        };
        "
      `);
    expect(artifact.authenticatorPort).toEqual({
      name: "Authenticator",
      filePath: "src/core/ports/authenticator.ts",
    });
  });
});

describe("Given a generated core with a customized protected use case", () => {
  it("when generation runs again, then the custom source survives and a missing protected skeleton is restored", async () => {
    const contract = await loadContract(petstoreOpenApi, {
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
    });

    const outputDirectory = "/tmp/generated-petstore";
    const files = new Map<string, string>();
    const messages: string[] = [];
    const actions = {
      exists(path: string) {
        return files.has(path);
      },
      write(path: string, contents: string) {
        files.set(path, contents);
      },
      log(message: string) {
        messages.push(message);
      },
    };
    const options = {
      inputPath: petstoreOpenApi,
      outputDirectory,
      plugins: [createContractPublisher(contract), createHexagonalPlugin()],
    };

    await runPipeline(options, actions);

    const customizedPath = `${outputDirectory}/src/core/application/add-pet.ts`;
    const missingPath = `${outputDirectory}/src/core/application/get-order-by-id.ts`;
    const customizedSource = "export const customizedBusinessLogic = true;\n";
    files.set(customizedPath, customizedSource);
    files.delete(missingPath);

    await runPipeline(options, actions);

    expect(files.get(customizedPath)).toBe(customizedSource);
    expect(files.get(missingPath)).toContain("createGetOrderById");
    expect(messages).toEqual(
      expect.arrayContaining(["Skipped existing protected file: src/core/application/add-pet.ts"]),
    );
  });
});

describe("Given hexagonal production sources", () => {
  it("does not embed Petstore fixture literals outside tests", () => {
    const root = join(import.meta.dirname);
    const productionSources = listTypeScriptFiles(root).filter(
      (path) => !path.endsWith(".test.ts"),
    );
    const banned = /\bPet\b|\bOrder\b|petstore|addPet|placeOrder|getPetById/;

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

function createAuthContract(): ContractArtifact {
  const stringType = { kind: "string", nullable: false } as const;
  const itemReference = { kind: "reference", nullable: false, schema: "Item" } as const;
  const publicSecurity = {
    overridesGlobal: true,
    requirements: [],
    apicalServerHeaderNames: [],
  } as const;
  const apiKeySecurity = {
    overridesGlobal: true,
    requirements: [{ schemes: ["apiKey"], scopes: { apiKey: [] } }],
    apicalServerHeaderNames: ["x-api-key"],
  } as const;

  return {
    artifactVersion: 1,
    openapiVersion: "3.1.0",
    application: {
      title: "Auth API Fixture",
      version: "1.0.0",
      slug: "auth-api-fixture",
    },
    schemas: [
      {
        name: "Item",
        modulePath: "schemas/Item.ts",
        properties: [
          { name: "id", required: true, type: stringType },
          { name: "name", required: true, type: stringType },
        ],
      },
    ],
    securitySchemes: [{ name: "apiKey", type: "apiKey", in: "header", headerName: "X-API-Key" }],
    globalSecurity: [],
    operations: [
      {
        operationId: "createItem",
        method: "post",
        path: "/items",
        modulePath: "routes/createItem.ts",
        parameters: [],
        responses: [
          {
            status: "201",
            description: "created",
            media: [{ mediaType: "application/json", type: itemReference }],
          },
        ],
        security: apiKeySecurity,
        requestBody: {
          required: true,
          media: [{ mediaType: "application/json", type: itemReference }],
        },
        extension: { aggregate: "Item", action: "create" },
      },
      {
        operationId: "getHealth",
        method: "get",
        path: "/health",
        modulePath: "routes/getHealth.ts",
        parameters: [],
        responses: [
          {
            status: "200",
            description: "ok",
            media: [{ mediaType: "application/json", type: itemReference }],
          },
        ],
        security: publicSecurity,
        extension: { aggregate: "Item", action: "getHealth" },
      },
    ],
  };
}

function createQueryOnlyContract(): ContractArtifact {
  const stringType = { kind: "string", nullable: false } as const;
  const contract = createAuthContract();
  const getHealth = contract.operations.find((operation) => operation.operationId === "getHealth");
  if (getHealth === undefined) {
    throw new Error("Missing getHealth operation in auth contract fixture.");
  }

  return {
    ...contract,
    operations: [
      {
        ...getHealth,
        operationId: "searchItems",
        path: "/items/search",
        modulePath: "routes/searchItems.ts",
        parameters: [
          {
            name: "term",
            location: "query",
            required: false,
            type: stringType,
          },
        ],
        extension: { aggregate: "Item", action: "search" },
      },
    ],
  };
}
