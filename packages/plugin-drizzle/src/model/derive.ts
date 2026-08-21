import type { ContractArtifact } from "@hexkit/plugin-apical";
import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import { compareText } from "@hexkit/codegen";

import type {
  PersistenceArtifact,
  PersistenceMapperExport,
  PersistenceRepositoryExport,
  PersistenceTableExport,
} from "../artifact.ts";
import type { PersistenceEnumModel } from "./column.ts";
import { deriveRepository, type PersistenceRepositoryModel } from "./repository.ts";
import {
  assertForeignKeyTargets,
  collectEnums,
  deriveTable,
  mapperFunctionName,
  orderTablesByDependency,
  type PersistenceTableModel,
} from "./table.ts";

export type PersistenceModel = {
  applicationSlug: string;
  migrationPath: string;
  schemaFilePath: string;
  mapperFilePath: string;
  enums: readonly PersistenceEnumModel[];
  tables: readonly PersistenceTableModel[];
  repositories: readonly PersistenceRepositoryModel[];
};

export type { PersistenceEnumModel } from "./column.ts";
export type {
  PersistenceColumnModel,
  PersistenceColumnSqlType,
  PersistenceColumnWithForeignKey,
  PersistenceForeignKeyModel,
} from "./column.ts";
export { columnsWithForeignKeys, deriveColumn } from "./column.ts";
export type { PersistenceMethodKind } from "./method-kind.ts";
export { refineMethodKind, resolveMethodKind } from "./method-kind.ts";
export type { PersistenceRepositoryMethodModel, PersistenceRepositoryModel } from "./repository.ts";
export { deriveRepository } from "./repository.ts";
export type { PersistenceTableModel } from "./table.ts";
export { mapperFunctionName, orderTablesByDependency } from "./table.ts";

/**
 * Builds the persistence model from the OpenAPI contract and hexagonal
 * application artifacts.
 *
 * Only schemas that declare persistence become tables. Nested object, array,
 * and `$ref` properties on those tables are stored as JSONB. A `$ref` property
 * cannot also declare `x-hexkit.reference`; use a scalar foreign-key property
 * instead, because nested objects, arrays, and `$ref` values cannot be both an
 * embed and a relation. Schemas without persistence still appear in the contract
 * and domain layers, but they do not get tables.
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
