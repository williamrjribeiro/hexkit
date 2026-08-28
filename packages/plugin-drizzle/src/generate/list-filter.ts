import type {
  PersistenceRepositoryMethodModel,
  PersistenceRepositoryModel,
} from "../model/repository.ts";
import type { PersistenceColumnModel } from "../model/column.ts";
import { mapperFunctionName } from "../model/table.ts";

export function renderFilteredListMethodBody(
  repository: PersistenceRepositoryModel,
  method: PersistenceRepositoryMethodModel,
): { bodyLines: string[]; needsInArray: boolean } {
  const table = repository.table;
  const mapper = mapperFunctionName(table.schemaName);
  const filterParameter = method.parameters[0];

  if (filterParameter === undefined) {
    throw new Error(
      `Filtered list operation "${method.operationId}" must declare at least one query parameter.`,
    );
  }

  const column = table.columns.find((entry) => entry.propertyName === filterParameter.name);
  if (column === undefined) {
    throw new Error(
      `List operation "${method.operationId}" parameter "${filterParameter.name}" has no matching persisted column on ${table.schemaName}.`,
    );
  }

  const paramName = filterParameter.name;

  if (column.sqlType === "enum" || column.sqlType === "text" || column.sqlType === "integer") {
    return {
      needsInArray: true,
      bodyLines: [
        `    async ${method.name}(${renderSignature(method)}): Promise<${method.returnTypeExpression}> {`,
        `      const rows = await db`,
        `        .select()`,
        `        .from(${table.exportName})`,
        `        .where(inArray(${table.exportName}.${column.propertyName}, ${paramName}));`,
        `      return rows.map(${mapper});`,
        "    }",
      ],
    };
  }

  if (column.sqlType === "jsonb") {
    return {
      needsInArray: false,
      bodyLines: [
        `    async ${method.name}(${renderSignature(method)}): Promise<${method.returnTypeExpression}> {`,
        `      const rows = await db.select().from(${table.exportName});`,
        `      return rows`,
        "        .filter((row) => {",
        `          const values = row.${column.propertyName} as Array<{ name?: string }> | null;`,
        "          if (values == null) return false;",
        `          return values.some((entry) => entry.name !== undefined && ${paramName}.includes(entry.name));`,
        "        })",
        `        .map(${mapper});`,
        "    }",
      ],
    };
  }

  throw new Error(
    `List operation "${method.operationId}" cannot filter on column "${column.propertyName}" with sql type "${column.sqlType}".`,
  );
}

export function findListFilterColumn(
  columns: readonly PersistenceColumnModel[],
  parameterName: string,
): PersistenceColumnModel | undefined {
  return columns.find((column) => column.propertyName === parameterName);
}

function renderSignature(method: PersistenceRepositoryMethodModel): string {
  return method.parameters
    .map((parameter) => `${parameter.name}: ${parameter.typeExpression}`)
    .join(", ");
}
