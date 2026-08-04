import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import type { FileWriterActions } from "@hexkit/core";
import { loadValidatedOpenApi } from "@hexkit/plugin-apical";
import { createArtifactRegistry, type GeneratedFile } from "@hexkit/plugin-api";

import {
  createDefaultPlugins,
  createPackagingPlugin,
  main,
  parseArguments,
  runCli,
} from "./index.ts";

const apicalContractPaths = [
  "package.json",
  "routes/addPet.ts",
  "routes/deleteOrder.ts",
  "routes/deletePet.ts",
  "routes/getOrderById.ts",
  "routes/getPetById.ts",
  "routes/index.ts",
  "routes/placeOrder.ts",
  "routes/updatePet.ts",
  "schemas/Order.ts",
  "schemas/Pet.ts",
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
const petstoreContract = new URL("../../petstore-sample/openapi.poc.yaml", import.meta.url);

const schemasIndex = `
import { Order } from "./Order.ts";
import { Pet } from "./Pet.ts";
export { Order, Pet };
`;

const routesIndex = `
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
        hexkit generate <openapi> <output>
        hexkit --help

      Commands:
        generate  Generate a compose-ready application from an OpenAPI document

      Options:
        -h, --help  Show this help",
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
    const calls: Array<{ inputPath: string; outputDirectory: string }> = [];

    const exitCode = await runCli(["generate", "petstore.yaml", "generated/petstore"], {
      async generate(inputPath: string, outputDirectory: string) {
        await Promise.resolve();
        calls.push({ inputPath, outputDirectory });
      },
      log() {},
    });

    expect(exitCode).toBe(0);
    expect(calls).toEqual([
      {
        inputPath: "petstore.yaml",
        outputDirectory: "generated/petstore",
      },
    ]);
  });

  it("when arguments are parsed, then parsing is a pure command calculation", () => {
    expect(parseArguments(["generate", "petstore.yaml", "generated/petstore"])).toEqual({
      kind: "generate",
      inputPath: "petstore.yaml",
      outputDirectory: "generated/petstore",
    });
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

  it("when the assembled CLI generates, then injected Craft and filesystem edges receive the complete application", async () => {
    const outputDirectory = "/virtual/generated-petstore";
    const files = new Map<string, string>();
    const actions: FileWriterActions = {
      exists(path: string) {
        return files.has(path);
      },
      write(path: string, contents: string) {
        files.set(path, contents);
      },
      log() {},
    };
    const craftCalls: string[][] = [];

    const exitCode = await main(["generate", "petstore.yaml", outputDirectory], {
      actions,
      inputExists: (path: string) => path === "petstore.yaml",
      log() {},
      apical: {
        async runCraft(arguments_: readonly string[]) {
          craftCalls.push([...arguments_]);
          const outputFlag = arguments_.indexOf("-o");
          const contractsDirectory = arguments_[outputFlag + 1];
          if (!contractsDirectory) throw new Error("Craft output argument is missing");

          for (const path of apicalContractPaths) {
            const contents =
              path === "schemas/index.ts"
                ? schemasIndex
                : path === "routes/index.ts"
                  ? routesIndex
                  : "";
            actions.write(join(contractsDirectory, path), contents);
          }
        },
        loadOpenApi: () => loadValidatedOpenApi(petstoreContract.pathname),
        async readGeneratedFile(path) {
          const contents = files.get(path);
          if (contents === undefined) {
            throw new Error(`Missing virtual Apical output: ${path}`);
          }
          return contents;
        },
      },
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
        "drizzle/0000_petstore.sql",
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
        "src/core/domain/order.ts",
        "src/core/domain/pet.ts",
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
        "src/generated/contracts/schemas/Order.ts",
        "src/generated/contracts/schemas/Pet.ts",
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
});

describe("Given compose-ready generated packaging", () => {
  it("when the packaging plugin runs, then it emits the snapshotted container and startup paths", async () => {
    const files: GeneratedFile[] = [];

    await createPackagingPlugin().generate({
      inputPath: "petstore.yaml",
      outputDirectory: "generated/petstore",
      artifacts: createArtifactRegistry(),
      writeFile(file: GeneratedFile) {
        files.push(file);
      },
      log() {},
    });

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
            POSTGRES_DB: petstore
            POSTGRES_USER: petstore
            POSTGRES_PASSWORD: petstore
          healthcheck:
            test: ["CMD-SHELL", "pg_isready -U petstore -d petstore"]
            interval: 2s
            timeout: 5s
            retries: 15
          volumes:
            - postgres-data:/var/lib/postgresql/data

        app:
          build: .
          environment:
            DATABASE_URL: postgres://petstore:petstore@postgres:5432/petstore
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
  });

  it("when the package manifest is emitted, then source build and runtime dependencies use current versions", async () => {
    const files: GeneratedFile[] = [];

    await createPackagingPlugin().generate({
      inputPath: "petstore.yaml",
      outputDirectory: "generated/petstore",
      artifacts: createArtifactRegistry(),
      writeFile(file: GeneratedFile) {
        files.push(file);
      },
      log() {},
    });

    const packageFile = files.find((file: GeneratedFile) => file.path === "package.json");
    expect(packageFile).toBeDefined();
    const manifest = JSON.parse(packageFile?.contents ?? "") as {
      dependencies: Record<string, string>;
    };

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
    const files: GeneratedFile[] = [];

    await createPackagingPlugin().generate({
      inputPath: "petstore.yaml",
      outputDirectory: "generated/petstore",
      artifacts: createArtifactRegistry(),
      writeFile(file: GeneratedFile) {
        files.push(file);
      },
      log() {},
    });

    const tsconfigFile = files.find((file: GeneratedFile) => file.path === "tsconfig.json");
    expect(tsconfigFile).toBeDefined();
    const tsconfig = JSON.parse(tsconfigFile?.contents ?? "") as {
      compilerOptions: Record<string, unknown>;
    };

    expect(tsconfig.compilerOptions).not.toHaveProperty("noUnusedLocals");
  });
});
