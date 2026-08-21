import { describe, expect, it } from "vite-plus/test";

import type { ContractArtifact, ContractOperation } from "@hexkit/plugin-apical";

import { deriveApplicationModel, toApplicationArtifact } from "./derive.ts";

const publicSecurity = {
  overridesGlobal: true,
  requirements: [],
  apicalServerHeaderNames: [],
} as const;

const itemReference = { kind: "reference", nullable: false, schema: "Item" } as const;
const stringType = { kind: "string", nullable: false } as const;

function baseContract(operations: ContractOperation[]): ContractArtifact {
  return {
    artifactVersion: 1,
    openapiVersion: "3.1.0",
    application: {
      title: "Derive Fixture",
      version: "1.0.0",
      slug: "derive-fixture",
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
    securitySchemes: [],
    globalSecurity: [],
    operations,
  };
}

describe("Given a contract with public operations", () => {
  it("when derived, then repositories carry persistenceKind and use cases bind the matching method", () => {
    const model = deriveApplicationModel(
      baseContract([
        {
          operationId: "listItems",
          method: "get",
          path: "/items",
          modulePath: "routes/listItems.ts",
          parameters: [],
          responses: [
            {
              status: "200",
              description: "ok",
              media: [
                {
                  mediaType: "application/json",
                  type: { kind: "array", nullable: false, items: itemReference },
                },
              ],
            },
          ],
          security: publicSecurity,
          extension: { aggregate: "Item", action: "list" },
        },
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
          security: publicSecurity,
          requestBody: {
            required: true,
            media: [{ mediaType: "application/json", type: itemReference }],
          },
          extension: { aggregate: "Item", action: "create" },
        },
      ]),
    );

    expect(model.authenticatorPort).toBeUndefined();
    expect(model.repositories).toEqual([
      expect.objectContaining({
        aggregate: "Item",
        methods: [
          expect.objectContaining({
            operationId: "createItem",
            persistenceKind: "insert",
            resultCardinality: "one",
          }),
          expect.objectContaining({
            operationId: "listItems",
            persistenceKind: "list",
            resultCardinality: "many",
          }),
        ],
      }),
    ]);
    expect(model.useCases.map((useCase) => useCase.methodName)).toEqual([
      "createItem",
      "listItems",
    ]);

    const artifact = toApplicationArtifact(model);
    expect(artifact.authenticatorPort).toBeUndefined();
    expect(artifact.repositories[0]?.methods).toEqual([
      expect.objectContaining({
        operationId: "createItem",
        persistenceKind: "insert",
        resultCardinality: "one",
      }),
      expect.objectContaining({
        operationId: "listItems",
        persistenceKind: "list",
        resultCardinality: "many",
      }),
    ]);
  });
});
