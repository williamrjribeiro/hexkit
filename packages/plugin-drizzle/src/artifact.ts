import { createArtifactKey } from "@hexkit/plugin-api";

export type PersistenceTableExport = {
  schemaName: string;
  exportName: string;
  tableName: string;
};

export type PersistenceMapperExport = {
  entityName: string;
  functionName: string;
  filePath: string;
};

export type PersistenceRepositoryExport = {
  aggregate: string;
  portName: string;
  factoryName: string;
  filePath: string;
  runtimeKey: string;
};

export type PersistenceArtifact = {
  artifactVersion: 1;
  schemaFilePath: string;
  mapperFilePath: string;
  migrationPath: string;
  tables: readonly PersistenceTableExport[];
  mappers: readonly PersistenceMapperExport[];
  repositories: readonly PersistenceRepositoryExport[];
};

export const PERSISTENCE_ARTIFACT =
  createArtifactKey<PersistenceArtifact>("drizzle.persistence.v1");
