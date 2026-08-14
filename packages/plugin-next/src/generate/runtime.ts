import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile, toKebabCase, toPascalCase } from "@hexkit/codegen";
import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { NextHttpModel } from "../artifact.ts";
import { RUNTIME_FILE_PATH } from "../model/derive.ts";
import { relativeImportPath } from "../model/paths.ts";

export function renderRuntimeFile(
  model: NextHttpModel,
  application: ApplicationArtifact,
): GeneratedFile {
  const authenticator = model.authenticator;
  const hasAuth = authenticator !== undefined;
  const useCases = routeUseCases(model, application);
  const imports: ImportDeclaration[] = [
    ...useCases.map((useCase) => ({
      from: relativeImportPath(RUNTIME_FILE_PATH, useCase.filePath),
      names: [useCase.factoryName],
    })),
    ...model.repositories.map((repository) => ({
      from: relativeImportPath(RUNTIME_FILE_PATH, repository.filePath),
      names: [repository.name],
      typeOnly: true,
    })),
    ...model.repositories.map((repository) => ({
      from: relativeImportPath(
        RUNTIME_FILE_PATH,
        `src/adapters/db/${toKebabCase(repository.aggregate)}-repository.ts`,
      ),
      names: [`createDrizzle${toPascalCase(repository.aggregate)}Repository`],
    })),
    ...(hasAuth
      ? [
          {
            from: relativeImportPath(RUNTIME_FILE_PATH, "src/core/ports/authenticator.ts"),
            names: ["Authenticator"],
            typeOnly: true,
          },
          {
            from: relativeImportPath(RUNTIME_FILE_PATH, authenticator.adapterFilePath),
            names: [authenticator.adapterFactoryName],
          },
        ]
      : []),
    {
      from: relativeImportPath(RUNTIME_FILE_PATH, "src/adapters/db/database.ts"),
      names: ["getDatabase"],
    },
    {
      from: "./controllers.ts",
      names: ["createHttpControllers"],
    },
    {
      from: "./controllers.ts",
      names: ["HttpControllers"],
      typeOnly: true,
    },
  ];

  const repositoryFields = model.repositories
    .map((repository) => `  ${repository.parameterName}: ${repository.name};`)
    .join("\n");
  const drizzleBindings = model.repositories
    .map(
      (repository) =>
        `    ${repository.parameterName}: createDrizzle${toPascalCase(repository.aggregate)}Repository(db),`,
    )
    .join("\n");
  const controllerBindings = useCases
    .map(
      (useCase) =>
        `    ${useCase.operationId}: ${useCase.factoryName}(repositories.${useCase.repositoryParameterName}),`,
    )
    .join("\n");

  const statements = [
    ["export type RuntimeRepositories = {", repositoryFields, "};"].join("\n"),
    [
      "export type NextRuntime = {",
      "  controllers: HttpControllers;",
      "  repositories: RuntimeRepositories;",
      ...(hasAuth ? ["  authenticator: Authenticator;"] : []),
      "};",
    ].join("\n"),
    "let cachedRepositories: RuntimeRepositories | undefined;",
    "let cachedRuntime: NextRuntime | undefined;",
    [
      "function getRepositories(): RuntimeRepositories {",
      "  if (cachedRepositories === undefined) {",
      "    const db = getDatabase();",
      "    cachedRepositories = {",
      drizzleBindings,
      "    };",
      "  }",
      "  return cachedRepositories;",
      "}",
    ].join("\n"),
    ...(hasAuth
      ? [
          [
            "function createDefaultAuthenticator(): Authenticator {",
            "  return createInMemoryAuthenticator({",
            '    bearerTokens: new Set((process.env.AUTH_BEARER_TOKENS ?? "test-token").split(",")),',
            `    apiKeys: new Map(${renderApiKeyDefaults(model)}),`,
            "  });",
            "}",
          ].join("\n"),
        ]
      : []),
    [
      hasAuth
        ? "function composeRuntime(repositories: RuntimeRepositories, authenticator: Authenticator = createDefaultAuthenticator()): NextRuntime {"
        : "function composeRuntime(repositories: RuntimeRepositories): NextRuntime {",
      "  return {",
      hasAuth
        ? "    controllers: createHttpControllers({"
        : "    controllers: createHttpControllers({",
      controllerBindings,
      hasAuth ? "    }, authenticator)," : "    }),",
      "    repositories,",
      ...(hasAuth ? ["    authenticator,"] : []),
      "  };",
      "}",
    ].join("\n"),
    [
      "export function getRuntime(): NextRuntime {",
      "  if (cachedRuntime === undefined) {",
      "    cachedRuntime = composeRuntime(getRepositories());",
      "  }",
      "  return cachedRuntime;",
      "}",
    ].join("\n"),
  ];

  return {
    path: RUNTIME_FILE_PATH,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}

function routeUseCases(
  model: NextHttpModel,
  application: ApplicationArtifact,
): ApplicationArtifact["useCases"] {
  const routeOperationIds = new Set<string>();
  for (const route of model.routes) {
    for (const method of route.methods) {
      routeOperationIds.add(method.operationId);
    }
  }

  return application.useCases
    .filter((useCase) => routeOperationIds.has(useCase.operationId))
    .toSorted((left, right) => compareText(left.operationId, right.operationId));
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function renderApiKeyDefaults(model: NextHttpModel): string {
  const apiKeyHeaderNames = unique(
    model.routes.flatMap((route) =>
      route.methods.flatMap((method) =>
        method.authSchemes.flatMap((scheme) =>
          scheme.type === "apiKey" ? [scheme.headerName.toLowerCase()] : [],
        ),
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
