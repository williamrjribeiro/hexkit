import type { GeneratedFile } from "@hexkit/plugin-api";

import {
  columnsWithForeignKeys,
  type PersistenceColumnModel,
  type PersistenceColumnWithForeignKey,
  type PersistenceEnumModel,
} from "../model/column.ts";
import type { PersistenceModel } from "../model/derive.ts";
import type { PersistenceTableModel } from "../model/table.ts";

/** Writes the SQL migration that creates those tables, including JSONB columns. */
export function renderMigrationFile(model: PersistenceModel): GeneratedFile {
  const sections = [
    ...model.enums.map(renderEnumMigration),
    ...model.tables.map(renderTableMigration),
  ];

  return {
    path: model.migrationPath,
    contents: `${sections.join("\n\n")}\n`,
    ownership: "generated",
  };
}

function renderEnumMigration(enumeration: PersistenceEnumModel): string {
  const values = enumeration.values.map((value) => `'${escapeSql(value)}'`).join(", ");
  return `DO $$
BEGIN
  CREATE TYPE "${enumeration.sqlName}" AS ENUM (${values});
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;`;
}

function renderTableMigration(table: PersistenceTableModel): string {
  const columnLines = table.columns.map((column) => renderColumnSql(column));
  const foreignKeys = columnsWithForeignKeys(table.columns).map((column) =>
    renderForeignKeyConstraint(table, column),
  );

  const body = [...columnLines, ...foreignKeys].map((line, index, lines) => {
    const suffix = index < lines.length - 1 ? "," : "";
    return `  ${line}${suffix}`;
  });

  return [`CREATE TABLE IF NOT EXISTS "${table.tableName}" (`, ...body, ");"].join("\n");
}

function renderColumnSql(column: PersistenceColumnModel): string {
  const typeSql = renderSqlType(column);
  const nullSql = column.required || column.isIdentity ? " NOT NULL" : "";
  const primaryKey = column.isIdentity ? " PRIMARY KEY" : "";
  return `"${column.sqlName}" ${typeSql}${primaryKey}${nullSql}`;
}

function renderSqlType(column: PersistenceColumnModel): string {
  switch (column.sqlType) {
    case "boolean":
      return "boolean";
    case "integer":
      return "integer";
    case "text":
      return "text";
    case "jsonb":
      return "jsonb";
    case "enum":
      return `"${column.enumSqlName}"`;
  }
}

function renderForeignKeyConstraint(
  table: PersistenceTableModel,
  column: PersistenceColumnWithForeignKey,
): string {
  const foreignKey = column.foreignKey;
  const constraintName = `${table.tableName}_${column.sqlName}_${foreignKey.targetTableExportName}_${foreignKey.targetColumnSqlName}_fk`;
  return `CONSTRAINT "${constraintName}"\n    FOREIGN KEY ("${column.sqlName}") REFERENCES "public"."${foreignKey.targetTableExportName}"("${foreignKey.targetColumnSqlName}")`;
}

function escapeSql(value: string): string {
  return value.replaceAll("'", "''");
}
