import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { HttpModel } from "../model/derive.ts";
import { ROUTES_FILE_PATH, RUNTIME_FILE_PATH } from "../model/derive.ts";
import { relativeImportPath } from "../model/paths.ts";

export function renderRuntimeFile(model: HttpModel): GeneratedFile {
  const hasAuth = model.authenticator !== undefined;
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
        `    ${operation.operationId}: ${operation.useCaseFactoryName}(repositories.${operation.repositoryParameterName}),`,
    )
    .join("\n");

  const statements = [
    ["export type RuntimeRepositories = {", repositoryFields, "};"].join("\n"),
    [
      hasAuth
        ? "export function createApp(repositories: RuntimeRepositories, authenticator: Authenticator = createInMemoryAuthenticator({"
        : "export function createApp(repositories: RuntimeRepositories) {",
      ...(hasAuth
        ? [
            '  bearerTokens: new Set((process.env.AUTH_BEARER_TOKENS ?? "test-token").split(",")),',
            `  apiKeys: new Map(${renderApiKeyDefaults(model)}),`,
            "})) {",
          ]
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

function renderApiKeyDefaults(model: HttpModel): string {
  const apiKeyHeaderNames = unique(
    model.operations.flatMap((operation) =>
      operation.authSchemes.flatMap((scheme) =>
        scheme.type === "apiKey" ? [scheme.headerName.toLowerCase()] : [],
      ),
    ),
  );

  if (apiKeyHeaderNames.length === 0) return "[]";

  const entries = apiKeyHeaderNames.map(
    (headerName) =>
      `[${JSON.stringify(headerName)}, new Set((process.env.AUTH_API_KEYS ?? "test-key").split(","))]`,
  );

  return `[${entries.join(", ")}]`;
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
