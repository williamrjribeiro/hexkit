import { createArtifactKey } from "@hexkit/plugin-api";
import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";

export type NextRouteFile = {
  filePath: string;
  openApiPath: string;
  methods: readonly NextMethodBinding[];
};

export type NextUiPage = {
  filePath: string;
  openApiPath: string;
  operationId: string;
  useCaseAccessorName: string;
  paramNames: readonly string[];
};

export type NextMethodBinding = {
  method: "get" | "post" | "put" | "patch" | "delete" | "head" | "options";
  operationId: string;
  useCaseTypeName: string;
  useCaseFilePath: string;
  wrapperName: string;
  wrapperImportPath: string;
  responseMapName?: string;
  responseMapImportPath?: string;
  hasJsonBody: boolean;
  requiresPrincipal: boolean;
};

export type NextSurface = "routes" | "rsc" | "both";

export type NextHttpModel = {
  surface: NextSurface;
  routes: readonly NextRouteFile[];
  uiPages: readonly NextUiPage[];
  repositories: ApplicationArtifact["repositories"];
  authenticator?: {
    portFilePath: string;
    adapterFilePath: string;
    adapterFactoryName: "createInMemoryAuthenticator";
  };
};

export type NextHttpArtifact = {
  artifactVersion: 1;
  surface: NextSurface;
  helpersFilePath: string;
  controllersFilePath: string;
  serverAccessFilePath: string;
  routes: readonly NextRouteFile[];
  uiPages: readonly NextUiPage[];
  repositories: ApplicationArtifact["repositories"];
  authenticator?: NextHttpModel["authenticator"];
};

export const NEXT_HTTP_ARTIFACT = createArtifactKey<NextHttpArtifact>("next.http.v1");
