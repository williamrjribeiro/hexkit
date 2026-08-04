import type { ContractArtifact } from "@hexkit/plugin-apical";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { ApplicationArtifact } from "../artifact.ts";
import { deriveApplicationModel, toApplicationArtifact } from "../model/derive.ts";
import { renderDomainFile } from "./domain.ts";
import { renderRepositoryFile } from "./repository.ts";
import { renderUseCaseFile } from "./use-case.ts";

export type GeneratedApplication = {
  files: GeneratedFile[];
  artifact: ApplicationArtifact;
};

export function generateApplicationFromContract(contract: ContractArtifact): GeneratedApplication {
  const model = deriveApplicationModel(contract);
  const files = [
    ...model.entities.map(renderDomainFile),
    ...model.repositories.map(renderRepositoryFile),
    ...model.useCases.map(renderUseCaseFile),
  ];

  return {
    files,
    artifact: toApplicationArtifact(model),
  };
}
