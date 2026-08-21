import { describe, expect, it } from "vite-plus/test";

import type { ContractProperty, ContractSchema } from "@hexkit/plugin-apical";

import { columnsWithForeignKeys, deriveColumn } from "./column.ts";

function integerProperty(name: string, extras: Partial<ContractProperty> = {}): ContractProperty {
  return {
    name,
    required: true,
    type: { kind: "integer", nullable: false, format: "int32" },
    ...extras,
  };
}

function ownerSchema(): ContractSchema {
  return {
    name: "Owner",
    modulePath: "schemas/Owner.ts",
    persistence: { table: "owners", identity: "id" },
    properties: [integerProperty("id")],
  };
}

describe("deriveColumn", () => {
  it("when the property is a string enum, then sqlType is enum with required enum fields", () => {
    const column = deriveColumn(
      "Widget",
      {
        name: "status",
        required: true,
        type: { kind: "string", nullable: false, enum: ["open", "closed"] },
      },
      "id",
      new Map(),
    );

    expect(column).toEqual({
      propertyName: "status",
      sqlName: "status",
      sqlType: "enum",
      required: true,
      isIdentity: false,
      enumExportName: "widgetStatus",
      enumSqlName: "widget_status",
      enumValues: ["open", "closed"],
    });
  });

  it("when a non-enum column is derived, then enum fields are not present", () => {
    const column = deriveColumn("Widget", integerProperty("id"), "id", new Map());

    expect(column.sqlType).toBe("integer");
    expect(column).not.toHaveProperty("enumExportName");
    expect(column).not.toHaveProperty("enumSqlName");
    expect(column).not.toHaveProperty("enumValues");
  });

  it("when a scalar property has x-hexkit.reference, then foreignKey is assembled on the returned column", () => {
    const column = deriveColumn(
      "Widget",
      integerProperty("ownerId", { reference: { schema: "Owner", property: "id" } }),
      "id",
      new Map([["Owner", ownerSchema()]]),
    );

    expect(column).toEqual({
      propertyName: "ownerId",
      sqlName: "owner_id",
      sqlType: "integer",
      required: true,
      isIdentity: false,
      foreignKey: {
        targetSchemaName: "Owner",
        targetTableExportName: "owners",
        targetColumnPropertyName: "id",
        targetColumnSqlName: "id",
      },
    });
  });

  it.each([
    {
      kind: "reference" as const,
      type: { kind: "reference" as const, nullable: false, schema: "Owner" },
      label: "$ref",
    },
    {
      kind: "object" as const,
      type: {
        kind: "object" as const,
        nullable: false,
        properties: [integerProperty("id")],
      },
      label: "object",
    },
    {
      kind: "array" as const,
      type: {
        kind: "array" as const,
        nullable: false,
        items: { kind: "integer" as const, nullable: false, format: "int32" },
      },
      label: "array",
    },
  ])(
    "when $label is combined with x-hexkit.reference, then deriveColumn throws",
    ({ type, label }) => {
      const property: ContractProperty = {
        name: "owner",
        required: true,
        type,
        reference: { schema: "Owner", property: "id" },
      };

      expect(() => deriveColumn("Widget", property, "id", new Map())).toThrow(
        `Schema "Widget" property "owner" cannot combine ${label} with x-hexkit.reference. Use a scalar FK property, or omit x-hexkit.reference to store JSONB.`,
      );
    },
  );

  it("when the referenced schema is unknown, then deriveColumn throws", () => {
    expect(() =>
      deriveColumn(
        "Widget",
        integerProperty("ownerId", { reference: { schema: "MissingOwner", property: "id" } }),
        "id",
        new Map(),
      ),
    ).toThrow('Schema "Widget" property "ownerId" references unknown schema "MissingOwner".');
  });

  it("when the referenced schema has no persistence, then deriveColumn throws", () => {
    const owner: ContractSchema = {
      name: "Owner",
      modulePath: "schemas/Owner.ts",
      properties: [integerProperty("id")],
    };

    expect(() =>
      deriveColumn(
        "Widget",
        integerProperty("ownerId", { reference: { schema: "Owner", property: "id" } }),
        "id",
        new Map([["Owner", owner]]),
      ),
    ).toThrow(
      'Schema "Widget" property "ownerId" references "Owner" which has no x-hexkit.persistence.',
    );
  });

  it("when an enum value is not a string, then deriveColumn throws", () => {
    expect(() =>
      deriveColumn(
        "Widget",
        {
          name: "status",
          required: true,
          type: { kind: "string", nullable: false, enum: [1 as unknown as string] },
        },
        "id",
        new Map(),
      ),
    ).toThrow('Schema "Widget" property "status" enum values must be strings for Postgres enums.');
  });

  it("when the property is a number, then deriveColumn throws", () => {
    expect(() =>
      deriveColumn(
        "Widget",
        {
          name: "amount",
          required: true,
          type: { kind: "number", nullable: false },
        },
        "id",
        new Map(),
      ),
    ).toThrow(
      'Schema "Widget" property "amount" uses number, which is not supported for Drizzle persistence yet.',
    );
  });

  it.each([
    {
      name: "flag",
      type: { kind: "boolean" as const, nullable: false },
      sqlType: "boolean",
      sqlName: "flag",
    },
    {
      name: "title",
      type: { kind: "string" as const, nullable: false },
      sqlType: "text",
      sqlName: "title",
    },
    {
      name: "meta",
      type: { kind: "object" as const, nullable: false, properties: [] },
      sqlType: "jsonb",
      sqlName: "meta",
    },
    {
      name: "aliases",
      type: {
        kind: "array" as const,
        nullable: false,
        items: { kind: "string" as const, nullable: false },
      },
      sqlType: "jsonb",
      sqlName: "aliases",
    },
    {
      name: "label",
      type: { kind: "reference" as const, nullable: false, schema: "Label" },
      sqlType: "jsonb",
      sqlName: "label",
    },
  ])(
    "when the property is $sqlType ($name), then the column sqlType matches",
    ({ name, type, sqlType, sqlName }) => {
      const column = deriveColumn("Widget", { name, required: true, type }, "id", new Map());
      expect(column).toMatchObject({
        propertyName: name,
        sqlName,
        sqlType,
        required: true,
        isIdentity: false,
      });
    },
  );

  it("when the property is nullable, then required is false even if marked required", () => {
    const column = deriveColumn(
      "Widget",
      {
        name: "nickname",
        required: true,
        type: { kind: "string", nullable: true },
      },
      "id",
      new Map(),
    );
    expect(column.required).toBe(false);
  });
});

describe("columnsWithForeignKeys", () => {
  it("when some columns have foreign keys, then only those columns are returned with a required foreignKey", () => {
    const identity = deriveColumn("Widget", integerProperty("id"), "id", new Map());
    const ownerId = deriveColumn(
      "Widget",
      integerProperty("ownerId", { reference: { schema: "Owner", property: "id" } }),
      "id",
      new Map([["Owner", ownerSchema()]]),
    );

    const narrowed = columnsWithForeignKeys([identity, ownerId]);
    expect(narrowed).toHaveLength(1);
    expect(narrowed[0]?.foreignKey.targetTableExportName).toBe("owners");
  });
});
