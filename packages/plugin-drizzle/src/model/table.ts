import { compareText, toKebabCase, toSnakeCase } from "@hexkit/codegen";
import type { ContractSchema } from "@hexkit/plugin-apical";

import { deriveColumn, type PersistenceColumnModel, type PersistenceEnumModel } from "./column.ts";

export type PersistenceTableModel = {
  schemaName: string;
  exportName: string;
  tableName: string;
  identityPropertyName: string;
  identitySqlName: string;
  columns: readonly PersistenceColumnModel[];
  domainFilePath: string;
  apicalModulePath: string;
};

export function deriveTable(
  schema: ContractSchema,
  schemasByName: ReadonlyMap<string, ContractSchema>,
): PersistenceTableModel {
  const persistence = schema.persistence;
  if (persistence === undefined) {
    throw new Error(`Schema "${schema.name}" is missing x-hexkit.persistence.`);
  }

  if (!schema.properties.some((property) => property.name === persistence.identity)) {
    throw new Error(
      `Schema "${schema.name}" persistence identity "${persistence.identity}" is not a property.`,
    );
  }

  const columns = schema.properties.map((property) =>
    deriveColumn(schema.name, property, persistence.identity, schemasByName),
  );

  return {
    schemaName: schema.name,
    exportName: persistence.table,
    tableName: persistence.table,
    identityPropertyName: persistence.identity,
    identitySqlName: toSnakeCase(persistence.identity),
    columns,
    domainFilePath: `src/core/domain/${toKebabCase(schema.name)}.ts`,
    apicalModulePath: schema.modulePath,
  };
}

export function assertForeignKeyTargets(
  tables: readonly PersistenceTableModel[],
  tablesBySchema: ReadonlyMap<string, PersistenceTableModel>,
): void {
  for (const table of tables) {
    for (const column of table.columns) {
      if (column.foreignKey === undefined) continue;
      if (!tablesBySchema.has(column.foreignKey.targetSchemaName)) {
        throw new Error(
          `Foreign key from "${table.schemaName}.${column.propertyName}" targets schema "${column.foreignKey.targetSchemaName}" without a persistence table.`,
        );
      }
    }
  }
}

export function orderTablesByDependency(
  tables: readonly PersistenceTableModel[],
): PersistenceTableModel[] {
  const remaining = new Map(tables.map((table) => [table.schemaName, table] as const));
  const ordered: PersistenceTableModel[] = [];

  while (remaining.size > 0) {
    const ready = [...remaining.values()]
      .filter((table) =>
        table.columns.every((column) => {
          if (column.foreignKey === undefined) return true;
          return !remaining.has(column.foreignKey.targetSchemaName);
        }),
      )
      .toSorted((left, right) => compareText(left.schemaName, right.schemaName));

    if (ready.length === 0) {
      const cycle = [...remaining.keys()].toSorted(compareText).join(", ");
      throw new Error(`Cannot order persistence tables due to a foreign-key cycle: ${cycle}.`);
    }

    for (const table of ready) {
      remaining.delete(table.schemaName);
      ordered.push(table);
    }
  }

  return ordered;
}

export function collectEnums(tables: readonly PersistenceTableModel[]): PersistenceEnumModel[] {
  const enums = new Map<string, PersistenceEnumModel>();

  for (const table of tables) {
    for (const column of table.columns) {
      if (column.sqlType !== "enum") {
        continue;
      }

      const existing = enums.get(column.enumSqlName);
      if (existing === undefined) {
        enums.set(column.enumSqlName, {
          exportName: column.enumExportName,
          sqlName: column.enumSqlName,
          values: column.enumValues,
        });
      }
    }
  }

  return [...enums.values()].toSorted((left, right) => compareText(left.sqlName, right.sqlName));
}

export function mapperFunctionName(schemaName: string): string {
  return `map${schemaName}Row`;
}
