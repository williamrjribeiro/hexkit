import { describe, expect, it } from "vite-plus/test";

import type { ContractOperation } from "@hexkit/plugin-apical";

import { deriveParameters, deriveReturnType } from "./parameters.ts";

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
      parameters: [{ name: "itemId", typeExpression: "string" }],
      referencedSchemas: [],
    });
  });

  it("when there is no body and no path parameters, then the input list is empty", () => {
    expect(deriveParameters(operation({ operationId: "listItems" }))).toEqual({
      parameters: [],
      referencedSchemas: [],
    });
  });

  it("when a query parameter is declared, then the calculation throws", () => {
    expect(() =>
      deriveParameters(
        operation({
          operationId: "searchItems",
          parameters: [
            {
              name: "term",
              location: "query",
              required: false,
              type: stringType,
            },
          ],
        }),
      ),
    ).toThrow('Operation "searchItems" declares unsupported query parameter "term".');
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
      parameters: [{ name: "item", typeExpression: "Item" }],
      referencedSchemas: ["Item"],
    });
  });
});

describe("Given operation responses", () => {
  it("when there is no json success body, then the return type is void", () => {
    expect(deriveReturnType(operation({ operationId: "deleteItem", method: "delete" }))).toEqual({
      expression: "void",
      referencedSchemas: [],
      resultCardinality: "void",
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
      referencedSchemas: ["Item"],
      resultCardinality: "many",
    });
  });
});
