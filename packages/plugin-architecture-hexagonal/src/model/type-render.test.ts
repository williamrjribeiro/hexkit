import { describe, expect, it } from "vite-plus/test";

import {
  entityEnumAliasName,
  renderContractType,
  renderEnumUnion,
  renderScalarLiteral,
} from "./type-render.ts";

describe("renderContractType", () => {
  it("renders nullable scalars", () => {
    expect(renderContractType({ kind: "string", nullable: true })).toEqual({
      expression: "string | null",
      referencedSchemas: [],
      enumAliases: [],
    });
    expect(renderContractType({ kind: "boolean", nullable: true }).expression).toBe(
      "boolean | null",
    );
    expect(renderContractType({ kind: "integer", nullable: true }).expression).toBe(
      "number | null",
    );
    expect(renderContractType({ kind: "number", nullable: false }).expression).toBe("number");
  });

  it("renders inline enum unions when no enumTypeName is provided", () => {
    expect(
      renderContractType({
        kind: "string",
        nullable: false,
        enum: ["a", "b"],
      }),
    ).toEqual({
      expression: '"a" | "b"',
      referencedSchemas: [],
      enumAliases: [],
    });
  });

  it("falls back to scalar when enum is an empty array", () => {
    expect(
      renderContractType({
        kind: "string",
        nullable: false,
        enum: [],
      }),
    ).toEqual({
      expression: "string",
      referencedSchemas: [],
      enumAliases: [],
    });
  });

  it("collects named enum aliases when enumTypeName is provided", () => {
    expect(
      renderContractType(
        {
          kind: "string",
          nullable: true,
          enum: ["open", "closed"],
        },
        { enumTypeName: "DoorState" },
      ),
    ).toEqual({
      expression: "DoorState | null",
      referencedSchemas: [],
      enumAliases: [{ name: "DoorState", values: ["open", "closed"] }],
    });
  });

  it("renders object types with optional properties and nested enum names", () => {
    const rendered = renderContractType(
      {
        kind: "object",
        nullable: true,
        properties: [
          {
            name: "id",
            required: true,
            type: { kind: "integer", nullable: false },
          },
          {
            name: "status",
            required: false,
            type: {
              kind: "string",
              nullable: false,
              enum: ["active", "archived"],
            },
          },
          {
            name: "owner",
            required: true,
            type: { kind: "reference", nullable: false, schema: "User" },
          },
        ],
      },
      { enumTypeName: "Profile" },
    );

    expect(rendered.expression).toBe(
      "{\n  id: number;\n  status?: ProfileStatus;\n  owner: User;\n} | null",
    );
    expect(rendered.referencedSchemas).toEqual(["User"]);
    expect(rendered.enumAliases).toEqual([
      { name: "ProfileStatus", values: ["active", "archived"] },
    ]);
  });

  it("renders object types without enumTypeName nesting", () => {
    const rendered = renderContractType({
      kind: "object",
      nullable: false,
      properties: [
        {
          name: "label",
          required: false,
          type: { kind: "string", nullable: false },
        },
      ],
    });

    expect(rendered).toEqual({
      expression: "{\n  label?: string;\n}",
      referencedSchemas: [],
      enumAliases: [],
    });
  });

  it("renders arrays of objects", () => {
    const rendered = renderContractType({
      kind: "array",
      nullable: false,
      items: {
        kind: "object",
        nullable: false,
        properties: [
          {
            name: "value",
            required: true,
            type: { kind: "number", nullable: false },
          },
        ],
      },
    });

    expect(rendered.expression).toBe("Array<{\n  value: number;\n}>");
  });
});

describe("renderScalarLiteral and renderEnumUnion", () => {
  it("renders null, string, number, and boolean literals", () => {
    expect(renderScalarLiteral(null)).toBe("null");
    expect(renderScalarLiteral("ok")).toBe('"ok"');
    expect(renderScalarLiteral(42)).toBe("42");
    expect(renderScalarLiteral(true)).toBe("true");
    expect(renderEnumUnion([null, 1, "x", false])).toBe('null | 1 | "x" | false');
  });
});

describe("entityEnumAliasName", () => {
  it("pascal-cases the property suffix", () => {
    expect(entityEnumAliasName("Pet", "status")).toBe("PetStatus");
  });
});
