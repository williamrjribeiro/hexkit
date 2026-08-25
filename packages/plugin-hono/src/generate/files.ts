import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import type { ContractArtifact } from "@hexkit/plugin-apical";
import type { GeneratedFile } from "@hexkit/plugin-api";
import { renderInMemoryAuthAdapterFile } from "@hexkit/shared";

import type { HttpArtifact } from "../artifact.ts";

import { deriveHttpModel, toHttpArtifact } from "../model/derive.ts";
import { renderControllersFile } from "./controllers.ts";
import { renderRoutesFile } from "./routes.ts";
import { renderRuntimeFile } from "./runtime.ts";

export type GeneratedHttp = {
  files: GeneratedFile[];
  artifact: HttpArtifact;
};

export function generateHttpFromArtifacts(
  contract: ContractArtifact,
  application: ApplicationArtifact,
): GeneratedHttp {
  const model = deriveHttpModel(contract, application);
  const files = [
    renderControllersFile(model),
    renderRoutesFile(model),
    ...(model.authenticator === undefined ? [] : [renderInMemoryAuthAdapterFile()]),
    renderRuntimeFile(model),
  ];

  return {
    files,
    artifact: toHttpArtifact(model),
  };
}
