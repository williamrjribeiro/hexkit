import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile, toKebabCase, toPascalCase } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";
import type { ApplicationArtifact } from "@hexkit/plugin-architecture-hexagonal";

import type { NextHttpModel } from "../artifact.ts";
import { SERVER_ACCESS_FILE_PATH } from "../model/derive.ts";
import { relativeImportPath } from "../model/paths.ts";

export function renderServerAccessFile(
  model: NextHttpModel,
  application: ApplicationArtifact,
): GeneratedFile {
  const useCases = [...application.useCases].toSorted((left, right) =>
    compareText(left.operationId, right.operationId),
  );

  const imports: ImportDeclaration[] = [
    ...useCases.map((useCase) => ({
      from: relativeImportPath(SERVER_ACCESS_FILE_PATH, useCase.filePath),
      names: [useCase.factoryName, useCase.typeName],
    })),
    ...model.repositories.map((repository) => ({
      from: relativeImportPath(SERVER_ACCESS_FILE_PATH, repository.filePath),
      names: [repository.name],
      typeOnly: true,
    })),
    ...model.repositories.map((repository) => ({
      from: relativeImportPath(
        SERVER_ACCESS_FILE_PATH,
        `src/adapters/db/${toKebabCase(repository.aggregate)}-repository.ts`,
      ),
      names: [`createDrizzle${toPascalCase(repository.aggregate)}Repository`],
    })),
    {
      from: relativeImportPath(SERVER_ACCESS_FILE_PATH, "src/adapters/db/database.ts"),
      names: ["getDatabase"],
    },
  ];

  const repositoryFields = model.repositories
    .map((repository) => `  ${repository.parameterName}: ${repository.name};`)
    .join("\n");
  const accessFields = useCases
    .map((useCase) => `  ${useCase.operationId}: ${useCase.typeName};`)
    .join("\n");
  const repositoryBindings = useCases
    .map(
      (useCase) =>
        `    ${useCase.operationId}: ${useCase.factoryName}(repositories.${useCase.repositoryParameterName}),`,
    )
    .join("\n");
  const drizzleBindings = model.repositories
    .map(
      (repository) =>
        `    ${repository.parameterName}: createDrizzle${toPascalCase(repository.aggregate)}Repository(db),`,
    )
    .join("\n");

  const statements = [
    ["export type RuntimeRepositories = {", repositoryFields, "};"].join("\n"),
    ["export type ServerAccess = {", accessFields, "};"].join("\n"),
    "let cachedRepositories: RuntimeRepositories | undefined;",
    "let cachedAccess: ServerAccess | undefined;",
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
    [
      "function composeServerAccess(repositories: RuntimeRepositories): ServerAccess {",
      "  return {",
      repositoryBindings,
      "  };",
      "}",
    ].join("\n"),
    [
      "export function getServerAccess(): ServerAccess {",
      "  if (cachedAccess === undefined) {",
      "    cachedAccess = composeServerAccess(getRepositories());",
      "  }",
      "  return cachedAccess;",
      "}",
    ].join("\n"),
  ];

  return {
    path: SERVER_ACCESS_FILE_PATH,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
