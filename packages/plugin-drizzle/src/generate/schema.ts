import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type {
  PersistenceEnumModel,
  PersistenceModel,
  PersistenceTableModel,
} from "../model/derive.ts";

export function renderSchemaFile(model: PersistenceModel): GeneratedFile {
  const columnHelpers = collectColumnHelpers(model.tables);
  const imports: ImportDeclaration[] = [
    {
      from: "drizzle-orm/pg-core",
      names: [
        ...columnHelpers,
        ...(model.enums.length > 0 ? (["pgEnum"] as const) : []),
        "pgTable",
      ].toSorted(compareText),
    },
  ];

  const statements = [
    [...model.enums.map(renderEnumDeclaration), ...model.tables.map(renderTableDeclaration)].join(
      "\n\n",
    ),
  ];

  return {
    path: model.schemaFilePath,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}

function collectColumnHelpers(tables: readonly PersistenceTableModel[]): string[] {
  const helpers = new Set<string>();
  for (const table of tables) {
    for (const column of table.columns) {
      switch (column.sqlType) {
        case "boolean":
          helpers.add("boolean");
          break;
        case "integer":
          helpers.add("integer");
          break;
        case "text":
          helpers.add("text");
          break;
        case "enum":
          break;
      }
    }
  }
  return [...helpers].toSorted(compareText);
}

function renderEnumDeclaration(enumeration: PersistenceEnumModel): string {
  const values = enumeration.values.map((value) => JSON.stringify(value)).join(", ");
  return `export const ${enumeration.exportName} = pgEnum(${JSON.stringify(enumeration.sqlName)}, [${values}]);`;
}

function renderTableDeclaration(table: PersistenceTableModel): string {
  const columns = table.columns.map((column) => {
    const chain = [renderColumnConstructor(column)];
    if (column.isIdentity) {
      chain.push("primaryKey()");
    }
    if (column.required && !column.isIdentity) {
      chain.push("notNull()");
    }
    if (column.foreignKey !== undefined) {
      chain.push(
        `references(() => ${column.foreignKey.targetTableExportName}.${column.foreignKey.targetColumnPropertyName})`,
      );
    }

    const expression =
      column.foreignKey === undefined
        ? chain.join(".")
        : `${chain[0]}\n    .${chain.slice(1).join("\n    .")}`;

    return `  ${column.propertyName}: ${expression},`;
  });

  return [
    `export const ${table.exportName} = pgTable(${JSON.stringify(table.tableName)}, {`,
    ...columns,
    "});",
  ].join("\n");
}

function renderColumnConstructor(column: PersistenceTableModel["columns"][number]): string {
  const sqlName = JSON.stringify(column.sqlName);
  switch (column.sqlType) {
    case "boolean":
      return `boolean(${sqlName})`;
    case "integer":
      return `integer(${sqlName})`;
    case "text":
      return `text(${sqlName})`;
    case "enum":
      if (column.enumExportName === undefined) {
        throw new Error(`Enum column "${column.propertyName}" is missing an export name.`);
      }
      return `${column.enumExportName}(${sqlName})`;
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
