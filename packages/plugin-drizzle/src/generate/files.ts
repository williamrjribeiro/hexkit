import type { ContractArtifact } from "@hexkit/plugin-apical";
import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { PersistenceArtifact } from "../artifact.ts";
import { derivePersistenceModel, toPersistenceArtifact } from "../model/derive.ts";
import { renderMapperFile } from "./mappers.ts";
import { renderMigrationFile } from "./migration.ts";
import { renderRepositoryFiles } from "./repository.ts";
import { renderSchemaFile } from "./schema.ts";

/** Generated persistence files plus the artifact later plugins can consume. */
export type GeneratedPersistence = {
  files: GeneratedFile[];
  artifact: PersistenceArtifact;
};

/**
 * Generates Drizzle schema, migration, mapper, and repository files from the
 * contract and hexagonal application artifacts.
 *
 * Nested object, array, and `$ref` columns are emitted as Postgres JSONB. Only
 * schemas that declare persistence produce tables.
 */
export function generatePersistenceFromArtifacts(
  contract: ContractArtifact,
  application: ApplicationArtifact,
): GeneratedPersistence {
  const model = derivePersistenceModel(contract, application);
  const files = [
    renderSchemaFile(model),
    renderMigrationFile(model),
    renderMapperFile(model),
    ...renderRepositoryFiles(model),
  ];

  return {
    files,
    artifact: toPersistenceArtifact(model),
  };
}
