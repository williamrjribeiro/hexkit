import { describe, expect, it } from "vite-plus/test";

import type { ContractArtifact, ContractOperation } from "@hexkit/plugin-apical";

import { deriveApplicationModel, toApplicationArtifact } from "./derive.ts";

const publicSecurity = {
  overridesGlobal: true,
  requirements: [],
  apicalServerHeaderNames: [],
} as const;

const stringType = { kind: "string", nullable: false } as const;
const itemReference = { kind: "reference", nullable: false, schema: "Item" } as const;

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

describe("deriveApplicationModel edge cases", () => {
  it("infers aggregate from a path parameter named like {itemId}", () => {
    const model = deriveApplicationModel(
      baseContract([
        {
          operationId: "getById",
          method: "get",
          path: "/inventory/{itemId}",
          modulePath: "routes/getById.ts",
          parameters: [
            {
              name: "itemId",
              location: "path",
              required: true,
              type: { kind: "string", nullable: false },
            },
          ],
          responses: [
            {
              status: "200",
              description: "ok",
              media: [{ mediaType: "application/json", type: { kind: "string", nullable: false } }],
            },
            {
              status: "404",
              description: "missing",
              media: [],
            },
          ],
          security: publicSecurity,
        },
      ]),
    );

    expect(model.repositories).toEqual([
      expect.objectContaining({
        aggregate: "Item",
        methods: [
          expect.objectContaining({
            operationId: "getById",
            parameters: [{ name: "itemId", typeExpression: "string" }],
            returnTypeExpression: "string | undefined",
          }),
        ],
      }),
    ]);
  });

  it("skips non-success responses when resolving aggregate from response media", () => {
    const model = deriveApplicationModel(
      baseContract([
        {
          operationId: "createItem",
          method: "post",
          path: "/things",
          modulePath: "routes/createItem.ts",
          parameters: [],
          responses: [
            {
              status: "400",
              description: "bad",
              media: [{ mediaType: "application/json", type: itemReference }],
            },
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
        },
      ]),
    );

    expect(model.repositories[0]?.aggregate).toBe("Item");
  });

  it("accepts inline application/json request body schemas", () => {
    const model = deriveApplicationModel(
      baseContract([
        {
          operationId: "patchItem",
          method: "patch",
          path: "/items/{id}",
          modulePath: "routes/patchItem.ts",
          parameters: [
            {
              name: "id",
              location: "path",
              required: true,
              type: { kind: "string", nullable: false },
            },
          ],
          responses: [
            {
              status: "200",
              description: "ok",
              media: [{ mediaType: "application/json", type: itemReference }],
            },
          ],
          security: publicSecurity,
          requestBody: {
            required: true,
            media: [
              {
                mediaType: "application/json",
                type: {
                  kind: "object",
                  nullable: false,
                  properties: [
                    {
                      name: "name",
                      required: true,
                      type: { kind: "string", nullable: false },
                    },
                  ],
                },
              },
            ],
          },
          extension: { aggregate: "Item", action: "patch" },
        },
      ]),
    );

    expect(model.useCases[0]?.parameters).toEqual([
      { name: "body", typeExpression: "{\n  name: string;\n}" },
    ]);
  });

  it("throws when request body is present without a supported json schema", () => {
    expect(() =>
      deriveApplicationModel(
        baseContract([
          {
            operationId: "upload",
            method: "post",
            path: "/items",
            modulePath: "routes/upload.ts",
            parameters: [],
            responses: [
              {
                status: "204",
                description: "empty",
                media: [],
              },
            ],
            security: publicSecurity,
            requestBody: {
              required: true,
              media: [{ mediaType: "text/plain" }],
            },
            extension: { aggregate: "Item", action: "upload" },
          },
        ]),
      ),
    ).toThrow(/unsupported request body/);
  });

  it("throws when aggregate cannot be inferred", () => {
    expect(() =>
      deriveApplicationModel(
        baseContract([
          {
            operationId: "mystery",
            method: "get",
            path: "/unknown/{value}",
            modulePath: "routes/mystery.ts",
            parameters: [
              {
                name: "value",
                location: "path",
                required: true,
                type: { kind: "string", nullable: false },
              },
            ],
            responses: [
              {
                status: "200",
                description: "ok",
                media: [
                  { mediaType: "application/json", type: { kind: "string", nullable: false } },
                ],
              },
            ],
            security: publicSecurity,
          },
        ]),
      ),
    ).toThrow(/Cannot infer aggregate/);
  });

  it("omits authenticatorPort when no operation requires auth", () => {
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
      ]),
    );

    expect(model.authenticatorPort).toBeUndefined();
    expect(toApplicationArtifact(model).authenticatorPort).toBeUndefined();
  });

  it("resolves aggregate from request body media that is not a schema reference first", () => {
    const model = deriveApplicationModel(
      baseContract([
        {
          operationId: "echo",
          method: "post",
          path: "/echo",
          modulePath: "routes/echo.ts",
          parameters: [],
          responses: [
            {
              status: "200",
              description: "ok",
              media: [{ mediaType: "application/json", type: itemReference }],
            },
          ],
          security: publicSecurity,
          requestBody: {
            required: true,
            media: [
              {
                mediaType: "application/json",
                type: { kind: "string", nullable: false },
              },
            ],
          },
        },
      ]),
    );

    expect(model.repositories[0]?.aggregate).toBe("Item");
    expect(model.useCases[0]?.parameters).toEqual([{ name: "body", typeExpression: "string" }]);
  });
});
