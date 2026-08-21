import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vite-plus/test";

import type { FileWriterActions } from "@hexkit/core";
import {
  APICAL_CONTRACT_ARTIFACT,
  loadValidatedOpenApi,
  type ContractArtifact,
} from "@hexkit/plugin-apical";
import { createArtifactRegistry, type GeneratedFile } from "@hexkit/plugin-api";
import { PERSISTENCE_ARTIFACT, type PersistenceArtifact } from "@hexkit/plugin-drizzle";
import { HTTP_ARTIFACT, type HttpArtifact } from "@hexkit/plugin-hono";
import { NEXT_HTTP_ARTIFACT, type NextHttpArtifact } from "@hexkit/plugin-next";

import {
  createDefaultPlugins,
  createPackagingPlugin,
  generateApplication,
  generateNextPackagingFiles,
  main,
  parseArguments,
  runCli,
} from "./index.ts";

const petstoreApicalContractPaths = [
  "package.json",
  "routes/addPet.ts",
  "routes/deleteOrder.ts",
  "routes/deletePet.ts",
  "routes/getOrderById.ts",
  "routes/getPetById.ts",
  "routes/index.ts",
  "routes/placeOrder.ts",
  "routes/updatePet.ts",
  "schemas/Category.ts",
  "schemas/Order.ts",
  "schemas/Pet.ts",
  "schemas/Tag.ts",
  "schemas/addPetParameters.ts",
  "schemas/deleteOrderParameters.ts",
  "schemas/deletePetParameters.ts",
  "schemas/getOrderByIdParameters.ts",
  "schemas/getPetByIdParameters.ts",
  "schemas/index.ts",
  "schemas/placeOrderParameters.ts",
  "schemas/runtime.ts",
  "schemas/updatePetParameters.ts",
  "server/addPet.ts",
  "server/deleteOrder.ts",
  "server/deletePet.ts",
  "server/getOrderById.ts",
  "server/getPetById.ts",
  "server/index.ts",
  "server/placeOrder.ts",
  "server/updatePet.ts",
  "standard-schema.ts",
  "tsconfig.json",
] as const;

const libraryApicalContractPaths = [
  "package.json",
  "routes/createBook.ts",
  "routes/getBook.ts",
  "routes/index.ts",
  "schemas/Author.ts",
  "schemas/Book.ts",
  "schemas/createBookParameters.ts",
  "schemas/getBookParameters.ts",
  "schemas/index.ts",
  "schemas/runtime.ts",
  "server/createBook.ts",
  "server/getBook.ts",
  "server/index.ts",
  "standard-schema.ts",
  "tsconfig.json",
] as const;

const petstoreContract = new URL("../../petstore-sample/openapi.poc.yaml", import.meta.url);
const libraryContract = new URL("../../fixtures/library-api/openapi.yaml", import.meta.url);

const petstoreSchemasIndex = `
import { Category } from "./Category.ts";
import { Order } from "./Order.ts";
import { Pet } from "./Pet.ts";
import { Tag } from "./Tag.ts";
export { Category, Order, Pet, Tag };
`;

const petstoreRoutesIndex = `
import { serverRoute as addPetRoute } from "./addPet.ts";
import { serverRoute as updatePetRoute } from "./updatePet.ts";
import { serverRoute as getPetByIdRoute } from "./getPetById.ts";
import { serverRoute as deletePetRoute } from "./deletePet.ts";
import { serverRoute as placeOrderRoute } from "./placeOrder.ts";
import { serverRoute as getOrderByIdRoute } from "./getOrderById.ts";
import { serverRoute as deleteOrderRoute } from "./deleteOrder.ts";
export const routes = {
  addPet: addPetRoute,
  updatePet: updatePetRoute,
  getPetById: getPetByIdRoute,
  deletePet: deletePetRoute,
  placeOrder: placeOrderRoute,
  getOrderById: getOrderByIdRoute,
  deleteOrder: deleteOrderRoute,
} as const;
`;

const librarySchemasIndex = `
import { Author } from "./Author.ts";
import { Book } from "./Book.ts";
export { Author, Book };
`;

const libraryRoutesIndex = `
import { serverRoute as createBookRoute } from "./createBook.ts";
import { serverRoute as getBookRoute } from "./getBook.ts";
export const routes = {
  createBook: createBookRoute,
  getBook: getBookRoute,
} as const;
`;

async function runAssembledCliGeneration(options: {
  inputName: string;
  outputDirectory: string;
  openApiPath: string;
  apicalPaths: readonly string[];
  schemasIndex: string;
  routesIndex: string;
}): Promise<{ exitCode: number; craftCalls: string[][]; files: Map<string, string> }> {
  const files = new Map<string, string>();
  const craftCalls: string[][] = [];
  const actions: FileWriterActions = {
    exists(path: string) {
      return files.has(path);
    },
    write(path: string, contents: string) {
      files.set(path, contents);
    },
    log() {},
  };

  const exitCode = await main(["generate", options.inputName, options.outputDirectory], {
    actions,
    inputExists: (path: string) => path === options.inputName,
    log() {},
    apical: {
      async runCraft(arguments_: readonly string[]) {
        craftCalls.push([...arguments_]);
        const outputFlag = arguments_.indexOf("-o");
        const contractsDirectory = arguments_[outputFlag + 1];
        if (!contractsDirectory) throw new Error("Craft output argument is missing");

        for (const path of options.apicalPaths) {
          const contents =
            path === "schemas/index.ts"
              ? options.schemasIndex
              : path === "routes/index.ts"
                ? options.routesIndex
                : "";
          actions.write(join(contractsDirectory, path), contents);
        }
      },
      loadOpenApi: () => loadValidatedOpenApi(options.openApiPath),
      async readGeneratedFile(path) {
        const contents = files.get(path);
        if (contents === undefined) {
          throw new Error(`Missing virtual Apical output: ${path}`);
        }
        return contents;
      },
    },
  });

  return { exitCode, craftCalls, files };
}

describe("Given a Hexkit CLI invocation", () => {
  it("when help is requested, then it prints the snapshotted command help and succeeds", async () => {
    const messages: string[] = [];

    const exitCode = await runCli(["--help"], {
      generate() {
        throw new Error("help must not generate");
      },
      log(text: string) {
        messages.push(text);
      },
    });

    expect(exitCode).toBe(0);
    expect(messages).toMatchInlineSnapshot(`
      [
        "Hexkit

      Usage:
        hexkit generate <openapi> <output> [--http hono|next] [--next-surface both|routes|rsc]
        hexkit --help

      Commands:
        generate  Generate a compose-ready application from an OpenAPI document

      Options:
        --http <adapter>       Select HTTP adapter: hono (default) or next
        --next-surface <mode>  Select Next output when --http next: both (default), routes, or rsc
        -h, --help             Show this help",
      ]
    `);
  });

  it("when generate has no OpenAPI input, then it reports a clear error and fails", async () => {
    const messages: string[] = [];

    const exitCode = await runCli(["generate"], {
      generate() {
        throw new Error("invalid arguments must not generate");
      },
      log(text: string) {
        messages.push(text);
      },
    });

    expect(exitCode).toBe(1);
    expect(messages[0]).toBe("Error: Missing OpenAPI input path.");
    expect(messages[1]).toContain("hexkit generate <openapi> <output>");
  });

  it("when generate receives an input and output, then it invokes generation exactly once", async () => {
    const calls: Array<{ inputPath: string; outputDirectory: string; http: string }> = [];

    const exitCode = await runCli(["generate", "petstore.yaml", "generated/petstore"], {
      async generate(inputPath: string, outputDirectory: string, options = { http: "hono" }) {
        await Promise.resolve();
        calls.push({ inputPath, outputDirectory, http: options.http });
      },
      log() {},
    });

    expect(exitCode).toBe(0);
    expect(calls).toEqual([
      {
        inputPath: "petstore.yaml",
        outputDirectory: "generated/petstore",
        http: "hono",
      },
    ]);
  });

  it("when arguments are parsed, then parsing is a pure command calculation", () => {
    expect(parseArguments(["generate", "petstore.yaml", "generated/petstore"])).toEqual({
      kind: "generate",
      inputPath: "petstore.yaml",
      outputDirectory: "generated/petstore",
      http: "hono",
    });
  });

  it("when --http next is parsed, then the Next adapter is selected with surface both by default", () => {
    expect(
      parseArguments(["generate", "petstore.yaml", "generated/petstore", "--http", "next"]),
    ).toEqual({
      kind: "generate",
      inputPath: "petstore.yaml",
      outputDirectory: "generated/petstore",
      http: "next",
      nextSurface: "both",
    });
  });

  it("when --next-surface is passed without --http next, then the CLI errors", async () => {
    const messages: string[] = [];

    const exitCode = await runCli(
      ["generate", "petstore.yaml", "generated/petstore", "--next-surface", "routes"],
      {
        generate() {
          throw new Error("invalid arguments must not generate");
        },
        log(text: string) {
          messages.push(text);
        },
      },
    );

    expect(exitCode).toBe(1);
    expect(messages[0]).toBe("Error: --next-surface can only be used with --http next.");
  });

  it("when --http is missing a value, then parsing reports a clear error", () => {
    expect(parseArguments(["generate", "petstore.yaml", "out", "--http"])).toEqual({
      kind: "error",
      message: "--http requires a value.",
    });
  });

  it("when --http receives an unsupported adapter, then parsing reports a clear error", () => {
    expect(parseArguments(["generate", "petstore.yaml", "out", "--http", "express"])).toEqual({
      kind: "error",
      message: "Unsupported HTTP adapter: express",
    });
  });

  it("when --next-surface is missing a value, then parsing reports a clear error", () => {
    expect(
      parseArguments(["generate", "petstore.yaml", "out", "--http", "next", "--next-surface"]),
    ).toEqual({
      kind: "error",
      message: "--next-surface requires a value.",
    });
  });

  it("when --next-surface receives an unsupported mode, then parsing reports a clear error", () => {
    expect(
      parseArguments([
        "generate",
        "petstore.yaml",
        "out",
        "--http",
        "next",
        "--next-surface",
        "pages",
      ]),
    ).toEqual({
      kind: "error",
      message: "Unsupported Next surface: pages",
    });
  });

  it("when generate receives an unexpected flag, then parsing reports a clear error", () => {
    expect(parseArguments(["generate", "petstore.yaml", "out", "--verbose"])).toEqual({
      kind: "error",
      message: "Unexpected argument: --verbose",
    });
  });

  it("when --http next is passed, then generation receives the Next surface selection", async () => {
    const calls: Array<{ http: string; nextSurface: string }> = [];

    const exitCode = await runCli(
      [
        "generate",
        "petstore.yaml",
        "generated/petstore",
        "--http",
        "next",
        "--next-surface",
        "routes",
      ],
      {
        async generate(
          _inputPath,
          _outputDirectory,
          options: { http: string; nextSurface?: string } = { http: "hono" },
        ) {
          await Promise.resolve();
          calls.push({ http: options.http, nextSurface: options.nextSurface ?? "both" });
        },
        log() {},
      },
    );

    expect(exitCode).toBe(0);
    expect(calls).toEqual([{ http: "next", nextSurface: "routes" }]);
  });

  it("when an async plugin fails, then main waits for and reports the failure", async () => {
    const messages: string[] = [];

    const exitCode = await main(["generate", "library.yaml", "/virtual/library"], {
      actions: {
        exists: () => false,
        write() {},
        log() {},
      },
      inputExists: () => true,
      plugins: [
        {
          name: "failing",
          async generate() {
            await Promise.resolve();
            throw new Error("async generation failed");
          },
        },
      ],
      log(message) {
        messages.push(message);
      },
    });

    expect(exitCode).toBe(1);
    expect(messages).toEqual(["Error: async generation failed"]);
  });

  it("when main receives a log function, then it treats the function as the logger", async () => {
    const messages: string[] = [];

    const exitCode = await main(["--help"], (text) => {
      messages.push(text);
    });

    expect(exitCode).toBe(0);
    expect(messages[0]).toContain("hexkit generate");
  });

  it("when the package entry is executed as the main module, then it assigns process.exitCode from main", async () => {
    const indexPath = fileURLToPath(new URL("./index.ts", import.meta.url));
    const previousArgv = process.argv;
    const previousExitCode = process.exitCode;
    process.argv = [process.execPath, indexPath, "--help"];
    process.exitCode = undefined;

    try {
      vi.resetModules();
      await import("./index.ts");
      expect(process.exitCode).toBe(0);
    } finally {
      process.argv = previousArgv;
      process.exitCode = previousExitCode;
      vi.resetModules();
    }
  });
});

describe("Given the default generation pipeline", () => {
  it("when plugins are selected, then Apical, hexagonal, Hono, Drizzle, and packaging are ordered", () => {
    expect(createDefaultPlugins().map((plugin) => plugin.name)).toEqual([
      "apical",
      "architecture-hexagonal",
      "hono",
      "drizzle",
      "packaging",
    ]);
  });

  it("when the Next adapter is selected, then the default pipeline swaps Hono for Next before Drizzle packaging", () => {
    expect(
      createDefaultPlugins({
        http: "next",
        nextSurface: "routes",
      } as Parameters<typeof createDefaultPlugins>[0] & {
        http: "next";
        nextSurface: "routes";
      }).map((plugin) => plugin.name),
    ).toEqual(["apical", "architecture-hexagonal", "next", "drizzle", "packaging"]);
  });

  it("when nextSurface is set without the Next adapter, then createDefaultPlugins fails clearly", () => {
    expect(() => createDefaultPlugins({ nextSurface: "routes" })).toThrow(
      "--next-surface can only be used with --http next.",
    );
  });

  it("when generateApplication uses default filesystem actions, then it writes nested files to disk", async () => {
    const root = mkdtempSync(join(tmpdir(), "hexkit-cli-actions-"));
    const outputDirectory = join(root, "out");

    try {
      await generateApplication("virtual.yaml", outputDirectory, {
        inputExists: () => true,
        plugins: [
          {
            name: "emit",
            generate(context) {
              context.writeFile({
                path: "nested/hello.txt",
                contents: "hello",
                ownership: "generated",
              });
            },
          },
        ],
      });

      expect(readFileSync(join(outputDirectory, "nested/hello.txt"), "utf8")).toBe("hello");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("when the assembled CLI generates Petstore, then injected Craft and filesystem edges receive the complete application", async () => {
    const outputDirectory = "/virtual/generated-petstore";
    const { exitCode, craftCalls, files } = await runAssembledCliGeneration({
      inputName: "petstore.yaml",
      outputDirectory,
      openApiPath: petstoreContract.pathname,
      apicalPaths: petstoreApicalContractPaths,
      schemasIndex: petstoreSchemasIndex,
      routesIndex: petstoreRoutesIndex,
    });

    expect(exitCode).toBe(0);
    expect(craftCalls).toEqual([
      [
        "generate",
        "-i",
        "petstore.yaml",
        "-o",
        "/virtual/generated-petstore/src/generated/contracts",
        "--server",
        "--routes",
      ],
    ]);
    expect([...files.keys()].map((path) => relative(outputDirectory, path)).sort())
      .toMatchInlineSnapshot(`
      [
        ".dockerignore",
        "Dockerfile",
        "docker-compose.yml",
        "drizzle/0000_hexkit-petstore-poc.sql",
        "package.json",
        "scripts/start.sh",
        "src/adapters/db/mappers.ts",
        "src/adapters/db/order-repository.ts",
        "src/adapters/db/pet-repository.ts",
        "src/adapters/db/schema.ts",
        "src/adapters/http/controllers.ts",
        "src/adapters/http/routes.ts",
        "src/core/application/add-pet.ts",
        "src/core/application/delete-order.ts",
        "src/core/application/delete-pet.ts",
        "src/core/application/get-order-by-id.ts",
        "src/core/application/get-pet-by-id.ts",
        "src/core/application/place-order.ts",
        "src/core/application/update-pet.ts",
        "src/core/domain/category.ts",
        "src/core/domain/order.ts",
        "src/core/domain/pet.ts",
        "src/core/domain/tag.ts",
        "src/core/ports/order-repository.ts",
        "src/core/ports/pet-repository.ts",
        "src/generated/contracts/hexkit-contract.json",
        "src/generated/contracts/package.json",
        "src/generated/contracts/routes/addPet.ts",
        "src/generated/contracts/routes/deleteOrder.ts",
        "src/generated/contracts/routes/deletePet.ts",
        "src/generated/contracts/routes/getOrderById.ts",
        "src/generated/contracts/routes/getPetById.ts",
        "src/generated/contracts/routes/index.ts",
        "src/generated/contracts/routes/placeOrder.ts",
        "src/generated/contracts/routes/updatePet.ts",
        "src/generated/contracts/schemas/Category.ts",
        "src/generated/contracts/schemas/Order.ts",
        "src/generated/contracts/schemas/Pet.ts",
        "src/generated/contracts/schemas/Tag.ts",
        "src/generated/contracts/schemas/addPetParameters.ts",
        "src/generated/contracts/schemas/deleteOrderParameters.ts",
        "src/generated/contracts/schemas/deletePetParameters.ts",
        "src/generated/contracts/schemas/getOrderByIdParameters.ts",
        "src/generated/contracts/schemas/getPetByIdParameters.ts",
        "src/generated/contracts/schemas/index.ts",
        "src/generated/contracts/schemas/placeOrderParameters.ts",
        "src/generated/contracts/schemas/runtime.ts",
        "src/generated/contracts/schemas/updatePetParameters.ts",
        "src/generated/contracts/server/addPet.ts",
        "src/generated/contracts/server/deleteOrder.ts",
        "src/generated/contracts/server/deletePet.ts",
        "src/generated/contracts/server/getOrderById.ts",
        "src/generated/contracts/server/getPetById.ts",
        "src/generated/contracts/server/index.ts",
        "src/generated/contracts/server/placeOrder.ts",
        "src/generated/contracts/server/updatePet.ts",
        "src/generated/contracts/standard-schema.ts",
        "src/generated/contracts/tsconfig.json",
        "src/runtime/app.ts",
        "src/runtime/server.ts",
        "tsconfig.json",
      ]
    `);
  });

  it("when the assembled CLI generates Library, then author/book artifacts emit without Petstore output", async () => {
    const outputDirectory = "/virtual/generated-library";
    const { exitCode, files } = await runAssembledCliGeneration({
      inputName: "library.yaml",
      outputDirectory,
      openApiPath: libraryContract.pathname,
      apicalPaths: libraryApicalContractPaths,
      schemasIndex: librarySchemasIndex,
      routesIndex: libraryRoutesIndex,
    });

    expect(exitCode).toBe(0);

    const relativePaths = [...files.keys()].map((path) => relative(outputDirectory, path)).sort();
    const source = [...files.values()].join("\n");
    const packageManifest = JSON.parse(
      files.get(join(outputDirectory, "package.json")) ?? "{}",
    ) as { name: string; scripts: Record<string, string> };
    const schema = files.get(join(outputDirectory, "src/adapters/db/schema.ts")) ?? "";
    const migration = files.get(join(outputDirectory, "drizzle/0000_hexkit-library-api.sql")) ?? "";
    const routes = files.get(join(outputDirectory, "src/adapters/http/routes.ts")) ?? "";

    expect(relativePaths).toEqual(
      expect.arrayContaining([
        "drizzle/0000_hexkit-library-api.sql",
        "src/adapters/db/book-repository.ts",
        "src/adapters/db/schema.ts",
        "src/adapters/http/routes.ts",
        "src/core/application/create-book.ts",
        "src/core/application/get-book.ts",
        "src/core/domain/author.ts",
        "src/core/domain/book.ts",
        "src/core/ports/book-repository.ts",
        "src/generated/contracts/routes/createBook.ts",
        "src/generated/contracts/schemas/Author.ts",
        "src/generated/contracts/schemas/Book.ts",
      ]),
    );
    expect(relativePaths).not.toEqual(
      expect.arrayContaining([
        "drizzle/0000_hexkit-petstore-poc.sql",
        "src/adapters/db/pet-repository.ts",
        "src/core/domain/pet.ts",
        "src/adapters/db/author-repository.ts",
      ]),
    );
    expect(packageManifest.name).toBe("generated-hexkit-library-api");
    expect(packageManifest.scripts.migrate).toContain("drizzle/0000_hexkit-library-api.sql");
    expect(schema).toContain('pgTable("authors"');
    expect(schema).toContain('pgTable("books"');
    expect(schema).toContain(".references(() => authors.id)");
    expect(migration).toContain('FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id")');
    expect(routes).toContain('app.post("/books"');
    expect(routes).toContain('app.get("/books/:bookId"');
    expect(source).not.toMatch(/\bPet\b|\bOrder\b|petstore|addPet|placeOrder/);
  });

  it("when the assembled CLI receives a nonexistent OpenAPI path, then it reports the path and fails without generation", async () => {
    const messages: string[] = [];
    let craftCalled = false;

    const exitCode = await main(["generate", "missing.yaml", "/virtual/output"], {
      actions: {
        exists: () => false,
        write() {
          throw new Error("nonexistent input must not write");
        },
        log() {},
      },
      inputExists: () => false,
      log(text: string) {
        messages.push(text);
      },
      apical: {
        async runCraft() {
          craftCalled = true;
        },
      },
    });

    expect(exitCode).toBe(1);
    expect(craftCalled).toBe(false);
    expect(messages).toEqual(["Error: OpenAPI input not found: missing.yaml"]);
  });
});

describe("Given the published CLI package", () => {
  it("when package binaries are resolved, then the advertised hexkit command points to the build", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { bin?: Record<string, string> };

    expect(packageJson.bin).toEqual({
      hexkit: "./dist/index.mjs",
    });
  });

  it("when package dependencies are resolved, then the Next plugin is available to the CLI", () => {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { dependencies?: Record<string, string> };

    expect(packageJson.dependencies).toMatchObject({
      "@hexkit/plugin-next": "workspace:*",
    });
  });
});

describe("Given compose-ready generated packaging", () => {
  function petstorePackagingArtifacts(): {
    contract: ContractArtifact;
    http: HttpArtifact;
    persistence: PersistenceArtifact;
  } {
    return {
      contract: {
        artifactVersion: 1,
        openapiVersion: "3.1.0",
        application: {
          title: "Hexkit Petstore PoC",
          version: "1.0.0",
          slug: "hexkit-petstore-poc",
        },
        schemas: [],
        securitySchemes: [],
        globalSecurity: [],
        operations: [],
      },
      http: {
        artifactVersion: 1,
        controllersFilePath: "src/adapters/http/controllers.ts",
        routesFilePath: "src/adapters/http/routes.ts",
        runtimeFilePath: "src/runtime/app.ts",
        createAppFactoryName: "createApp",
        createHonoAppFactoryName: "createHonoApp",
        runtimeRepositoriesTypeName: "RuntimeRepositories",
        repositories: [
          {
            parameterName: "orders",
            repositoryName: "OrderRepository",
            repositoryFilePath: "src/core/ports/order-repository.ts",
          },
          {
            parameterName: "pets",
            repositoryName: "PetRepository",
            repositoryFilePath: "src/core/ports/pet-repository.ts",
          },
        ],
        operations: [],
      },
      persistence: {
        artifactVersion: 1,
        schemaFilePath: "src/adapters/db/schema.ts",
        mapperFilePath: "src/adapters/db/mappers.ts",
        migrationPath: "drizzle/0000_hexkit-petstore-poc.sql",
        tables: [],
        mappers: [],
        repositories: [
          {
            aggregate: "Order",
            portName: "OrderRepository",
            factoryName: "createDrizzleOrderRepository",
            filePath: "src/adapters/db/order-repository.ts",
            runtimeKey: "orders",
          },
          {
            aggregate: "Pet",
            portName: "PetRepository",
            factoryName: "createDrizzlePetRepository",
            filePath: "src/adapters/db/pet-repository.ts",
            runtimeKey: "pets",
          },
        ],
      },
    };
  }

  function libraryPackagingArtifacts(): {
    contract: ContractArtifact;
    http: HttpArtifact;
    persistence: PersistenceArtifact;
  } {
    return {
      contract: {
        artifactVersion: 1,
        openapiVersion: "3.1.0",
        application: {
          title: "Hexkit Library API",
          version: "1.0.0",
          slug: "hexkit-library-api",
        },
        schemas: [],
        securitySchemes: [],
        globalSecurity: [],
        operations: [],
      },
      http: {
        artifactVersion: 1,
        controllersFilePath: "src/adapters/http/controllers.ts",
        routesFilePath: "src/adapters/http/routes.ts",
        runtimeFilePath: "src/runtime/app.ts",
        createAppFactoryName: "createApp",
        createHonoAppFactoryName: "createHonoApp",
        runtimeRepositoriesTypeName: "RuntimeRepositories",
        repositories: [
          {
            parameterName: "authors",
            repositoryName: "AuthorRepository",
            repositoryFilePath: "src/core/ports/author-repository.ts",
          },
          {
            parameterName: "books",
            repositoryName: "BookRepository",
            repositoryFilePath: "src/core/ports/book-repository.ts",
          },
        ],
        operations: [],
      },
      persistence: {
        artifactVersion: 1,
        schemaFilePath: "src/adapters/db/schema.ts",
        mapperFilePath: "src/adapters/db/mappers.ts",
        migrationPath: "drizzle/0000_hexkit-library-api.sql",
        tables: [],
        mappers: [],
        repositories: [
          {
            aggregate: "Author",
            portName: "AuthorRepository",
            factoryName: "createDrizzleAuthorRepository",
            filePath: "src/adapters/db/author-repository.ts",
            runtimeKey: "authors",
          },
          {
            aggregate: "Book",
            portName: "BookRepository",
            factoryName: "createDrizzleBookRepository",
            filePath: "src/adapters/db/book-repository.ts",
            runtimeKey: "books",
          },
        ],
      },
    };
  }

  async function runPackaging(
    artifacts: ReturnType<typeof petstorePackagingArtifacts>,
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const registry = createArtifactRegistry();
    registry.publish(APICAL_CONTRACT_ARTIFACT, artifacts.contract);
    registry.publish(HTTP_ARTIFACT, artifacts.http);
    registry.publish(PERSISTENCE_ARTIFACT, artifacts.persistence);

    await createPackagingPlugin().generate({
      inputPath: "openapi.yaml",
      outputDirectory: "generated/app",
      artifacts: registry,
      writeFile(file: GeneratedFile) {
        files.push(file);
      },
      log() {},
    });

    return files;
  }

  it("when the packaging plugin runs, then it emits the snapshotted container and startup paths", async () => {
    const files = await runPackaging(petstorePackagingArtifacts());

    expect(files.map(({ path, ownership }) => ({ path, ownership }))).toMatchInlineSnapshot(`
      [
        {
          "ownership": "generated",
          "path": "package.json",
        },
        {
          "ownership": "generated",
          "path": "tsconfig.json",
        },
        {
          "ownership": "generated",
          "path": "src/runtime/server.ts",
        },
        {
          "ownership": "generated",
          "path": "scripts/start.sh",
        },
        {
          "ownership": "generated",
          "path": "Dockerfile",
        },
        {
          "ownership": "generated",
          "path": "docker-compose.yml",
        },
        {
          "ownership": "generated",
          "path": ".dockerignore",
        },
      ]
    `);

    const compose = files.find((file: GeneratedFile) => file.path === "docker-compose.yml");
    expect(compose?.contents).toMatchInlineSnapshot(`
      "services:
        postgres:
          image: postgres:17-alpine
          environment:
            POSTGRES_DB: \${POSTGRES_DB:-hexkit_petstore_poc}
            POSTGRES_USER: \${POSTGRES_USER:-hexkit_petstore_poc}
            POSTGRES_PASSWORD: \${POSTGRES_PASSWORD:-hexkit_petstore_poc}
          healthcheck:
            test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
            interval: 2s
            timeout: 5s
            retries: 15
          volumes:
            - postgres-data:/var/lib/postgresql/data

        app:
          build: .
          environment:
            DATABASE_URL: postgres://\${POSTGRES_USER:-hexkit_petstore_poc}:\${POSTGRES_PASSWORD:-hexkit_petstore_poc}@postgres:5432/\${POSTGRES_DB:-hexkit_petstore_poc}
            PORT: "3000"
          depends_on:
            postgres:
              condition: service_healthy
          ports:
            - "3000:3000"

      volumes:
        postgres-data:
      "
    `);

    const startScript = files.find((file: GeneratedFile) => file.path === "scripts/start.sh");
    expect(startScript?.contents).toContain(
      'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/0000_hexkit-petstore-poc.sql',
    );
    expect(startScript?.contents).toContain("exec node src/runtime/server.ts");
    expect(startScript?.contents).not.toContain("pnpm");

    const server = files.find((file: GeneratedFile) => file.path === "src/runtime/server.ts");
    expect(server?.contents).toContain("createDrizzleOrderRepository");
    expect(server?.contents).toContain("createDrizzlePetRepository");
    expect(server?.contents).toContain("orders: createDrizzleOrderRepository(db)");
    expect(server?.contents).toContain("pets: createDrizzlePetRepository(db)");
    expect(server?.contents).toContain("Hexkit Petstore PoC listening on");
  });

  it("when packaging Library artifacts, then names and wiring come from the contract slug", async () => {
    const files = await runPackaging(libraryPackagingArtifacts());
    const packageFile = files.find((file: GeneratedFile) => file.path === "package.json");
    const manifest = JSON.parse(packageFile?.contents ?? "") as {
      name: string;
      scripts: Record<string, string>;
    };

    expect(manifest.name).toBe("generated-hexkit-library-api");
    expect(manifest.scripts.migrate).toBe(
      'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/0000_hexkit-library-api.sql',
    );

    const server = files.find((file: GeneratedFile) => file.path === "src/runtime/server.ts");
    expect(server?.contents).toContain("createDrizzleAuthorRepository");
    expect(server?.contents).toContain("createDrizzleBookRepository");
    expect(server?.contents).toContain("authors: createDrizzleAuthorRepository(db)");
    expect(server?.contents).toContain("books: createDrizzleBookRepository(db)");
    expect(server?.contents).not.toContain("Pet");
    expect(server?.contents).not.toContain("Order");
    expect(server?.contents).not.toContain("petstore");
  });

  it("when the package manifest is emitted, then source build and runtime dependencies use current versions", async () => {
    const files = await runPackaging(petstorePackagingArtifacts());

    const packageFile = files.find((file: GeneratedFile) => file.path === "package.json");
    expect(packageFile).toBeDefined();
    const manifest = JSON.parse(packageFile?.contents ?? "") as {
      name: string;
      dependencies: Record<string, string>;
      scripts: Record<string, string>;
    };

    expect(manifest.name).toBe("generated-hexkit-petstore-poc");
    expect(manifest.scripts.migrate).toBe(
      'psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f drizzle/0000_hexkit-petstore-poc.sql',
    );
    expect(manifest.dependencies).toEqual({
      "@hono/node-server": "2.0.12",
      "@standard-schema/spec": "1.1.0",
      "drizzle-orm": "0.45.2",
      hono: "4.13.0",
      pg: "8.22.0",
      zod: "4.4.3",
    });
  });

  it("when TypeScript config is emitted, then it remains compatible with Apical generated imports", async () => {
    const files = await runPackaging(petstorePackagingArtifacts());

    const tsconfigFile = files.find((file: GeneratedFile) => file.path === "tsconfig.json");
    expect(tsconfigFile).toBeDefined();
    const tsconfig = JSON.parse(tsconfigFile?.contents ?? "") as {
      compilerOptions: Record<string, unknown>;
    };

    expect(tsconfig.compilerOptions).not.toHaveProperty("noUnusedLocals");
  });

  it("when HTTP and persistence repository keys diverge, then packaging fails clearly", async () => {
    const artifacts = petstorePackagingArtifacts();
    artifacts.persistence = {
      ...artifacts.persistence,
      repositories: [
        {
          aggregate: "Pet",
          portName: "PetRepository",
          factoryName: "createDrizzlePetRepository",
          filePath: "src/adapters/db/pet-repository.ts",
          runtimeKey: "animals",
        },
      ],
    };

    await expect(runPackaging(artifacts)).rejects.toThrow(
      'PersistenceArtifact repository runtime key "animals" is missing from HttpArtifact repositories.',
    );
  });

  it("when HTTP declares a repository without a persistence factory, then packaging fails clearly", async () => {
    const artifacts = petstorePackagingArtifacts();
    artifacts.persistence = {
      ...artifacts.persistence,
      repositories: artifacts.persistence.repositories.filter(
        (repository) => repository.runtimeKey === "pets",
      ),
    };

    await expect(runPackaging(artifacts)).rejects.toThrow(
      'HttpArtifact repository parameter "orders" has no PersistenceArtifact factory binding.',
    );
  });

  function nextPackagingArtifacts(): {
    contract: ContractArtifact;
    nextHttp: NextHttpArtifact;
    persistence: PersistenceArtifact;
  } {
    const { contract, persistence } = petstorePackagingArtifacts();
    return {
      contract,
      nextHttp: {
        artifactVersion: 1,
        surface: "routes",
        serverAccessFilePath: "src/adapters/http-next/server-access.ts",
        routes: [],
        uiPages: [],
        repositories: [
          {
            aggregate: "Order",
            name: "OrderRepository",
            filePath: "src/core/ports/order-repository.ts",
            parameterName: "orders",
            methods: [],
          },
          {
            aggregate: "Pet",
            name: "PetRepository",
            filePath: "src/core/ports/pet-repository.ts",
            parameterName: "pets",
            methods: [],
          },
        ],
      },
      persistence,
    };
  }

  async function runNextPackaging(
    artifacts: ReturnType<typeof nextPackagingArtifacts>,
  ): Promise<GeneratedFile[]> {
    const files: GeneratedFile[] = [];
    const registry = createArtifactRegistry();
    registry.publish(APICAL_CONTRACT_ARTIFACT, artifacts.contract);
    registry.publish(NEXT_HTTP_ARTIFACT, artifacts.nextHttp);
    registry.publish(PERSISTENCE_ARTIFACT, artifacts.persistence);

    await createPackagingPlugin({ http: "next" }).generate({
      inputPath: "openapi.yaml",
      outputDirectory: "generated/app",
      artifacts: registry,
      writeFile(file: GeneratedFile) {
        files.push(file);
      },
      log() {},
    });

    return files;
  }

  it("when Next packaging runs with matching repositories, then it emits Next compose files", async () => {
    const files = await runNextPackaging(nextPackagingArtifacts());
    expect(files.map((file) => file.path)).toEqual(
      expect.arrayContaining([
        "package.json",
        "src/adapters/db/database.ts",
        "docker-compose.yml",
        "scripts/start.sh",
      ]),
    );
  });

  it("when Next persistence keys diverge from NextHttpArtifact, then packaging fails clearly", async () => {
    const artifacts = nextPackagingArtifacts();
    artifacts.persistence = {
      ...artifacts.persistence,
      repositories: [
        {
          aggregate: "Pet",
          portName: "PetRepository",
          factoryName: "createDrizzlePetRepository",
          filePath: "src/adapters/db/pet-repository.ts",
          runtimeKey: "animals",
        },
      ],
    };

    await expect(runNextPackaging(artifacts)).rejects.toThrow(
      'PersistenceArtifact repository runtime key "animals" is missing from NextHttpArtifact repositories.',
    );
  });

  it("when NextHttpArtifact declares a repository without a persistence factory, then packaging fails clearly", async () => {
    const artifacts = nextPackagingArtifacts();
    artifacts.persistence = {
      ...artifacts.persistence,
      repositories: artifacts.persistence.repositories.filter(
        (repository) => repository.runtimeKey === "pets",
      ),
    };

    expect(() =>
      generateNextPackagingFiles({
        contract: artifacts.contract,
        nextHttp: artifacts.nextHttp,
        persistence: artifacts.persistence,
      }),
    ).toThrow(
      'NextHttpArtifact repository parameter "orders" has no PersistenceArtifact factory binding.',
    );
  });
});
