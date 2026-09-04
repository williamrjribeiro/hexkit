import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vite-plus/test";

import {
  createArtifactRegistry,
  type GeneratedFile,
  type GenerationContext,
} from "@hexkit/plugin-api";

import { APICAL_CONTRACT_ARTIFACT } from "./contract/index.ts";
import { createApicalPlugin } from "./plugin.ts";

describe("@hexkit/plugin-apical", () => {
  const pocContract = new URL("../../../apps/petstore-sample/openapi.poc.yaml", import.meta.url);
  const libraryContract = new URL(
    "../../../apps/fixtures/library-api/openapi.yaml",
    import.meta.url,
  );

  type ContractOperation = {
    method: string;
    operationId: string;
    path: string;
  };

  function readContract(): string {
    return readFileSync(pocContract, "utf8");
  }

  function extractOperations(contract: string): ContractOperation[] {
    const operations: ContractOperation[] = [];
    let path = "";
    let method = "";

    for (const line of contract.split("\n")) {
      const pathMatch = /^  (\/[^:]+):$/.exec(line);
      if (pathMatch) {
        path = pathMatch[1];
        continue;
      }

      const methodMatch = /^    (delete|get|post|put):$/.exec(line);
      if (methodMatch) {
        method = methodMatch[1].toUpperCase();
        continue;
      }

      const operationMatch = /^      operationId: (\w+)$/.exec(line);
      if (operationMatch) {
        operations.push({ method, operationId: operationMatch[1], path });
      }
    }

    return operations;
  }

  describe("Given the Petstore PoC contract", () => {
    it("when operations are inspected, then it contains the PoC operations", () => {
      expect(extractOperations(readContract())).toMatchInlineSnapshot(`
        [
          {
            "method": "POST",
            "operationId": "addPet",
            "path": "/pet",
          },
          {
            "method": "PUT",
            "operationId": "updatePet",
            "path": "/pet",
          },
          {
            "method": "GET",
            "operationId": "getPetById",
            "path": "/pet/{petId}",
          },
          {
            "method": "DELETE",
            "operationId": "deletePet",
            "path": "/pet/{petId}",
          },
          {
            "method": "POST",
            "operationId": "updatePetWithForm",
            "path": "/pet/{petId}",
          },
          {
            "method": "GET",
            "operationId": "findPetsByStatus",
            "path": "/pet/findByStatus",
          },
          {
            "method": "GET",
            "operationId": "findPetsByTags",
            "path": "/pet/findByTags",
          },
          {
            "method": "POST",
            "operationId": "placeOrder",
            "path": "/store/order",
          },
          {
            "method": "GET",
            "operationId": "getOrderById",
            "path": "/store/order/{orderId}",
          },
          {
            "method": "DELETE",
            "operationId": "deleteOrder",
            "path": "/store/order/{orderId}",
          },
          {
            "method": "POST",
            "operationId": "createUser",
            "path": "/user",
          },
          {
            "method": "POST",
            "operationId": "createUsersWithListInput",
            "path": "/user/createWithList",
          },
          {
            "method": "GET",
            "operationId": "loginUser",
            "path": "/user/login",
          },
          {
            "method": "GET",
            "operationId": "logoutUser",
            "path": "/user/logout",
          },
          {
            "method": "GET",
            "operationId": "getUserByName",
            "path": "/user/{username}",
          },
          {
            "method": "PUT",
            "operationId": "updateUser",
            "path": "/user/{username}",
          },
          {
            "method": "DELETE",
            "operationId": "deleteUser",
            "path": "/user/{username}",
          },
        ]
      `);
    });

    it("when media types and components are inspected, then JSON-only Pet, Order, User, Category, and Tag contracts remain", () => {
      const contract = readContract();

      expect(contract).toContain("application/json:");
      expect(contract).toContain("    Pet:");
      expect(contract).toContain("    Order:");
      expect(contract).toContain("    User:");
      expect(contract).toContain("      petId:");
      expect(contract).not.toContain("application/xml");
      expect(contract).not.toMatch(/^security:/m);
      expect(contract).toContain("  securitySchemes:\n    api_key:");
      expect(contract).toContain("      security:\n        - api_key: []");
    });

    it("when all identifier formats are inspected, then path and persisted IDs use exact int32 numbers", () => {
      const contract = readContract();
      const pathParameterFormats = [
        ...contract.matchAll(
          /^    (?:PetId|OrderId):\n(?:      .+\n){4}        type: integer\n        format: (\w+)$/gm,
        ),
      ].map((match) => match[1]);
      const persistedPropertyFormats = [
        ...contract.matchAll(
          /^        (?:id|petId):\n          type: integer\n          format: (\w+)$/gm,
        ),
      ].map((match) => match[1]);

      expect({
        pathParameterFormats,
        persistedPropertyFormats,
        remainingInt64Formats: contract.match(/format: int64/g) ?? [],
      }).toMatchInlineSnapshot(`
        {
          "pathParameterFormats": [
            "int32",
            "int32",
          ],
          "persistedPropertyFormats": [
            "int32",
            "int32",
            "int32",
            "int32",
            "int32",
            "int32",
          ],
          "remainingInt64Formats": [],
        }
      `);
    });
  });

  describe("Given an Apical plugin with an injected craft runner", () => {
    it("when generation runs, then explicit plugin options isolate all I/O edges", async () => {
      const calls: string[][] = [];
      const files: GeneratedFile[] = [];
      const plugin = createApicalPlugin({
        async runCraft(args) {
          calls.push([...args]);
        },
        async loadOpenApi() {
          return {
            openapi: "3.1.0",
            info: { title: "Isolated API", version: "1.0.0" },
            paths: {},
            components: { schemas: {} },
          };
        },
        async readGeneratedFile(path) {
          return path.endsWith("routes/index.ts")
            ? "export const routes = {} as const;\n"
            : "export {};\n";
        },
      });
      const context: GenerationContext = {
        inputPath: "/workspace/apps/petstore-sample/openapi.poc.yaml",
        outputDirectory: "/tmp/generated-petstore",
        artifacts: createArtifactRegistry(),
        writeFile(file) {
          files.push(file);
        },
        log() {},
      };

      await plugin.generate(context);

      expect(plugin.name).toBe("apical");
      expect(calls).toMatchInlineSnapshot(`
        [
          [
            "generate",
            "-i",
            "/workspace/apps/petstore-sample/openapi.poc.yaml",
            "-o",
            "/tmp/generated-petstore/src/generated/contracts",
            "--server",
            "--routes",
          ],
        ]
      `);
      expect(context.artifacts.require(APICAL_CONTRACT_ARTIFACT).application.slug).toBe(
        "isolated-api",
      );
      expect(files).toHaveLength(1);
      expect(files[0]?.path).toBe("src/generated/contracts/hexkit-contract.json");
    });
  });

  describe("Given real Apical craft output", () => {
    it.each([
      {
        fixture: "Petstore",
        input: pocContract,
        expectedSchemas: ["Category", "Order", "Pet", "Tag", "User"],
        expectedOperations: [
          "addPet",
          "updatePet",
          "getPetById",
          "deletePet",
          "updatePetWithForm",
          "findPetsByStatus",
          "findPetsByTags",
          "placeOrder",
          "getOrderById",
          "deleteOrder",
          "createUser",
          "createUsersWithListInput",
          "loginUser",
          "logoutUser",
          "getUserByName",
          "updateUser",
          "deleteUser",
        ],
      },
      {
        fixture: "Library",
        input: libraryContract,
        expectedSchemas: ["Author", "Book"],
        expectedOperations: ["createBook", "getBook"],
      },
    ])(
      "publishes and persists a verified ContractArtifact for the $fixture fixture",
      async ({ input, expectedSchemas, expectedOperations }) => {
        const outputDirectory = await mkdtemp(join(tmpdir(), "hexkit-apical-test-"));
        const files: GeneratedFile[] = [];
        const context: GenerationContext = {
          inputPath: input.pathname,
          outputDirectory,
          artifacts: createArtifactRegistry(),
          writeFile(file) {
            files.push(file);
          },
          log() {},
        };

        try {
          await createApicalPlugin().generate(context);

          const artifact = context.artifacts.require(APICAL_CONTRACT_ARTIFACT);
          expect(artifact.schemas.map(({ name }) => name).sort()).toEqual(expectedSchemas);
          expect(artifact.operations.map(({ operationId }) => operationId)).toEqual(
            expectedOperations,
          );

          const manifest = files.find(
            ({ path }) => path === "src/generated/contracts/hexkit-contract.json",
          );
          expect(manifest?.ownership).toBe("generated");
          expect(JSON.parse(manifest?.contents ?? "")).toEqual(artifact);
        } finally {
          await rm(outputDirectory, { recursive: true, force: true });
        }
      },
    );
  });
});
