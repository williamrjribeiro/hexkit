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

  it("when a binary upload aggregate is not persisted, then derivation rejects it", () => {
    const contract = baseContract([
      {
        operationId: "uploadDocument",
        method: "post",
        path: "/documents",
        modulePath: "routes/uploadDocument.ts",
        parameters: [],
        requestBody: {
          required: true,
          media: [
            {
              mediaType: "application/octet-stream",
              type: { kind: "string", nullable: false, format: "binary" },
            },
          ],
        },
        responses: [{ status: "200", description: "ok", media: [] }],
        security: publicSecurity,
        extension: { aggregate: "Item", action: "upload" },
      },
    ]);

    expect(() => deriveApplicationModel(contract)).toThrow(
      'Binary upload operation "uploadDocument" requires persisted aggregate "Item".',
    );
  });

  it("when a binary upload aggregate contains binary bytes, then derivation directs storage to BlobStore", () => {
    const contract = baseContract([
      {
        operationId: "uploadDocument",
        method: "post",
        path: "/documents",
        modulePath: "routes/uploadDocument.ts",
        parameters: [],
        requestBody: {
          required: true,
          media: [
            {
              mediaType: "application/octet-stream",
              type: { kind: "string", nullable: false, format: "binary" },
            },
          ],
        },
        responses: [{ status: "200", description: "ok", media: [] }],
        security: publicSecurity,
        extension: { aggregate: "Item", action: "upload" },
      },
    ]);
    const schema = contract.schemas[0];
    if (schema === undefined) throw new Error("Missing Item schema.");
    const aggregateWithBinaryProperty = {
      ...contract,
      schemas: [
        {
          ...schema,
          persistence: { table: "items", identity: "id" },
          properties: [
            ...schema.properties,
            {
              name: "content",
              required: true,
              type: { kind: "string", nullable: false, format: "binary" } as const,
            },
          ],
        },
      ],
    };

    expect(() => deriveApplicationModel(aggregateWithBinaryProperty)).toThrow(
      /Aggregate "Item".*binary.*BlobStore/,
    );
  });
});
