import { readFileSync } from "node:fs";

import { describe, expect, it } from "vite-plus/test";

import type { GenerationContext } from "@hexkit/plugin-api";

import { createApicalPlugin } from "./plugin.ts";

const pocContract = new URL("../../../apps/petstore-sample/openapi.poc.yaml", import.meta.url);

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
  it("when operations are inspected, then it contains the seven normative operations", () => {
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
      ]
    `);
  });

  it("when media types and components are inspected, then only JSON Pet and Order contracts remain", () => {
    const contract = readContract();

    expect(contract).toContain("application/json:");
    expect(contract).toContain("    Pet:");
    expect(contract).toContain("    Order:");
    expect(contract).toContain("      petId:");
    expect(contract).not.toContain("application/xml");
    expect(contract).not.toMatch(/^security:/m);
    expect(contract).not.toMatch(/^  securitySchemes:/m);
  });

  it("when persisted identifier formats are inspected, then they use exact int32 numbers", () => {
    const contract = readContract();
    const identifierFormats = [
      ...contract.matchAll(
        /^        (?:id|petId):\n          type: integer\n          format: (\w+)$/gm,
      ),
    ].map((match) => match[1]);

    expect(identifierFormats).toEqual(["int32", "int32", "int32"]);
  });
});

describe("Given an Apical plugin with an injected craft runner", () => {
  it("when generation runs, then craft targets the generated app contract directory", () => {
    const calls: string[][] = [];
    const plugin = createApicalPlugin((args) => {
      calls.push([...args]);
    });
    const context: GenerationContext = {
      inputPath: "/workspace/apps/petstore-sample/openapi.poc.yaml",
      outputDirectory: "/tmp/generated-petstore",
      writeFile() {},
      log() {},
    };

    plugin.generate(context);

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
  });
});
