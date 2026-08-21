import { describe, expect, it } from "vite-plus/test";

import type { PersistenceModel, PersistenceTableModel } from "../model/derive.ts";
import { renderMapperFile } from "./mappers.ts";
import { renderMigrationFile } from "./migration.ts";
import { renderSchemaFile } from "./schema.ts";

const baseTable = {
  schemaName: "Widget",
  exportName: "widgets",
  tableName: "widgets",
  identityPropertyName: "id",
  identitySqlName: "id",
  domainFilePath: "src/core/domain/widget.ts",
  apicalModulePath: "schemas/Widget.ts",
} as const;

function table(
  overrides: Partial<PersistenceTableModel> & {
    columns: PersistenceTableModel["columns"];
  },
): PersistenceTableModel {
  return { ...baseTable, ...overrides };
}

function model(
  partial: Partial<PersistenceModel> & { tables: PersistenceTableModel[] },
): PersistenceModel {
  return {
    applicationSlug: "edge-api",
    migrationPath: "drizzle/0000_edge-api.sql",
    schemaFilePath: "src/adapters/db/schema.ts",
    mapperFilePath: "src/adapters/db/mappers.ts",
    enums: [],
    repositories: [],
    ...partial,
  };
}

describe("render leftover orchestrator cases", () => {
  it("when a complete enum and foreign-key model is rendered, then schema and migration consume the discriminated column", () => {
    const owner = table({
      schemaName: "Owner",
      exportName: "owners",
      tableName: "owners",
      columns: [
        {
          propertyName: "id",
          sqlName: "id",
          sqlType: "integer",
          required: true,
          isIdentity: true,
        },
      ],
    });
    const widget = table({
      columns: [
        {
          propertyName: "id",
          sqlName: "id",
          sqlType: "integer",
          required: true,
          isIdentity: true,
        },
        {
          propertyName: "status",
          sqlName: "status",
          sqlType: "enum",
          required: true,
          isIdentity: false,
          enumExportName: "widgetStatus",
          enumSqlName: "widget_status",
          enumValues: ["open", "closed"],
        },
        {
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
        },
      ],
    });
    const persistence = model({
      enums: [
        {
          exportName: "widgetStatus",
          sqlName: "widget_status",
          values: ["open", "closed"],
        },
      ],
      tables: [owner, widget],
    });

    const schema = renderSchemaFile(persistence);
    const migration = renderMigrationFile(persistence);
    const mapper = renderMapperFile(persistence);

    expect(schema.contents).toContain("widgetStatus");
    expect(schema.contents).toContain(".references(() => owners.id)");
    expect(migration.contents).toContain('"widget_status"');
    expect(migration.contents).toContain("FOREIGN KEY");
    expect(mapper.contents).toContain("mapOwnerRow");
    expect(mapper.contents).toContain("mapWidgetRow");
  });
});
