import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vite-plus/test";

import {
  APPLICATION_ARTIFACT,
  generateApplicationFromContract,
} from "@hexkit/plugin-architecture-hexagonal";
import {
  APICAL_CONTRACT_ARTIFACT,
  loadValidatedOpenApi,
  normalizeContractArtifact,
  type ContractArtifact,
} from "@hexkit/plugin-apical";
import { createApicalPlugin } from "@hexkit/plugin-apical";
import { createHexagonalPlugin } from "@hexkit/plugin-architecture-hexagonal";
import {
  createArtifactRegistry,
  type GeneratedFile,
  type GenerationContext,
} from "@hexkit/plugin-api";

import { HTTP_ARTIFACT, type HttpArtifact } from "./artifact.ts";
import { createHonoPlugin } from "./plugin.ts";

const require = createRequire(import.meta.url);

const petstoreOpenApi = new URL("../../../apps/petstore-sample/openapi.poc.yaml", import.meta.url)
  .pathname;
const libraryOpenApi = new URL(
  "../../plugin-apical/src/__fixtures__/library-api.yaml",
  import.meta.url,
).pathname;

const productionSourceRoots = ["artifact.ts", "generate", "model", "plugin.ts", "index.ts"];

async function loadContract(
  openApiPath: string,
  modules: {
    schemas: ReadonlyMap<string, string>;
    operations: ReadonlyMap<string, string>;
  },
): Promise<ContractArtifact> {
  return normalizeContractArtifact(await loadValidatedOpenApi(openApiPath), modules);
}

async function collectGeneratedFiles(contract: ContractArtifact): Promise<{
  files: GeneratedFile[];
  artifact: HttpArtifact;
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

  const { artifact: application } = generateApplicationFromContract(contract);
  context.artifacts.publish(APICAL_CONTRACT_ARTIFACT, contract);
  context.artifacts.publish(APPLICATION_ARTIFACT, application);
  await createHonoPlugin().generate(context);

  return {
    files,
    artifact: context.artifacts.require(HTTP_ARTIFACT),
  };
}

const generatedDirectories: string[] = [];

afterEach(() => {
  for (const directory of generatedDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function materializeGeneratedApp(openApiPath: string): Promise<string> {
  const outputDirectory = mkdtempSync(join(import.meta.dirname, "../.generated-app-"));
  generatedDirectories.push(outputDirectory);

  const context: GenerationContext = {
    inputPath: openApiPath,
    outputDirectory,
    artifacts: createArtifactRegistry(),
    writeFile(file: GeneratedFile) {
      const path = join(outputDirectory, file.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.contents);
    },
    log() {},
  };

  await createApicalPlugin().generate(context);
  await createHexagonalPlugin().generate(context);
  await createHonoPlugin().generate(context);

  return outputDirectory;
}

function typecheckRuntime(outputDirectory: string): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const result = spawnSync(
    process.execPath,
    [
      join(dirname(require.resolve("typescript/package.json")), "bin/tsc"),
      "--ignoreConfig",
      "--noEmit",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--skipLibCheck",
      "--allowImportingTsExtensions",
      join(outputDirectory, "src/runtime/app.ts"),
    ],
    { encoding: "utf8" },
  );

  return {
    status: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function readProductionSources(): string {
  const root = join(import.meta.dirname);
  const chunks: string[] = [];

  const visit = (path: string): void => {
    for (const item of readdirSync(path, { withFileTypes: true })) {
      const absolute = join(path, item.name);
      if (item.isDirectory()) {
        visit(absolute);
        continue;
      }
      if (!item.name.endsWith(".ts") || item.name.endsWith(".test.ts")) continue;
      chunks.push(readFileSync(absolute, "utf8"));
    }
  };

  for (const entry of productionSourceRoots) {
    const path = join(root, entry);
    if (entry.endsWith(".ts")) {
      chunks.push(readFileSync(path, "utf8"));
      continue;
    }
    visit(path);
  }

  return chunks.join("\n");
}

describe("Given ContractArtifact + ApplicationArtifact for Petstore", () => {
  it("when Hono generation runs, then routes, controllers, runtime, and HttpArtifact preserve validation boundaries", async () => {
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
    const controllers = files.find((file) => file.path === "src/adapters/http/controllers.ts");
    const routes = files.find((file) => file.path === "src/adapters/http/routes.ts");
    const runtime = files.find((file) => file.path === "src/runtime/app.ts");

    expect(files.map((file) => ({ path: file.path, ownership: file.ownership }))).toEqual([
      { path: "src/adapters/http/controllers.ts", ownership: "generated" },
      { path: "src/adapters/http/routes.ts", ownership: "generated" },
      { path: "src/runtime/app.ts", ownership: "generated" },
    ]);

    expect(controllers?.contents).toContain("addPetWrapper(async (request) => {");
    expect(controllers?.contents).toContain(
      'data: addPetResponseMap["201"]["application/json"].parse(result)',
    );
    expect(controllers?.contents).toContain('if (!result) return { status: "404" };');
    expect(controllers?.contents).not.toContain("z.object");

    expect(routes?.contents).toContain('app.post("/pet", async (context) =>');
    expect(routes?.contents).toContain('app.get("/pet/:petId", async (context) =>');
    expect(routes?.contents).toContain('app.post("/store/order", async (context) =>');

    expect(runtime?.contents).toContain("addPet: createAddPet(repositories.pets),");
    expect(runtime?.contents).toContain("placeOrder: createPlaceOrder(repositories.orders),");
    expect(runtime?.contents).toContain("pets: PetRepository;");
    expect(runtime?.contents).toContain("orders: OrderRepository;");

    expect(artifact).toMatchObject({
      artifactVersion: 1,
      controllersFilePath: "src/adapters/http/controllers.ts",
      routesFilePath: "src/adapters/http/routes.ts",
      runtimeFilePath: "src/runtime/app.ts",
      createAppFactoryName: "createApp",
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
    });
    expect(artifact.operations.map((operation) => operation.operationId)).toEqual([
      "addPet",
      "deleteOrder",
      "deletePet",
      "getOrderById",
      "getPetById",
      "placeOrder",
      "updatePet",
    ]);
  });
});

describe("Given ContractArtifact + ApplicationArtifact for Library", () => {
  it("when Hono generation runs, then it emits book routes without Petstore output", async () => {
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

    expect(source).not.toMatch(/\bPet\b|\bOrder\b|petstore|addPet|placeOrder/);
    expect(source).toContain('app.post("/books", async (context) =>');
    expect(source).toContain('app.get("/books/:bookId", async (context) =>');
    expect(source).toContain("createBook: createCreateBook(repositories.books),");
    expect(source).toContain("getBook: createGetBook(repositories.books),");
    expect(artifact.operations.map((operation) => operation.operationId)).toEqual([
      "createBook",
      "getBook",
    ]);
    expect(artifact.repositories).toEqual([
      {
        parameterName: "books",
        repositoryName: "BookRepository",
        repositoryFilePath: "src/core/ports/book-repository.ts",
      },
    ]);
  });
});

describe("Given real Apical output for Petstore and Library", () => {
  it("when the generated Petstore runtime is type checked, then every preceding generator import contract resolves", async () => {
    const outputDirectory = await materializeGeneratedApp(petstoreOpenApi);
    expect(typecheckRuntime(outputDirectory)).toEqual({ status: 0, stdout: "", stderr: "" });
  });

  it("when the generated Library runtime is type checked, then every preceding generator import contract resolves", async () => {
    const outputDirectory = await materializeGeneratedApp(libraryOpenApi);
    expect(typecheckRuntime(outputDirectory)).toEqual({ status: 0, stdout: "", stderr: "" });
  });

  it("when generated Petstore runtime boundaries receive invalid input and a malformed repository result, then neither value crosses the boundary", async () => {
    const outputDirectory = await materializeGeneratedApp(petstoreOpenApi);
    const runtimeUrl = pathToFileURL(join(outputDirectory, "src/runtime/app.ts")).href;
    const { createApp } = (await import(/* @vite-ignore */ runtimeUrl)) as {
      createApp: (repositories: unknown) => {
        request(input: string | Request, init?: RequestInit): Promise<Response>;
      };
    };
    let addCalls = 0;
    let databaseReads = 0;
    const malformedRepositoryResult = { id: 1, name: 42 };
    const app = createApp({
      pets: {
        async addPet(pet: unknown) {
          addCalls += 1;
          return pet;
        },
        async updatePet(pet: unknown) {
          return pet;
        },
        async getPetById() {
          databaseReads += 1;
          return malformedRepositoryResult;
        },
        async deletePet() {},
      },
      orders: {
        async placeOrder(order: unknown) {
          return order;
        },
        async getOrderById() {
          return undefined;
        },
        async deleteOrder() {},
      },
    });

    const invalidRequest = await app.request("http://hexkit.test/pet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1 }),
    });
    const addCallsAfterInvalidRequest = addCalls;
    const validRequest = await app.request("http://hexkit.test/pet", {
      method: "POST",
      headers: { "content-type": "application/json; charset=utf-8" },
      body: JSON.stringify({ id: 1, name: "Milo" }),
    });
    const invalidDatabaseRead = await app.request("http://hexkit.test/pet/1");

    expect({
      invalidRequest: {
        status: invalidRequest.status,
        body: await invalidRequest.json(),
        addCallsAfterInvalidRequest,
      },
      validRequest: {
        status: validRequest.status,
        body: await validRequest.json(),
        addCalls,
      },
      invalidDatabaseRead: {
        status: invalidDatabaseRead.status,
        body: await invalidDatabaseRead.json(),
        databaseReads,
      },
    }).toEqual({
      invalidRequest: {
        status: 400,
        body: { error: "Bad Request" },
        addCallsAfterInvalidRequest: 0,
      },
      validRequest: {
        status: 201,
        body: { id: 1, name: "Milo" },
        addCalls: 1,
      },
      invalidDatabaseRead: {
        status: 500,
        body: { error: "Internal Server Error" },
        databaseReads: 1,
      },
    });
  });
});

describe("Given Hono production sources", () => {
  it("then they contain no Petstore-only literals", () => {
    const source = readProductionSources();
    expect(source).not.toMatch(
      /\bPet\b|\bOrder\b|petstore|addPet|updatePet|getPetById|deletePet|placeOrder|getOrderById|deleteOrder|\/pet|\/store\/order/,
    );
  });
});
