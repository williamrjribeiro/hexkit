import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";
import { renderApiKeyDefaultsMapLiteral } from "@hexkit/shared";

import type { HttpModel } from "../model/derive.ts";
import { ROUTES_FILE_PATH, RUNTIME_FILE_PATH } from "../model/derive.ts";
import { relativeImportPath } from "../model/paths.ts";

export function renderRuntimeFile(model: HttpModel): GeneratedFile {
  const hasAuth = model.authenticator !== undefined;
  const hasBlobStore = model.blobStore !== undefined;
  const imports: ImportDeclaration[] = [
    ...model.operations.map((operation) => ({
      from: relativeImportPath(RUNTIME_FILE_PATH, operation.useCaseFilePath),
      names: [operation.useCaseFactoryName],
    })),
    ...(model.authenticator === undefined
      ? []
      : [
          {
            from: relativeImportPath(RUNTIME_FILE_PATH, model.authenticator.portFilePath),
            names: [model.authenticator.portName],
            typeOnly: true,
          },
          {
            from: relativeImportPath(RUNTIME_FILE_PATH, model.authenticator.adapterFilePath),
            names: [model.authenticator.adapterFactoryName],
          },
        ]),
    ...(model.blobStore === undefined
      ? []
      : [
          {
            from: relativeImportPath(RUNTIME_FILE_PATH, model.blobStore.portFilePath),
            names: [model.blobStore.portName],
            typeOnly: true,
          },
          {
            from: relativeImportPath(RUNTIME_FILE_PATH, model.blobStore.adapterFilePath),
            names: [model.blobStore.adapterFactoryName],
          },
          { from: "drizzle-orm/node-postgres", names: ["drizzle"] },
          { from: "pg", names: ["Pool"] },
        ]),
    ...model.repositories.map((repository) => ({
      from: relativeImportPath(RUNTIME_FILE_PATH, repository.repositoryFilePath),
      names: [repository.repositoryName],
      typeOnly: true,
    })),
    {
      from: relativeImportPath(RUNTIME_FILE_PATH, ROUTES_FILE_PATH),
      names: ["createHonoApp"],
    },
  ];

  const repositoryFields = model.repositories
    .map((repository) => `  ${repository.parameterName}: ${repository.repositoryName};`)
    .join("\n");

  const bindings = model.operations
    .map(
      (operation) =>
        `    ${operation.operationId}: ${operation.useCaseFactoryName}(${operation.usesBlobStore ? "blobStore, " : ""}repositories.${operation.repositoryParameterName}),`,
    )
    .join("\n");

  const statements = [
    ["export type RuntimeRepositories = {", repositoryFields, "};"].join("\n"),
    ...(hasBlobStore
      ? [
          [
            "function createDefaultBlobStore(): BlobStore {",
            "  const connectionString = process.env.DATABASE_URL;",
            '  if (!connectionString) throw new Error("DATABASE_URL is required");',
            "  const db = drizzle(new Pool({ connectionString }));",
            "  return createDrizzleBlobStore(db);",
            "}",
          ].join("\n"),
        ]
      : []),
    [
      renderCreateAppStart({ hasAuth, hasBlobStore }),
      ...(hasAuth
        ? [
            '  bearerTokens: new Set((process.env.AUTH_BEARER_TOKENS ?? "test-token").split(",")),',
            `  apiKeys: new Map(${renderApiKeyDefaultsMapLiteral(model.operations.flatMap((operation) => operation.authSchemes))}),`,
            hasBlobStore ? "})," : "})) {",
          ]
        : hasBlobStore
          ? ["  blobStore: BlobStore = createDefaultBlobStore(),", ") {"]
          : []),
      ...(hasAuth && hasBlobStore
        ? ["  blobStore: BlobStore = createDefaultBlobStore(),", ") {"]
        : []),
      "  return createHonoApp({",
      bindings,
      hasAuth ? "  }, authenticator);" : "  });",
      "}",
    ].join("\n"),
  ];

  return {
    path: RUNTIME_FILE_PATH,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}

function renderCreateAppStart(options: { hasAuth: boolean; hasBlobStore: boolean }): string {
  if (options.hasAuth) {
    return "export function createApp(repositories: RuntimeRepositories, authenticator: Authenticator = createInMemoryAuthenticator({";
  }
  if (options.hasBlobStore) {
    return "export function createApp(repositories: RuntimeRepositories,";
  }
  return "export function createApp(repositories: RuntimeRepositories) {";
}
