import { createArtifactKey } from "@hexkit/plugin-api";
import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import type { ContractHttpMethod } from "@hexkit/plugin-apical";
import type { HttpAuthSchemeBinding, HttpControllerBinding } from "@hexkit/shared";

export type NextRouteFile = {
  filePath: string;
  openApiPath: string;
  methods: readonly NextMethodBinding[];
};

export type NextAuthSchemeBinding = HttpAuthSchemeBinding;

export type NextUiPageParameter = {
  name: string;
  typeExpression: string;
};

export type NextUiPage = {
  filePath: string;
  openApiPath: string;
  operationId: string;
  useCaseAccessorName: string;
  paramNames: readonly string[];
  parameters: readonly NextUiPageParameter[];
};

export type NextMethodBinding = Omit<HttpControllerBinding, "method"> & {
  method: Exclude<ContractHttpMethod, "trace">;
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
  helpersFilePath?: string;
  controllersFilePath?: string;
  runtimeFilePath?: string;
  serverAccessFilePath: string;
  routes: readonly NextRouteFile[];
  uiPages: readonly NextUiPage[];
  repositories: ApplicationArtifact["repositories"];
  authenticator?: NextHttpModel["authenticator"];
};

export const NEXT_HTTP_ARTIFACT = createArtifactKey<NextHttpArtifact>("next.http.v1");
