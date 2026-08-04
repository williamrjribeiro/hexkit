import type { ContractArtifact } from "@hexkit/plugin-apical";
import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { PersistenceArtifact } from "../artifact.ts";
import { derivePersistenceModel, toPersistenceArtifact } from "../model/derive.ts";
import { renderMapperFile } from "./mappers.ts";
import { renderMigrationFile } from "./migration.ts";
import { renderRepositoryFiles } from "./repository.ts";
import { renderSchemaFile } from "./schema.ts";

export type GeneratedPersistence = {
  files: GeneratedFile[];
  artifact: PersistenceArtifact;
};

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
