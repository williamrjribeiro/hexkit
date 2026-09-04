import { describe, expect, it } from "vite-plus/test";

import type { ContractOperation } from "@hexkit/plugin-apical";

import { deriveParameters, deriveReturnType } from "./parameters.ts";

describe("operation parameter derivation", () => {
  const publicSecurity = {
    overridesGlobal: true,
    requirements: [],
    apicalServerHeaderNames: [],
  } as const;

  const itemReference = { kind: "reference", nullable: false, schema: "Item" } as const;
  const stringType = { kind: "string", nullable: false } as const;

  function operation(
    overrides: Partial<ContractOperation> & Pick<ContractOperation, "operationId">,
  ): ContractOperation {
    return {
      method: "get",
      path: "/items",
      modulePath: `routes/${overrides.operationId}.ts`,
      parameters: [],
      responses: [{ status: "200", description: "ok", media: [] }],
      security: publicSecurity,
      ...overrides,
    };
  }

  describe("Given operation inputs", () => {
    it("when the json body references a schema, then the parameter is a camelCased schema name", () => {
      expect(
        deriveParameters(
          operation({
            operationId: "createItem",
            method: "post",
            requestBody: {
              required: true,
              media: [{ mediaType: "application/json", type: itemReference }],
            },
          }),
        ),
      ).toEqual({
        parameters: [{ name: "item", typeExpression: "Item" }],
        referencedSchemas: ["Item"],
      });
    });

    it("when the json body is an inline object, then the parameter is named body", () => {
      expect(
        deriveParameters(
          operation({
            operationId: "patchItem",
            method: "patch",
            requestBody: {
              required: true,
              media: [
                {
                  mediaType: "application/json",
                  type: {
                    kind: "object",
                    nullable: false,
                    properties: [{ name: "name", required: true, type: stringType }],
                  },
                },
              ],
            },
          }),
        ),
      ).toEqual({
        parameters: [{ name: "body", typeExpression: "{\n  name: string;\n}" }],
        referencedSchemas: [],
      });
    });

    it("when there is no request body, then path parameters become the input list", () => {
      expect(
        deriveParameters(
          operation({
            operationId: "getById",
            path: "/items/{itemId}",
            parameters: [
              {
                name: "itemId",
                location: "path",
                required: true,
                type: stringType,
              },
            ],
          }),
        ),
      ).toEqual({
        parameters: [{ name: "itemId", typeExpression: "string", location: "path" }],
        referencedSchemas: [],
      });
    });

    it("when query parameters are declared, then they are included with query location", () => {
      expect(
        deriveParameters(
          operation({
            operationId: "findWidgetsByStatus",
            path: "/widgets/findByStatus",
            parameters: [
              {
                name: "status",
                location: "query",
                required: true,
                type: {
                  kind: "array",
                  nullable: false,
                  items: {
                    kind: "string",
                    nullable: false,
                    enum: ["active", "inactive"],
                  },
                },
              },
            ],
            responses: [
              {
                status: "200",
                description: "ok",
                media: [
                  {
                    mediaType: "application/json",
                    type: {
                      kind: "array",
                      nullable: false,
                      items: { kind: "reference", nullable: false, schema: "Widget" },
                    },
                  },
                ],
              },
            ],
          }),
        ),
      ).toEqual({
        parameters: [
          {
            name: "status",
            typeExpression: 'Array<"active" | "inactive">',
            location: "query",
          },
        ],
        referencedSchemas: [],
      });
    });

    it("when there is no body and no path parameters, then the input list is empty", () => {
      expect(deriveParameters(operation({ operationId: "listItems" }))).toEqual({
        parameters: [],
        referencedSchemas: [],
      });
    });

    it("when a header parameter is declared, then the calculation throws", () => {
      expect(() =>
        deriveParameters(
          operation({
            operationId: "badOp",
            parameters: [
              { name: "X-Trace", location: "header", required: false, type: stringType },
            ],
          }),
        ),
      ).toThrow('unsupported header parameter "X-Trace"');
    });

    it("when a request body has no json schema, then the calculation throws", () => {
      expect(() =>
        deriveParameters(
          operation({
            operationId: "upload",
            method: "post",
            requestBody: {
              required: true,
              media: [{ mediaType: "text/plain" }],
            },
          }),
        ),
      ).toThrow(/unsupported request body/);
    });

    it("when a query parameter is optional, then the type expression includes undefined", () => {
      expect(
        deriveParameters(
          operation({
            operationId: "updateWidgetWithForm",
            method: "post",
            path: "/widgets/{widgetId}",
            parameters: [
              {
                name: "widgetId",
                location: "path",
                required: true,
                type: stringType,
              },
              {
                name: "name",
                location: "query",
                required: false,
                type: stringType,
              },
              {
                name: "status",
                location: "query",
                required: false,
                type: {
                  kind: "string",
                  nullable: false,
                  enum: ["active", "inactive"],
                },
              },
            ],
            responses: [
              {
                status: "200",
                description: "ok",
                media: [
                  {
                    mediaType: "application/json",
                    type: { kind: "reference", nullable: false, schema: "Widget" },
                  },
                ],
              },
              { status: "404", description: "missing", media: [] },
            ],
          }),
        ),
      ).toEqual({
        parameters: [
          { name: "widgetId", typeExpression: "string", location: "path" },
          { name: "name", typeExpression: "string | undefined", location: "query" },
          {
            name: "status",
            typeExpression: '"active" | "inactive" | undefined',
            location: "query",
          },
        ],
        referencedSchemas: [],
      });
    });

    it("when the json body is an array of schema references, then the parameter is named body", () => {
      expect(
        deriveParameters(
          operation({
            operationId: "createItems",
            method: "post",
            requestBody: {
              required: true,
              media: [
                {
                  mediaType: "application/json",
                  type: { kind: "array", nullable: false, items: itemReference },
                },
              ],
            },
          }),
        ),
      ).toEqual({
        parameters: [{ name: "body", typeExpression: "Array<Item>" }],
        referencedSchemas: ["Item"],
      });
    });

    it("when a json body is present with path parameters, then path parameters are kept before the body", () => {
      expect(
        deriveParameters(
          operation({
            operationId: "updateItem",
            method: "put",
            path: "/items/{sku}",
            parameters: [
              {
                name: "sku",
                location: "path",
                required: true,
                type: stringType,
              },
            ],
            requestBody: {
              required: true,
              media: [{ mediaType: "application/json", type: itemReference }],
            },
          }),
        ),
      ).toEqual({
        parameters: [
          { name: "sku", typeExpression: "string", location: "path" },
          { name: "item", typeExpression: "Item" },
        ],
        referencedSchemas: ["Item"],
      });
    });

    it("when a path parameter references a schema, then that schema is collected", () => {
      expect(
        deriveParameters(
          operation({
            operationId: "getByKey",
            path: "/items/{item}",
            parameters: [
              {
                name: "item",
                location: "path",
                required: true,
                type: itemReference,
              },
            ],
          }),
        ),
      ).toEqual({
        parameters: [{ name: "item", typeExpression: "Item", location: "path" }],
        referencedSchemas: ["Item"],
      });
    });
  });

  describe("Given operation responses", () => {
    it("when there is no json success body, then the return type is void", () => {
      expect(deriveReturnType(operation({ operationId: "deleteItem", method: "delete" }))).toEqual({
        expression: "void",
        payloadExpression: "void",
        successHeaders: [],
        referencedSchemas: [],
        resultCardinality: "void",
      });
    });

    it("when there is no json success body but a 404 exists, then the return type is boolean", () => {
      expect(
        deriveReturnType(
          operation({
            operationId: "deleteItem",
            method: "delete",
            responses: [
              { status: "204", description: "gone", media: [] },
              { status: "404", description: "missing", media: [] },
            ],
          }),
        ),
      ).toEqual({
        expression: "boolean",
        payloadExpression: "boolean",
        successHeaders: [],
        referencedSchemas: [],
        resultCardinality: "one",
      });
    });

    it("when a json success body is a single schema and 404 exists, then the type is optional", () => {
      expect(
        deriveReturnType(
          operation({
            operationId: "getById",
            responses: [
              {
                status: "200",
                description: "ok",
                media: [{ mediaType: "application/json", type: itemReference }],
              },
              { status: "404", description: "missing", media: [] },
            ],
          }),
        ),
      ).toEqual({
        expression: "Item | undefined",
        payloadExpression: "Item | undefined",
        successHeaders: [],
        referencedSchemas: ["Item"],
        resultCardinality: "one",
      });
    });

    it("when the first success response has no json schema, then a later json body is used", () => {
      expect(
        deriveReturnType(
          operation({
            operationId: "createItem",
            method: "post",
            responses: [
              { status: "202", description: "accepted", media: [] },
              {
                status: "201",
                description: "created",
                media: [{ mediaType: "application/json", type: itemReference }],
              },
            ],
          }),
        ),
      ).toEqual({
        expression: "Item",
        payloadExpression: "Item",
        successHeaders: [],
        referencedSchemas: ["Item"],
        resultCardinality: "one",
      });
    });

    it("when a json success body is an array, then cardinality is many", () => {
      expect(
        deriveReturnType(
          operation({
            operationId: "listItems",
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
          }),
        ),
      ).toEqual({
        expression: "Array<Item>",
        payloadExpression: "Array<Item>",
        successHeaders: [],
        referencedSchemas: ["Item"],
        resultCardinality: "many",
      });
    });

    it("when a json success body declares response headers, then the return type is a data/headers envelope", () => {
      expect(
        deriveReturnType(
          operation({
            operationId: "issueToken",
            responses: [
              {
                status: "200",
                description: "ok",
                media: [{ mediaType: "application/json", type: stringType }],
                headers: [
                  {
                    name: "X-Rate-Limit",
                    required: false,
                    type: { kind: "integer", nullable: false, format: "int32" },
                  },
                  {
                    name: "X-Expires-After",
                    required: true,
                    type: { kind: "string", nullable: false },
                  },
                ],
              },
            ],
          }),
        ),
      ).toEqual({
        expression:
          '{ data: string; headers: { "x-rate-limit": number; "x-expires-after": string } }',
        payloadExpression: "string",
        successHeaders: [
          { name: "x-rate-limit", typeExpression: "number" },
          { name: "x-expires-after", typeExpression: "string" },
        ],
        referencedSchemas: [],
        resultCardinality: "one",
      });
    });
  });
});
