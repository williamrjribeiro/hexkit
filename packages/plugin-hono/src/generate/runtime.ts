import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { HttpModel } from "../model/derive.ts";
import { ROUTES_FILE_PATH, RUNTIME_FILE_PATH } from "../model/derive.ts";
import { relativeImportPath } from "../model/paths.ts";

export function renderRuntimeFile(model: HttpModel): GeneratedFile {
  const imports: ImportDeclaration[] = [
    ...model.operations.map((operation) => ({
      from: relativeImportPath(RUNTIME_FILE_PATH, operation.useCaseFilePath),
      names: [operation.useCaseFactoryName],
    })),
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
      "export function createApp(repositories: RuntimeRepositories) {",
      "  return createHonoApp({",
      bindings,
      "  });",
      "}",
    ].join("\n"),
  ];

  return {
    path: RUNTIME_FILE_PATH,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}
