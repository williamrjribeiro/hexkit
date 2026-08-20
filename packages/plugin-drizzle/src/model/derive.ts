import type {
  ContractArtifact,
  ContractOperation,
  ContractProperty,
  ContractScalarValue,
  ContractSchema,
} from "@hexkit/plugin-apical";
import type {
  ApplicationArtifact,
  ApplicationRepository,
} from "@hexkit/plugin-architecture-hexagonal";
import { toCamelCase, toKebabCase, toPascalCase, toSnakeCase } from "@hexkit/codegen";

import type {
  PersistenceArtifact,
  PersistenceMapperExport,
  PersistenceRepositoryExport,
  PersistenceTableExport,
} from "../artifact.ts";

/**
 * Postgres column type for one persisted OpenAPI property.
 *
 * Nested objects, arrays, and `$ref` values use `jsonb` (Postgres JSONB, not
 * `json`). Scalar foreign keys keep a matching scalar type such as `integer`
 * or `text`.
 */
export type PersistenceColumnSqlType = "boolean" | "enum" | "integer" | "jsonb" | "text";

export type PersistenceEnumModel = {
  exportName: string;
  sqlName: string;
  values: readonly string[];
};

export type PersistenceForeignKeyModel = {
  targetSchemaName: string;
  targetTableExportName: string;
  targetColumnPropertyName: string;
  targetColumnSqlName: string;
};

/**
 * One column on a generated persistence table.
 *
 * `sqlType` is `jsonb` when the OpenAPI property is a nested object, array, or
 * `$ref`. `foreignKey` is set only for scalar `x-hexkit.reference` properties.
 */
export type PersistenceColumnModel = {
  propertyName: string;
  sqlName: string;
  sqlType: PersistenceColumnSqlType;
  required: boolean;
  isIdentity: boolean;
  enumExportName?: string;
  enumSqlName?: string;
  enumValues?: readonly string[];
  foreignKey?: PersistenceForeignKeyModel;
};

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

export type PersistenceMethodKind = "delete" | "insert" | "list" | "select" | "stub" | "update";

export type PersistenceRepositoryMethodModel = {
  operationId: string;
  name: string;
  kind: PersistenceMethodKind;
  parameters: readonly { name: string; typeExpression: string }[];
  returnTypeExpression: string;
};

export type PersistenceRepositoryModel = {
  aggregate: string;
  portName: string;
  factoryName: string;
  filePath: string;
  runtimeKey: string;
  table: PersistenceTableModel;
  methods: readonly PersistenceRepositoryMethodModel[];
};

export type PersistenceModel = {
  applicationSlug: string;
  migrationPath: string;
  schemaFilePath: string;
  mapperFilePath: string;
  enums: readonly PersistenceEnumModel[];
  tables: readonly PersistenceTableModel[];
  repositories: readonly PersistenceRepositoryModel[];
};

/**
 * Builds the persistence model from the OpenAPI contract and hexagonal
 * application artifacts.
 *
 * Only schemas that declare persistence become tables. Nested object, array,
 * and `$ref` properties on those tables are stored as JSONB. A `$ref` property
 * cannot also declare `x-hexkit.reference`; use a scalar foreign-key property
 * instead. Schemas without persistence still appear in the contract and domain
 * layers, but they do not get tables.
 */
export function derivePersistenceModel(
  contract: ContractArtifact,
  application: ApplicationArtifact,
): PersistenceModel {
  const operationsById = new Map(
    contract.operations.map((operation) => [operation.operationId, operation] as const),
  );
  const schemasByName = new Map(contract.schemas.map((schema) => [schema.name, schema] as const));

  const tableModels = contract.schemas
    .filter((schema) => schema.persistence !== undefined)
    .map((schema) => deriveTable(schema, schemasByName))
    .toSorted((left, right) => compareText(left.schemaName, right.schemaName));

  const tablesBySchema = new Map(tableModels.map((table) => [table.schemaName, table] as const));
  assertForeignKeyTargets(tableModels, tablesBySchema);

  const orderedTables = orderTablesByDependency(tableModels);
  const enums = collectEnums(orderedTables);

  const repositories = application.repositories
    .map((repository) => deriveRepository(repository, tablesBySchema, operationsById))
    .toSorted((left, right) => compareText(left.aggregate, right.aggregate));

  const applicationSlug = contract.application.slug;

  return {
    applicationSlug,
    migrationPath: `drizzle/0000_${applicationSlug}.sql`,
    schemaFilePath: "src/adapters/db/schema.ts",
    mapperFilePath: "src/adapters/db/mappers.ts",
    enums,
    tables: orderedTables,
    repositories,
  };
}

export function toPersistenceArtifact(model: PersistenceModel): PersistenceArtifact {
  const tables: PersistenceTableExport[] = model.tables.map((table) => ({
    schemaName: table.schemaName,
    exportName: table.exportName,
    tableName: table.tableName,
  }));

  const mappers: PersistenceMapperExport[] = model.tables.map((table) => ({
    entityName: table.schemaName,
    functionName: mapperFunctionName(table.schemaName),
    filePath: model.mapperFilePath,
  }));

  const repositories: PersistenceRepositoryExport[] = model.repositories.map((repository) => ({
    aggregate: repository.aggregate,
    portName: repository.portName,
    factoryName: repository.factoryName,
    filePath: repository.filePath,
    runtimeKey: repository.runtimeKey,
  }));

  return {
    artifactVersion: 1,
    schemaFilePath: model.schemaFilePath,
    mapperFilePath: model.mapperFilePath,
    migrationPath: model.migrationPath,
    tables,
    mappers,
    repositories,
  };
}

export function mapperFunctionName(schemaName: string): string {
  return `map${schemaName}Row`;
}

function deriveTable(
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

function deriveColumn(
  schemaName: string,
  property: ContractProperty,
  identity: string,
  schemasByName: ReadonlyMap<string, ContractSchema>,
): PersistenceColumnModel {
  const sqlName = toSnakeCase(property.name);

  if (property.reference !== undefined) {
    if (
      property.type.kind === "reference" ||
      property.type.kind === "object" ||
      property.type.kind === "array"
    ) {
      throw new Error(
        `Schema "${schemaName}" property "${property.name}" cannot combine $ref with x-hexkit.reference. Use a scalar FK property, or omit x-hexkit.reference to store JSONB.`,
      );
    }
  }

  const columnType = resolveColumnType(schemaName, property);

  const column: PersistenceColumnModel = {
    propertyName: property.name,
    sqlName,
    sqlType: columnType.sqlType,
    required: property.required && !property.type.nullable,
    isIdentity: property.name === identity,
    ...(columnType.enumExportName === undefined
      ? {}
      : {
          enumExportName: columnType.enumExportName,
          enumSqlName: columnType.enumSqlName,
          enumValues: columnType.enumValues,
        }),
  };

  if (property.reference !== undefined) {
    const target = schemasByName.get(property.reference.schema);
    if (target === undefined) {
      throw new Error(
        `Schema "${schemaName}" property "${property.name}" references unknown schema "${property.reference.schema}".`,
      );
    }
    if (target.persistence === undefined) {
      throw new Error(
        `Schema "${schemaName}" property "${property.name}" references "${property.reference.schema}" which has no x-hexkit.persistence.`,
      );
    }

    column.foreignKey = {
      targetSchemaName: property.reference.schema,
      targetTableExportName: target.persistence.table,
      targetColumnPropertyName: property.reference.property,
      targetColumnSqlName: toSnakeCase(property.reference.property),
    };
  }

  return column;
}

function resolveColumnType(
  schemaName: string,
  property: ContractProperty,
): {
  sqlType: PersistenceColumnSqlType;
  enumExportName?: string;
  enumSqlName?: string;
  enumValues?: readonly string[];
} {
  const type = property.type;
  switch (type.kind) {
    case "boolean":
      return { sqlType: "boolean" };
    case "integer":
      return { sqlType: "integer" };
    case "number":
      throw new Error(
        `Schema "${schemaName}" property "${property.name}" uses number, which is not supported for Drizzle persistence yet.`,
      );
    case "string": {
      if (type.enum !== undefined && type.enum.length > 0) {
        const sqlName = toSnakeCase(`${schemaName}_${property.name}`);
        return {
          sqlType: "enum",
          enumExportName: toCamelCase(`${schemaName}${toPascalCase(property.name)}`),
          enumSqlName: sqlName,
          enumValues: type.enum.map((value) =>
            requireStringEnumValue(value, `Schema "${schemaName}" property "${property.name}"`),
          ),
        };
      }
      return { sqlType: "text" };
    }
    case "reference":
    case "array":
    case "object":
      return { sqlType: "jsonb" };
  }
}

function assertForeignKeyTargets(
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

function orderTablesByDependency(
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

function collectEnums(tables: readonly PersistenceTableModel[]): PersistenceEnumModel[] {
  const enums = new Map<string, PersistenceEnumModel>();

  for (const table of tables) {
    for (const column of table.columns) {
      if (
        column.sqlType !== "enum" ||
        column.enumExportName === undefined ||
        column.enumSqlName === undefined ||
        column.enumValues === undefined
      ) {
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

function deriveRepository(
  repository: ApplicationRepository,
  tablesBySchema: ReadonlyMap<string, PersistenceTableModel>,
  operationsById: ReadonlyMap<string, ContractOperation>,
): PersistenceRepositoryModel {
  const table = tablesBySchema.get(repository.aggregate);
  if (table === undefined) {
    throw new Error(
      `Application repository aggregate "${repository.aggregate}" has no schema with x-hexkit.persistence.`,
    );
  }

  const methods = repository.methods.map((method) => {
    const operation = operationsById.get(method.operationId);
    if (operation === undefined) {
      throw new Error(
        `Application repository method "${method.operationId}" has no matching contract operation.`,
      );
    }

    const parameters = method.parameters.map((parameter) => ({
      name: parameter.name,
      typeExpression: parameter.typeExpression,
    }));
    const kind = refineMethodKind(
      resolveMethodKind(operation, method.action),
      parameters,
      method.returnTypeExpression,
    );

    return {
      operationId: method.operationId,
      name: method.name,
      kind,
      parameters,
      returnTypeExpression: method.returnTypeExpression,
    };
  });

  return {
    aggregate: repository.aggregate,
    portName: repository.name,
    factoryName: `createDrizzle${toPascalCase(repository.aggregate)}Repository`,
    filePath: `src/adapters/db/${toKebabCase(repository.aggregate)}-repository.ts`,
    runtimeKey: repository.parameterName,
    table,
    methods,
  };
}

function resolveMethodKind(operation: ContractOperation, action: string): PersistenceMethodKind {
  const normalized = action.toLowerCase();
  if (
    normalized === "create" ||
    normalized === "add" ||
    normalized === "place" ||
    normalized === "insert"
  ) {
    return "insert";
  }
  if (normalized === "update" || normalized === "patch") {
    return "update";
  }
  if (normalized === "delete" || normalized === "remove") {
    return "delete";
  }
  if (normalized === "list" || normalized === "findall" || normalized === "index") {
    return "list";
  }
  if (
    normalized === "gethealth" ||
    normalized === "health" ||
    normalized === "healthcheck" ||
    normalized === "readiness"
  ) {
    return "stub";
  }
  if (
    normalized === "get" ||
    normalized === "read" ||
    normalized === "find" ||
    normalized.startsWith("get")
  ) {
    return "select";
  }

  switch (operation.method) {
    case "post":
      return "insert";
    case "put":
    case "patch":
      return "update";
    case "delete":
      return "delete";
    case "get":
      return "select";
    default:
      throw new Error(
        `Cannot infer persistence action for operation "${operation.operationId}" (${operation.method}). Add x-hexkit.operation.action.`,
      );
  }
}

function refineMethodKind(
  kind: PersistenceMethodKind,
  parameters: readonly { name: string; typeExpression: string }[],
  returnTypeExpression: string,
): PersistenceMethodKind {
  if (kind !== "select" || parameters.length > 0) {
    return kind;
  }

  if (returnTypeExpression.startsWith("Array<")) {
    return "list";
  }

  // Parameterless non-list GETs (e.g. readiness) are not row lookups.
  return "stub";
}

function requireStringEnumValue(value: ContractScalarValue, location: string): string {
  if (typeof value !== "string") {
    throw new Error(`${location} enum values must be strings for Postgres enums.`);
  }
  return value;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
