import { describe, expect, it } from "vite-plus/test";

import {
  normalizeContractType,
  normalizeProperties,
  normalizeSchemas,
  readEnum,
  readNullableType,
} from "./type-normalize.ts";

describe("Given OpenAPI schema type declarations", () => {
  it("when type is a string, then nullable follows the legacy flag", () => {
    expect(readNullableType({ type: "string" }, "t")).toEqual({ nullable: false, type: "string" });
    expect(readNullableType({ type: "string", nullable: true }, "t")).toEqual({
      nullable: true,
      type: "string",
    });
  });

  it("when type is a two-item array with null, then the non-null type is nullable", () => {
    expect(readNullableType({ type: ["string", "null"] }, "t")).toEqual({
      nullable: true,
      type: "string",
    });
  });

  it("when type is only null, then normalizeContractType rejects it", () => {
    expect(() => normalizeContractType({ type: "null" }, "t")).toThrow(
      "t cannot declare only the null type.",
    );
  });

  it("when type is an unsupported union, then ContractArtifact rejects it", () => {
    expect(() =>
      normalizeContractType({ oneOf: [{ type: "string" }, { type: "integer" }] }, "test schema"),
    ).toThrow("test schema.oneOf is not supported by ContractArtifact.");
    expect(() => normalizeContractType({ allOf: [] }, "t")).toThrow(
      "t.allOf is not supported by ContractArtifact.",
    );
    expect(() => normalizeContractType({ anyOf: [] }, "t")).toThrow(
      "t.anyOf is not supported by ContractArtifact.",
    );
    expect(() => normalizeContractType({ not: {} }, "t")).toThrow(
      "t.not is not supported by ContractArtifact.",
    );
  });

  it("when type is a supported array or object, then nested types are normalized", () => {
    expect(normalizeContractType({ type: "array", items: { type: "string" } }, "t")).toEqual({
      kind: "array",
      nullable: false,
      items: { kind: "string", nullable: false },
    });
    expect(
      normalizeContractType(
        { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
        "t",
      ),
    ).toEqual({
      kind: "object",
      nullable: false,
      properties: [{ name: "id", required: true, type: { kind: "string", nullable: false } }],
    });
  });

  it("when type shapes are invalid, then each helper reports the same error string", () => {
    expect(() => normalizeContractType({ type: "array" }, "t")).toThrow(
      "t.items is required for array types.",
    );
    expect(() => normalizeContractType({ type: "file" }, "t")).toThrow(
      't.type "file" is not supported.',
    );
    expect(() => normalizeContractType({ type: ["string", "integer"] }, "t")).toThrow(
      /exactly one non-null type/,
    );
    expect(() => normalizeContractType({ type: 1 }, "t")).toThrow(
      "t.type must be a string or a nullable two-item string array.",
    );
    expect(() => normalizeContractType({ $ref: "#/components/parameters/X" }, "t")).toThrow(
      /may only reference component schemas/,
    );
    expect(
      normalizeContractType({ $ref: "#/components/schemas/Book", nullable: true }, "t"),
    ).toEqual({ kind: "reference", nullable: true, schema: "Book" });
  });
});

describe("Given schema enum and properties", () => {
  it("when enum is missing, then readEnum returns undefined", () => {
    expect(readEnum(undefined, "t.enum")).toBeUndefined();
  });

  it("when enum is empty or non-scalar, then readEnum throws", () => {
    expect(() => readEnum([], "t.enum")).toThrow("t.enum must be a non-empty array.");
    expect(() => readEnum([{ nested: true }], "t.enum")).toThrow(
      "t.enum[0] must be a scalar JSON value.",
    );
  });

  it("when enum is scalar values, then they are kept", () => {
    expect(readEnum(["a", 1, true, null], "t.enum")).toEqual(["a", 1, true, null]);
  });

  it("when required is malformed, then normalizeProperties throws", () => {
    expect(() =>
      normalizeProperties(
        { type: "object", required: "id", properties: { id: { type: "string" } } },
        "t",
      ),
    ).toThrow("t.required must be an array of property names.");
    expect(() =>
      normalizeProperties(
        { type: "object", required: ["missing"], properties: { id: { type: "string" } } },
        "t",
      ),
    ).toThrow('t.required references missing property "missing".');
  });
});

describe("Given component schemas", () => {
  it("when a schema is not an object, then normalizeSchemas fails", () => {
    expect(() =>
      normalizeSchemas(
        {
          components: {
            schemas: { Book: { type: "string" } },
          },
        },
        { schemas: new Map([["Book", "schemas/Book.ts"]]), operations: new Map() },
      ),
    ).toThrow("OpenAPI components.schemas.Book must be an object schema.");
  });
});
