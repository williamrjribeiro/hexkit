import type { ImportDeclaration } from "@hexkit/codegen";
import { compareText, renderSourceFile, toKebabCase, toPascalCase } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";
import type {
  ApplicationArtifact,
  ApplicationUseCase,
} from "@hexkit/plugin-architecture-hexagonal";

import type { NextHttpModel } from "../artifact.ts";
import { SERVER_ACCESS_FILE_PATH } from "../model/derive.ts";
import { relativeImportPath } from "../model/paths.ts";

const RSC_PRINCIPAL = '{ id: "rsc", scheme: "in-process", scopes: [] }';

export function renderServerAccessFile(
  model: NextHttpModel,
  application: ApplicationArtifact,
): GeneratedFile {
  const useCases = [...application.useCases].toSorted((left, right) =>
    compareText(left.operationId, right.operationId),
  );
  const hasSecuredUseCases = useCases.some((useCase) => useCase.requiresAuth);

  const imports: ImportDeclaration[] = [
    ...useCases.map((useCase) => ({
      from: relativeImportPath(SERVER_ACCESS_FILE_PATH, useCase.filePath),
      names: useCase.requiresAuth ? [useCase.factoryName] : [useCase.factoryName, useCase.typeName],
    })),
    ...(hasSecuredUseCases
      ? [
          {
            from: relativeImportPath(SERVER_ACCESS_FILE_PATH, "src/core/domain/auth-principal.ts"),
            names: ["Principal"],
            typeOnly: true,
          },
        ]
      : []),
    ...collectSecuredDomainTypeImports(useCases, application.entities),
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
  const accessFields = useCases.map((useCase) => `  ${renderAccessField(useCase)}`).join("\n");
  const repositoryBindings = useCases
    .map((useCase) => `    ${renderAccessBinding(useCase)},`)
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
    ...(hasSecuredUseCases ? [`const rscPrincipal: Principal = ${RSC_PRINCIPAL};`] : []),
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

function collectSecuredDomainTypeImports(
  useCases: readonly ApplicationUseCase[],
  entities: ApplicationArtifact["entities"],
): ImportDeclaration[] {
  const needed = new Set<string>();
  for (const useCase of useCases) {
    if (!useCase.requiresAuth) continue;
    const expressions = [
      useCase.returnTypeExpression,
      ...useCase.parameters.map((parameter) => parameter.typeExpression),
    ];
    for (const entity of entities) {
      if (expressions.some((expression) => new RegExp(`\\b${entity.name}\\b`).test(expression))) {
        needed.add(entity.name);
      }
    }
  }

  return [...needed].toSorted(compareText).flatMap((name) => {
    const entity = entities.find((candidate) => candidate.name === name);
    if (entity === undefined) return [];
    return [
      {
        from: relativeImportPath(SERVER_ACCESS_FILE_PATH, entity.filePath),
        names: [entity.exportName],
        typeOnly: true,
      },
    ];
  });
}

function renderAccessField(useCase: ApplicationUseCase): string {
  if (!useCase.requiresAuth) {
    return `${useCase.operationId}: ${useCase.typeName};`;
  }

  const parameters = useCase.parameters
    .map((parameter) => `${parameter.name}: ${parameter.typeExpression}`)
    .join(", ");
  return `${useCase.operationId}: (${parameters}) => Promise<${useCase.returnTypeExpression}>;`;
}

function renderAccessBinding(useCase: ApplicationUseCase): string {
  const factoryCall = `${useCase.factoryName}(repositories.${useCase.repositoryParameterName})`;
  if (!useCase.requiresAuth) {
    return `${useCase.operationId}: ${factoryCall}`;
  }

  const argNames = useCase.parameters.map((parameter) => parameter.name);
  const wrapperArgs = argNames.join(", ");
  const callArgs = ["rscPrincipal", ...argNames].join(", ");
  return `${useCase.operationId}: (${wrapperArgs}) => ${factoryCall}(${callArgs})`;
}
