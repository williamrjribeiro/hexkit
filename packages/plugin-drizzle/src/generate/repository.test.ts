import { describe, expect, it } from "vite-plus/test";

import type { PersistenceModel } from "../model/derive.ts";
import type { PersistenceRepositoryModel } from "../model/repository.ts";
import { deriveTable } from "../model/table.ts";
import { renderRepositoryFiles } from "./repository.ts";

function widgetSchema(options: { statusRequired: boolean }) {
  return {
    name: "Widget",
    modulePath: "schemas/Widget.ts",
    persistence: { table: "widgets", identity: "id" },
    properties: [
      {
        name: "id",
        required: true,
        type: { kind: "integer" as const, nullable: false, format: "int32" },
      },
      {
        name: "sku",
        required: true,
        type: { kind: "string" as const, nullable: false },
      },
      {
        name: "status",
        required: options.statusRequired,
        type: { kind: "string" as const, nullable: false },
      },
    ],
  };
}

function groupCountRepository(options: {
  statusRequired: boolean;
  groupByColumn?: string;
}): PersistenceRepositoryModel {
  const table = deriveTable(widgetSchema({ statusRequired: options.statusRequired }), new Map());
  return {
    aggregate: "Widget",
    portName: "WidgetRepository",
    factoryName: "createDrizzleWidgetRepository",
    filePath: "src/adapters/db/widget-repository.ts",
    runtimeKey: "widgets",
    table,
    methods: [
      {
        operationId: "getInventory",
        name: "getInventory",
        kind: "group-count",
        parameters: [],
        returnTypeExpression: "Record<string, number>",
        entityParameterName: "widgets",
        identityParameterName: "id",
        lookupColumnName: "id",
        ...(options.groupByColumn === undefined ? {} : { groupByColumn: options.groupByColumn }),
      },
    ],
  };
}

function model(repositories: readonly PersistenceRepositoryModel[]): PersistenceModel {
  return {
    applicationSlug: "sample",
    migrationPath: "src/generated/db/migration.ts",
    schemaFilePath: "src/adapters/db/schema.ts",
    mapperFilePath: "src/adapters/db/mappers.ts",
    enums: [],
    tables: [],
    repositories,
  };
}

describe("Given a group-count repository method", () => {
  it("when the group-by column is required, then counts render without a null filter", () => {
    const [file] = renderRepositoryFiles(
      model([groupCountRepository({ statusRequired: true, groupByColumn: "status" })]),
    );

    expect(file?.contents).toContain('import { count } from "drizzle-orm";');
    expect(file?.contents).toContain("async getInventory(): Promise<Record<string, number>> {");
    expect(file?.contents).toContain(".select({ key: widgets.status, value: count() })");
    expect(file?.contents).toContain(
      "return Object.fromEntries(rows.map((row) => [row.key, row.value] as const));",
    );
  });

  it("when the group-by column is nullable, then null keys are filtered out", () => {
    const [file] = renderRepositoryFiles(
      model([groupCountRepository({ statusRequired: false, groupByColumn: "status" })]),
    );

    expect(file?.contents).toContain(
      "return Object.fromEntries(rows.filter((row) => row.key !== null).map((row) => [row.key, row.value] as const));",
    );
  });

  it("when the model lacks a group-by column, then rendering throws", () => {
    expect(() =>
      renderRepositoryFiles(model([groupCountRepository({ statusRequired: true })])),
    ).toThrow(
      'Repository method "getInventory" uses group-count persistence without a group-by column.',
    );
  });

  it("when the group-by column is not on the table, then rendering throws", () => {
    expect(() =>
      renderRepositoryFiles(
        model([groupCountRepository({ statusRequired: true, groupByColumn: "missing" })]),
      ),
    ).toThrow(
      'Repository method "getInventory" group-by column "missing" is not on table "widgets".',
    );
  });
});
