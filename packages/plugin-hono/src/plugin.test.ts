import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it } from "vite-plus/test";

import { createHexagonalPlugin } from "@hexkit/plugin-architecture-hexagonal";
import { createApicalPlugin } from "@hexkit/plugin-apical";
import type { GeneratedFile } from "@hexkit/plugin-api";

import { createHonoPlugin } from "./plugin.ts";

const require = createRequire(import.meta.url);
const operationIds = [
  "addPet",
  "updatePet",
  "getPetById",
  "deletePet",
  "placeOrder",
  "getOrderById",
  "deleteOrder",
] as const;

async function collectGeneratedFiles(): Promise<GeneratedFile[]> {
  const files: GeneratedFile[] = [];

  createHonoPlugin().generate({
    inputPath: "/workspace/apps/petstore-sample/openapi.poc.yaml",
    outputDirectory: "/tmp/generated-petstore",
    writeFile(file) {
      files.push(file);
    },
    log() {},
  });

  return files;
}

const generatedDirectories: string[] = [];

afterEach(() => {
  for (const directory of generatedDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function materializeGeneratedApp(): string {
  const outputDirectory = mkdtempSync(join(import.meta.dirname, "../.generated-app-"));
  generatedDirectories.push(outputDirectory);

  const context = {
    inputPath: join(import.meta.dirname, "../../../apps/petstore-sample/openapi.poc.yaml"),
    outputDirectory,
    writeFile(file: GeneratedFile) {
      const path = join(outputDirectory, file.path);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, file.contents);
    },
    log() {},
  };

  createApicalPlugin().generate(context);
  createHexagonalPlugin().generate(context);
  createHonoPlugin().generate(context);

  return outputDirectory;
}

describe("Given the seven generated JSON operations and protected application use cases", () => {
  it("when Hono generation runs, then routes, controllers, and runtime composition preserve every validation boundary", async () => {
    const files = await collectGeneratedFiles();
    const sourceContract = files.map((file) => ({
      path: file.path,
      ownership: file.ownership,
      operations: operationIds.filter((operationId) => file.contents.includes(operationId)),
      apicalImports: file.contents
        .split("\n")
        .filter(
          (line) =>
            line.includes("/generated/contracts/") &&
            (line.includes("Wrapper") || line.includes("ResponseMap")),
        ),
      routes: file.contents
        .split("\n")
        .filter((line) => /^\s*app\.(?:delete|get|post|put)\(/.test(line)),
      bindings: file.contents
        .split("\n")
        .filter((line) =>
          /^\s+(?:addPet|deleteOrder|deletePet|getOrderById|getPetById|placeOrder|updatePet): create/.test(
            line,
          ),
        ),
    }));

    expect(sourceContract).toMatchInlineSnapshot(`
      [
        {
          "apicalImports": [
            "import { addPetWrapper } from "../../generated/contracts/server/addPet.ts";",
            "import { deleteOrderWrapper } from "../../generated/contracts/server/deleteOrder.ts";",
            "import { deletePetWrapper } from "../../generated/contracts/server/deletePet.ts";",
            "import { getOrderByIdWrapper } from "../../generated/contracts/server/getOrderById.ts";",
            "import { getPetByIdWrapper } from "../../generated/contracts/server/getPetById.ts";",
            "import { placeOrderWrapper } from "../../generated/contracts/server/placeOrder.ts";",
            "import { updatePetWrapper } from "../../generated/contracts/server/updatePet.ts";",
            "import { addPetResponseMap } from "../../generated/contracts/routes/addPet.ts";",
            "import { getOrderByIdResponseMap } from "../../generated/contracts/routes/getOrderById.ts";",
            "import { getPetByIdResponseMap } from "../../generated/contracts/routes/getPetById.ts";",
            "import { placeOrderResponseMap } from "../../generated/contracts/routes/placeOrder.ts";",
            "import { updatePetResponseMap } from "../../generated/contracts/routes/updatePet.ts";",
          ],
          "bindings": [],
          "operations": [
            "addPet",
            "updatePet",
            "getPetById",
            "deletePet",
            "placeOrder",
            "getOrderById",
            "deleteOrder",
          ],
          "ownership": "generated",
          "path": "src/adapters/http/controllers.ts",
          "routes": [],
        },
        {
          "apicalImports": [],
          "bindings": [],
          "operations": [
            "addPet",
            "updatePet",
            "getPetById",
            "deletePet",
            "placeOrder",
            "getOrderById",
            "deleteOrder",
          ],
          "ownership": "generated",
          "path": "src/adapters/http/routes.ts",
          "routes": [
            "  app.post("/pet", async (context) =>",
            "  app.put("/pet", async (context) =>",
            "  app.get("/pet/:petId", async (context) =>",
            "  app.delete("/pet/:petId", async (context) =>",
            "  app.post("/store/order", async (context) =>",
            "  app.get("/store/order/:orderId", async (context) =>",
            "  app.delete("/store/order/:orderId", async (context) =>",
          ],
        },
        {
          "apicalImports": [],
          "bindings": [
            "    addPet: createAddPet(repositories.pets),",
            "    updatePet: createUpdatePet(repositories.pets),",
            "    getPetById: createGetPetById(repositories.pets),",
            "    deletePet: createDeletePet(repositories.pets),",
            "    placeOrder: createPlaceOrder(repositories.orders),",
            "    getOrderById: createGetOrderById(repositories.orders),",
            "    deleteOrder: createDeleteOrder(repositories.orders),",
          ],
          "operations": [
            "addPet",
            "updatePet",
            "getPetById",
            "deletePet",
            "placeOrder",
            "getOrderById",
            "deleteOrder",
          ],
          "ownership": "generated",
          "path": "src/runtime/app.ts",
          "routes": [],
        },
      ]
    `);

    expect(files.map((file) => file.contents).join("\n")).not.toContain("z.object");
  });

  it("when the generated runtime is type checked, then every preceding generator import contract resolves", () => {
    const outputDirectory = materializeGeneratedApp();
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

    expect({
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    }).toEqual({ status: 0, stdout: "", stderr: "" });
  });

  it("when generated runtime boundaries receive invalid input and a malformed database row, then neither value crosses the boundary", async () => {
    const outputDirectory = materializeGeneratedApp();
    const runtimeUrl = pathToFileURL(join(outputDirectory, "src/runtime/app.ts")).href;
    const petSchemaUrl = pathToFileURL(
      join(outputDirectory, "src/generated/contracts/schemas/Pet.ts"),
    ).href;
    const { createApp } = (await import(/* @vite-ignore */ runtimeUrl)) as {
      createApp: (repositories: unknown) => {
        request(input: string | Request, init?: RequestInit): Promise<Response>;
      };
    };
    const { Pet } = (await import(/* @vite-ignore */ petSchemaUrl)) as {
      Pet: { parse(value: unknown): unknown };
    };
    let addCalls = 0;
    let databaseReads = 0;
    const app = createApp({
      pets: {
        async add(pet: unknown) {
          addCalls += 1;
          return pet;
        },
        async update(pet: unknown) {
          return pet;
        },
        async getById() {
          databaseReads += 1;
          return Pet.parse({ id: 1, name: 42 });
        },
        async delete() {},
      },
      orders: {
        async place(order: unknown) {
          return order;
        },
        async getById() {
          return undefined;
        },
        async delete() {},
      },
    });

    const invalidRequest = await app.request("http://hexkit.test/pet", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: 1 }),
    });
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
        addCallsBeforeValidRequest: addCalls - 1,
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
        addCallsBeforeValidRequest: 0,
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
