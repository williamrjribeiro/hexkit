import { createArtifactKey } from "@hexkit/plugin-api";

export type ApplicationEntity = {
  name: string;
  exportName: string;
  filePath: string;
};

export type ApplicationParameter = {
  name: string;
  typeExpression: string;
};

export type ApplicationRepositoryMethod = {
  operationId: string;
  name: string;
  action: string;
  parameters: readonly ApplicationParameter[];
  returnTypeExpression: string;
};

export type ApplicationRepository = {
  aggregate: string;
  name: string;
  filePath: string;
  parameterName: string;
  methods: readonly ApplicationRepositoryMethod[];
};

export type ApplicationUseCase = {
  operationId: string;
  typeName: string;
  factoryName: string;
  filePath: string;
  requiresAuth: boolean;
  repositoryName: string;
  repositoryParameterName: string;
  methodName: string;
  parameters: readonly ApplicationParameter[];
  returnTypeExpression: string;
};

export type ApplicationAuthenticatorPort = {
  name: "Authenticator";
  filePath: "src/core/ports/authenticator.ts";
};

export type ApplicationArtifact = {
  artifactVersion: 1;
  entities: readonly ApplicationEntity[];
  repositories: readonly ApplicationRepository[];
  useCases: readonly ApplicationUseCase[];
  authenticatorPort?: ApplicationAuthenticatorPort;
};

export const APPLICATION_ARTIFACT = createArtifactKey<ApplicationArtifact>(
  "hexagonal.application.v1",
);
