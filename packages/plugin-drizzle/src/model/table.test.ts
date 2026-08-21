import { describe, expect, it } from "vite-plus/test";

import type { ContractSchema } from "@hexkit/plugin-apical";

import {
  assertForeignKeyTargets,
  collectEnums,
  deriveTable,
  mapperFunctionName,
  orderTablesByDependency,
} from "./table.ts";

function integerProperty(name: string, reference?: { schema: string; property: string }) {
  return {
    name,
    required: true,
    type: { kind: "integer" as const, nullable: false, format: "int32" },
    ...(reference === undefined ? {} : { reference }),
  };
}

function persistedSchema(
  name: string,
  table: string,
  properties: ContractSchema["properties"],
): ContractSchema {
  return {
    name,
    modulePath: `schemas/${name}.ts`,
    persistence: { table, identity: "id" },
    properties,
  };
}

describe("orderTablesByDependency", () => {
  it("when tables have no foreign keys, then they are ordered by schema name", () => {
    const schemasByName = new Map<string, ContractSchema>();
    const widget = deriveTable(
      persistedSchema("Widget", "widgets", [integerProperty("id")]),
      schemasByName,
    );
    const gadget = deriveTable(
      persistedSchema("Gadget", "gadgets", [integerProperty("id")]),
      schemasByName,
    );

    expect(orderTablesByDependency([widget, gadget]).map((table) => table.schemaName)).toEqual([
      "Gadget",
      "Widget",
    ]);
  });

  it("when a table references another persisted table, then the target comes first", () => {
    const ownerSchema = persistedSchema("Owner", "owners", [integerProperty("id")]);
    const widgetSchema = persistedSchema("Widget", "widgets", [
      integerProperty("id"),
      integerProperty("ownerId", { schema: "Owner", property: "id" }),
    ]);
    const schemasByName = new Map([
      ["Owner", ownerSchema],
      ["Widget", widgetSchema],
    ]);
    const owner = deriveTable(ownerSchema, schemasByName);
    const widget = deriveTable(widgetSchema, schemasByName);

    expect(orderTablesByDependency([widget, owner]).map((table) => table.schemaName)).toEqual([
      "Owner",
      "Widget",
    ]);
  });

  it("when foreign keys form a cycle, then ordering throws", () => {
    const leftSchema = persistedSchema("Left", "lefts", [
      integerProperty("id"),
      integerProperty("rightId", { schema: "Right", property: "id" }),
    ]);
    const rightSchema = persistedSchema("Right", "rights", [
      integerProperty("id"),
      integerProperty("leftId", { schema: "Left", property: "id" }),
    ]);
    const schemasByName = new Map([
      ["Left", leftSchema],
      ["Right", rightSchema],
    ]);
    const left = deriveTable(leftSchema, schemasByName);
    const right = deriveTable(rightSchema, schemasByName);

    expect(() => orderTablesByDependency([left, right])).toThrow(
      /Cannot order persistence tables due to a foreign-key cycle/,
    );
  });
});

describe("deriveTable", () => {
  it("when persistence identity is not a property, then deriveTable throws", () => {
    const schema: ContractSchema = {
      name: "Widget",
      modulePath: "schemas/Widget.ts",
      persistence: { table: "widgets", identity: "missing" },
      properties: [integerProperty("id")],
    };

    expect(() => deriveTable(schema, new Map())).toThrow(
      'Schema "Widget" persistence identity "missing" is not a property.',
    );
  });

  it("when persistence is missing, then deriveTable throws", () => {
    const schema: ContractSchema = {
      name: "Widget",
      modulePath: "schemas/Widget.ts",
      properties: [integerProperty("id")],
    };

    expect(() => deriveTable(schema, new Map())).toThrow(
      'Schema "Widget" is missing x-hexkit.persistence.',
    );
  });
});

describe("collectEnums", () => {
  it("when two schemas collide on enum sql names, then the first occurrence is kept", () => {
    // toSnakeCase("Foo_BarBaz") === toSnakeCase("FooBar_Baz") === "foo_bar_baz"
    const foo = deriveTable(
      persistedSchema("Foo", "foos", [
        integerProperty("id"),
        {
          name: "BarBaz",
          required: true,
          type: { kind: "string", nullable: false, enum: ["a", "b"] },
        },
      ]),
      new Map(),
    );
    const fooBar = deriveTable(
      persistedSchema("FooBar", "foobars", [
        integerProperty("id"),
        {
          name: "Baz",
          required: true,
          type: { kind: "string", nullable: false, enum: ["a", "b"] },
        },
      ]),
      new Map(),
    );

    const enums = collectEnums([foo, fooBar]);
    expect(enums).toHaveLength(1);
    expect(enums[0]).toEqual({
      exportName: "fooBarBaz",
      sqlName: "foo_bar_baz",
      values: ["a", "b"],
    });
  });
});

describe("assertForeignKeyTargets", () => {
  it("when a foreign key targets a schema without a table, then it throws", () => {
    const ownerSchema = persistedSchema("Owner", "owners", [integerProperty("id")]);
    const widgetSchema = persistedSchema("Widget", "widgets", [
      integerProperty("id"),
      integerProperty("ownerId", { schema: "Owner", property: "id" }),
    ]);
    const widget = deriveTable(
      widgetSchema,
      new Map([
        ["Owner", ownerSchema],
        ["Widget", widgetSchema],
      ]),
    );

    expect(() => assertForeignKeyTargets([widget], new Map([["Widget", widget]]))).toThrow(
      'Foreign key from "Widget.ownerId" targets schema "Owner" without a persistence table.',
    );
  });

  it("when foreign-key targets have tables, then assertion succeeds", () => {
    const ownerSchema = persistedSchema("Owner", "owners", [integerProperty("id")]);
    const widgetSchema = persistedSchema("Widget", "widgets", [
      integerProperty("id"),
      integerProperty("ownerId", { schema: "Owner", property: "id" }),
    ]);
    const schemasByName = new Map([
      ["Owner", ownerSchema],
      ["Widget", widgetSchema],
    ]);
    const owner = deriveTable(ownerSchema, schemasByName);
    const widget = deriveTable(widgetSchema, schemasByName);
    const tablesBySchema = new Map([
      ["Owner", owner],
      ["Widget", widget],
    ]);

    expect(() => assertForeignKeyTargets([owner, widget], tablesBySchema)).not.toThrow();
  });
});

describe("mapperFunctionName", () => {
  it("when given a schema name, then it prefixes map and suffixes Row", () => {
    expect(mapperFunctionName("Widget")).toBe("mapWidgetRow");
  });
});
