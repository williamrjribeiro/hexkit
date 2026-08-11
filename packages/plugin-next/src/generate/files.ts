import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import type { ContractArtifact } from "@hexkit/plugin-apical";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { NextHttpArtifact, NextSurface } from "../artifact.ts";
import {
  CONTROLLERS_FILE_PATH,
  deriveNextHttpModel,
  HELPERS_FILE_PATH,
  SERVER_ACCESS_FILE_PATH,
} from "../model/derive.ts";
import { renderAuthAdapterFile } from "./auth-adapter.ts";
import { renderControllersFile } from "./controllers.ts";
import { renderHelpersFile } from "./helpers.ts";
import { renderServerAccessFile } from "./server-access.ts";

export type GeneratedNextDal = {
  files: GeneratedFile[];
  artifact: NextHttpArtifact;
};

export function generateNextDalFromArtifacts(
  contract: ContractArtifact,
  application: ApplicationArtifact,
  options?: { surface?: NextSurface },
): GeneratedNextDal {
  const model = deriveNextHttpModel(contract, application, options);
  const includesRoutes = model.surface !== "rsc";

  const files: GeneratedFile[] = [
    renderServerAccessFile(model, application),
    ...(includesRoutes
      ? [renderHelpersFile(), renderControllersFile(model, contract, application)]
      : []),
    ...(includesRoutes && model.authenticator !== undefined ? [renderAuthAdapterFile()] : []),
  ];

  return {
    files,
    artifact: {
      artifactVersion: 1,
      surface: model.surface,
      helpersFilePath: HELPERS_FILE_PATH,
      controllersFilePath: CONTROLLERS_FILE_PATH,
      serverAccessFilePath: SERVER_ACCESS_FILE_PATH,
      routes: model.routes,
      uiPages: model.uiPages,
      repositories: model.repositories,
      ...(model.authenticator === undefined ? {} : { authenticator: model.authenticator }),
    },
  };
}
