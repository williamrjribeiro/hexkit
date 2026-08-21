import { describe, expect, it } from "vite-plus/test";

import type {
  PersistenceModel,
  PersistenceRepositoryModel,
  PersistenceTableModel,
} from "../model/derive.ts";
import { renderMapperFile } from "./mappers.ts";
import { renderMigrationFile } from "./migration.ts";
import { renderRepositoryFiles } from "./repository.ts";
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

describe("renderMapperFile edge cases", () => {
  it("covers equal schemaName compare when sorting tables", () => {
    const twin = table({
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
    const file = renderMapperFile(
      model({
        tables: [
          twin,
          table({
            ...twin,
            exportName: "widgets_alt",
            tableName: "widgets_alt",
          }),
        ],
      }),
    );
    expect(file.contents).toContain("mapWidgetRow");
  });
});

describe("renderMigrationFile edge cases", () => {
  it("throws when an enum column is missing sql type name", () => {
    expect(() =>
      renderMigrationFile(
        model({
          tables: [
            table({
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
                },
              ],
            }),
          ],
        }),
      ),
    ).toThrow('Enum column "status" is missing an SQL type name.');
  });

  it("throws when a filtered FK column loses foreign-key metadata", () => {
    const fk = {
      targetSchemaName: "Owner",
      targetTableExportName: "owners",
      targetColumnPropertyName: "id",
      targetColumnSqlName: "id",
    };
    const column: {
      propertyName: string;
      sqlName: string;
      sqlType: "integer";
      required: boolean;
      isIdentity: boolean;
      foreignKey?: typeof fk;
    } = {
      propertyName: "ownerId",
      sqlName: "owner_id",
      sqlType: "integer",
      required: true,
      isIdentity: false,
    };
    // Filter reads foreignKey once (must be defined); render reads it again (undefined).
    let reads = 0;
    Object.defineProperty(column, "foreignKey", {
      get() {
        reads += 1;
        return reads === 1 ? fk : undefined;
      },
      enumerable: true,
    });

    expect(() =>
      renderMigrationFile(
        model({
          tables: [
            table({
              columns: [
                {
                  propertyName: "id",
                  sqlName: "id",
                  sqlType: "integer",
                  required: true,
                  isIdentity: true,
                },
                column,
              ],
            }),
          ],
        }),
      ),
    ).toThrow('Column "ownerId" is missing foreign-key metadata.');
  });
});

describe("renderSchemaFile edge cases", () => {
  it("throws when an enum column is missing an export name", () => {
    expect(() =>
      renderSchemaFile(
        model({
          tables: [
            table({
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
                },
              ],
            }),
          ],
        }),
      ),
    ).toThrow('Enum column "status" is missing an export name.');
  });
});

describe("renderRepositoryFiles edge cases", () => {
  it("falls back to entity/identity names when method parameters are empty", () => {
    const widgetTable = table({
      columns: [
        {
          propertyName: "id",
          sqlName: "id",
          sqlType: "integer",
          required: true,
          isIdentity: true,
        },
        {
          propertyName: "name",
          sqlName: "name",
          sqlType: "text",
          required: true,
          isIdentity: false,
        },
      ],
    });

    const repository: PersistenceRepositoryModel = {
      aggregate: "Widget",
      portName: "WidgetRepository",
      factoryName: "createDrizzleWidgetRepository",
      filePath: "src/adapters/db/widget-repository.ts",
      runtimeKey: "widgets",
      table: widgetTable,
      methods: [
        {
          operationId: "createWidget",
          name: "createWidget",
          kind: "insert",
          parameters: [],
          returnTypeExpression: "Widget",
        },
        {
          operationId: "updateWidget",
          name: "updateWidget",
          kind: "update",
          parameters: [],
          returnTypeExpression: "Widget",
        },
        {
          operationId: "getWidget",
          name: "getWidget",
          kind: "select",
          parameters: [],
          returnTypeExpression: "Widget | undefined",
        },
        {
          operationId: "deleteWidget",
          name: "deleteWidget",
          kind: "delete",
          parameters: [],
          returnTypeExpression: "void",
        },
      ],
    };

    const [file] = renderRepositoryFiles(
      model({ tables: [widgetTable], repositories: [repository] }),
    );
    expect(file?.contents).toContain(".values(widget)");
    expect(file?.contents).toContain("eq(widgets.id, widget.id)");
    expect(file?.contents).toContain("eq(widgets.id, id)");
  });

  it("uses schemaName lowercase when there is no insert/update method", () => {
    const widgetTable = table({
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

    const repository: PersistenceRepositoryModel = {
      aggregate: "Widget",
      portName: "WidgetRepository",
      factoryName: "createDrizzleWidgetRepository",
      filePath: "src/adapters/db/widget-repository.ts",
      runtimeKey: "widgets",
      table: widgetTable,
      methods: [
        {
          operationId: "listWidgets",
          name: "listWidgets",
          kind: "list",
          parameters: [],
          returnTypeExpression: "Array<Widget>",
        },
        {
          operationId: "createWidget",
          name: "createWidget",
          kind: "insert",
          parameters: [],
          returnTypeExpression: "Widget",
        },
      ],
    };

    // insert with empty params still finds insert; cover the no-insert path via list-only first.
    const listOnly: PersistenceRepositoryModel = {
      ...repository,
      methods: [repository.methods[0]!],
    };
    const [listFile] = renderRepositoryFiles(
      model({ tables: [widgetTable], repositories: [listOnly] }),
    );
    expect(listFile?.contents).toContain("rows.map(mapWidgetRow)");
    expect(listFile?.contents).not.toContain('from "drizzle-orm"');

    const [insertFile] = renderRepositoryFiles(
      model({ tables: [widgetTable], repositories: [repository] }),
    );
    expect(insertFile?.contents).toContain(".values(widget)");
  });
});
