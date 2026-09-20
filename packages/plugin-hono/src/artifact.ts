import { createArtifactKey } from "@hexkit/plugin-api";
import type { HttpAuthSchemeBinding, HttpControllerBinding } from "@hexkit/shared";

export type HttpRepositoryBinding = {
  parameterName: string;
  repositoryName: string;
  repositoryFilePath: string;
};

export type { HttpAuthSchemeBinding };

export type HttpAuthenticatorBinding = {
  portName: "Authenticator";
  portFilePath: "src/core/ports/authenticator.ts";
  adapterFilePath: "src/adapters/auth/in-memory-authenticator.ts";
  adapterFactoryName: "createInMemoryAuthenticator";
};

export type HttpOperationBinding = HttpControllerBinding & {
  honoPath: string;
  authMiddlewareName?: string;
  usesBlobStore?: boolean;
};

export type HttpBlobStoreBinding = {
  portName: "BlobStore";
  portFilePath: "src/core/ports/blob-store.ts";
  adapterFilePath: "src/adapters/persistence/drizzle-blob-store.ts";
  adapterFactoryName: "createDrizzleBlobStore";
};

export type HttpArtifact = {
  artifactVersion: 1;
  controllersFilePath: string;
  routesFilePath: string;
  runtimeFilePath: string;
  createAppFactoryName: string;
  createHonoAppFactoryName: string;
  runtimeRepositoriesTypeName: string;
  repositories: readonly HttpRepositoryBinding[];
  operations: readonly HttpOperationBinding[];
  authenticator?: HttpAuthenticatorBinding;
  blobStore?: HttpBlobStoreBinding;
};

export const HTTP_ARTIFACT = createArtifactKey<HttpArtifact>("hono.http.v1");
