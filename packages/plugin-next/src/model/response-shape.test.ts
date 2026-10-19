import { describe, expect, it } from "vite-plus/test";

import type {
  ContractMedia,
  ContractOperation,
  ContractSchema,
  ContractType,
} from "@hexkit/plugin-apical";

import { deriveUiResponseShape } from "./response-shape.ts";

const stringType = { kind: "string", nullable: false } as const;

const schemas: readonly ContractSchema[] = [
  {
    name: "Item",
    modulePath: "schemas/Item.ts",
    properties: [
      { name: "id", required: true, type: stringType },
      { name: "name", required: true, type: stringType },
    ],
  },
];

function getOperation(media: readonly ContractMedia[]): ContractOperation {
  return {
    operationId: "getItem",
    method: "get",
    path: "/items",
    modulePath: "routes/getItem.ts",
    parameters: [],
    responses: [{ status: "200", description: "ok", media }],
    security: {
      overridesGlobal: true,
      requirements: [],
      apicalServerHeaderNames: [],
    },
  };
}

function shapeFor(type: ContractType | undefined, mediaType = "application/json") {
  return deriveUiResponseShape(
    getOperation([{ mediaType, ...(type === undefined ? {} : { type }) }]),
    schemas,
  );
}

describe("Given deriveUiResponseShape", () => {
  it("when the response references an object schema, then it renders entries", () => {
    expect(shapeFor({ kind: "reference", nullable: false, schema: "Item" })).toEqual({
      kind: "entries",
    });
  });

  it("when the response is an inline object with properties, then it renders entries", () => {
    expect(
      shapeFor({
        kind: "object",
        nullable: false,
        properties: [{ name: "total", required: true, type: { kind: "integer", nullable: false } }],
      }),
    ).toEqual({ kind: "entries" });
  });

  it("when the response is an additionalProperties map, then it renders entries", () => {
    expect(
      shapeFor({
        kind: "object",
        nullable: false,
        properties: [],
        additionalProperties: { kind: "integer", nullable: false },
      }),
    ).toEqual({ kind: "entries" });
  });

  it("when the response is an empty object with no additionalProperties, then it falls back to JSON", () => {
    expect(shapeFor({ kind: "object", nullable: false, properties: [] })).toEqual({ kind: "json" });
  });

  it("when the response is an array of references, then it renders table columns", () => {
    expect(
      shapeFor({
        kind: "array",
        nullable: false,
        items: { kind: "reference", nullable: false, schema: "Item" },
      }),
    ).toEqual({ kind: "table", columns: ["id", "name"] });
  });

  it("when the response is an array of inline objects, then it renders table columns", () => {
    expect(
      shapeFor({
        kind: "array",
        nullable: false,
        items: {
          kind: "object",
          nullable: false,
          properties: [
            { name: "id", required: true, type: stringType },
            { name: "label", required: false, type: stringType },
          ],
        },
      }),
    ).toEqual({ kind: "table", columns: ["id", "label"] });
  });

  it("when the response is an array of scalars, then it renders a list", () => {
    expect(shapeFor({ kind: "array", nullable: false, items: stringType })).toEqual({
      kind: "list",
    });
  });

  it("when an array item references a missing schema, then it falls back to JSON", () => {
    expect(
      shapeFor({
        kind: "array",
        nullable: false,
        items: { kind: "reference", nullable: false, schema: "Missing" },
      }),
    ).toEqual({ kind: "json" });
  });

  it("when an array item object has no properties, then it falls back to JSON", () => {
    expect(
      shapeFor({
        kind: "array",
        nullable: false,
        items: { kind: "object", nullable: false, properties: [] },
      }),
    ).toEqual({ kind: "json" });
  });

  it("when the response is a scalar, then it falls back to JSON", () => {
    expect(shapeFor(stringType)).toEqual({ kind: "json" });
  });

  it("when there is no JSON success media, then it falls back to JSON", () => {
    expect(
      deriveUiResponseShape(
        getOperation([{ mediaType: "application/xml", type: stringType }]),
        schemas,
      ),
    ).toEqual({ kind: "json" });
  });

  it("when there is no success response, then it falls back to JSON", () => {
    const operation: ContractOperation = {
      ...getOperation([]),
      responses: [{ status: "404", description: "missing", media: [] }],
    };

    expect(deriveUiResponseShape(operation, schemas)).toEqual({ kind: "json" });
  });
});
