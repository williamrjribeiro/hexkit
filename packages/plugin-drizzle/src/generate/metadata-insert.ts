import type {
  PersistenceRepositoryMethodModel,
  PersistenceRepositoryModel,
} from "../model/repository.ts";
import type { PersistenceColumnWithForeignKey } from "../model/column.ts";
import { mapperFunctionName } from "../model/table.ts";

export function isMetadataInsert(method: PersistenceRepositoryMethodModel): boolean {
  return method.kind === "insert" && method.usesBlobStore === true;
}

export function metadataInsertTargetTables(
  repository: PersistenceRepositoryModel,
  method: PersistenceRepositoryMethodModel,
): string[] {
  return parentReferences(repository, method).map(
    ({ column }) => column.foreignKey.targetTableExportName,
  );
}

export function metadataInsertUsesRandomUuid(
  repository: PersistenceRepositoryModel,
  method: PersistenceRepositoryMethodModel,
): boolean {
  if (!isMetadataInsert(method)) return false;
  return identityColumn(repository).sqlType === "text";
}

export function renderMetadataInsertMethod(
  repository: PersistenceRepositoryModel,
  method: PersistenceRepositoryMethodModel,
): string {
  const table = repository.table;
  const mapper = mapperFunctionName(table.schemaName);
  const signatureParameters = method.parameters
    .map((parameter) => `${parameter.name}: ${parameter.typeExpression}`)
    .join(", ");
  const parents = parentReferences(repository, method);
  if (parents.length === 0) {
    throw new Error(
      `Blob upload operation "${method.operationId}" requires a path parameter that targets a persisted foreign key on ${table.schemaName}.`,
    );
  }

  const parentChecks = parents.flatMap(({ parameter, column }, index) => {
    const parentName = index === 0 ? "parent" : `parent${index + 1}`;
    const foreignKey = column.foreignKey;
    return [
      `      const [${parentName}] = await db.select().from(${foreignKey.targetTableExportName}).where(eq(${foreignKey.targetTableExportName}.${foreignKey.targetColumnPropertyName}, ${parameter.name})).limit(1);`,
      ...renderMissingParent(parentName, method, table.schemaName, parameter.name),
    ];
  });

  const values = renderValues(repository, method);
  const result = returnTypeAllowsUndefined(method.returnTypeExpression)
    ? `      return row ? ${mapper}(row) : undefined;`
    : [
        `      if (!row) throw new Error("Drizzle did not return the inserted ${table.schemaName.toLowerCase()}");`,
        `      return ${mapper}(row);`,
      ].join("\n");

  return [
    `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
    ...parentChecks,
    `      const [row] = await db.insert(${table.exportName}).values({`,
    ...values.map((value) => `        ${value}`),
    "      }).returning();",
    result,
    "    }",
  ].join("\n");
}

function parentReferences(
  repository: PersistenceRepositoryModel,
  method: PersistenceRepositoryMethodModel,
) {
  return method.parameters.flatMap((parameter) => {
    if (parameter.location !== "path") return [];
    const column = repository.table.columns.find(
      (candidate) =>
        candidate.propertyName === parameter.name && candidate.foreignKey !== undefined,
    );
    return column?.foreignKey === undefined
      ? []
      : [{ parameter, column: column as PersistenceColumnWithForeignKey }];
  });
}

function renderMissingParent(
  parentName: string,
  method: PersistenceRepositoryMethodModel,
  schemaName: string,
  parameterName: string,
): string[] {
  if (returnTypeAllowsUndefined(method.returnTypeExpression)) {
    return [`      if (!${parentName}) return undefined;`];
  }
  return [
    `      if (!${parentName}) throw new Error(\`${schemaName} parent \${${parameterName}} was not found\`);`,
  ];
}

function renderValues(
  repository: PersistenceRepositoryModel,
  method: PersistenceRepositoryMethodModel,
): string[] {
  const identity = identityColumn(repository);
  const values = identity.sqlType === "text" ? [`${identity.propertyName}: randomUUID(),`] : [];

  for (const parameter of method.parameters) {
    const column = repository.table.columns.find(
      (candidate) => candidate.propertyName === parameter.name && !candidate.isIdentity,
    );
    if (column === undefined) {
      throw new Error(
        `Blob upload operation "${method.operationId}" parameter "${parameter.name}" has no matching persisted column on ${repository.table.schemaName}.`,
      );
    }
    if (parameter.typeExpression.includes("undefined")) {
      values.push(`...(${parameter.name} !== undefined ? { ${parameter.name} } : {}),`);
    } else {
      values.push(`${parameter.name},`);
    }
  }
  return values;
}

function identityColumn(repository: PersistenceRepositoryModel) {
  const identity = repository.table.columns.find((column) => column.isIdentity);
  if (identity === undefined) {
    throw new Error(`Persistence table "${repository.table.schemaName}" has no identity column.`);
  }
  if (identity.sqlType !== "text" && identity.sqlType !== "integer") {
    throw new Error(
      `Blob upload aggregate "${repository.table.schemaName}" requires a text or integer identity.`,
    );
  }
  return identity;
}

function returnTypeAllowsUndefined(returnTypeExpression: string): boolean {
  return (
    /\|\s*undefined\b/.test(returnTypeExpression) || /\bundefined\s*\|/.test(returnTypeExpression)
  );
}
