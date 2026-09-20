import type { ImportDeclaration } from "@hexkit/codegen";
import { compareText, renderSourceFile, toKebabCase } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { UseCaseModel } from "../model/derive.ts";

export function renderUseCaseFile(useCase: UseCaseModel): GeneratedFile {
  const imports: ImportDeclaration[] = [
    ...useCase.referencedSchemas.toSorted(compareText).map((schema) => ({
      from: `../domain/${toKebabCase(schema)}.ts`,
      names: [schema],
      typeOnly: true,
    })),
    ...(useCase.requiresAuth
      ? [
          {
            from: "../domain/auth-principal.ts",
            names: ["Principal"],
            typeOnly: true,
          },
        ]
      : []),
    ...(useCase.usesBlobStore
      ? [
          {
            from: "../ports/blob-store.ts",
            names: ["BlobStore"],
            typeOnly: true,
          },
        ]
      : []),
    {
      from: `../ports/${toKebabCase(useCase.aggregate)}-repository.ts`,
      names: [useCase.repositoryName],
      typeOnly: true,
    },
  ];

  const typeParameters = [
    ...(useCase.requiresAuth ? ["principal: Principal"] : []),
    ...useCase.parameters.map((parameter) => `${parameter.name}: ${parameter.typeExpression}`),
  ];
  const parameterList = typeParameters.join(", ");
  const factoryParameters = [
    ...(useCase.requiresAuth ? ["principal"] : []),
    ...useCase.parameters.map((parameter) => parameter.name),
  ];
  const argumentList = useCase.parameters.map((parameter) => parameter.name).join(", ");
  const factory = useCase.usesBlobStore
    ? renderBlobStoreFactory(useCase, factoryParameters)
    : [
        `export function ${useCase.factoryName}(${useCase.repositoryParameterName}: ${useCase.repositoryName}): ${useCase.typeName} {`,
        `  return (${factoryParameters.join(", ")}) => ${useCase.repositoryParameterName}.${useCase.methodName}(${argumentList});`,
        "}",
      ].join("\n");
  const statements = [
    `export type ${useCase.typeName} = (${parameterList}) => Promise<${useCase.returnTypeExpression}>;`,
    factory,
  ];

  return {
    path: useCase.filePath,
    contents: renderSourceFile({ imports, statements }),
    ownership: "protected",
  };
}

function renderBlobStoreFactory(
  useCase: UseCaseModel,
  factoryParameters: readonly string[],
): string {
  const pathArguments = useCase.parameters
    .filter((parameter) => parameter.location === "path")
    .map((parameter) => parameter.name);
  const queryArguments = useCase.parameters
    .filter((parameter) => parameter.location === "query")
    .map((parameter) => parameter.name);
  const contentTypeParameter = useCase.parameters.find(
    (parameter) => parameter.location === "contentType",
  );
  const bodyParameter = useCase.parameters.find((parameter) => parameter.location === "body");
  if (contentTypeParameter === undefined) {
    throw new Error(
      `BlobStore use case "${useCase.operationId}" is missing its content type parameter.`,
    );
  }
  if (bodyParameter === undefined) {
    throw new Error(
      `BlobStore use case "${useCase.operationId}" is missing its binary body parameter.`,
    );
  }
  const repositoryArguments = [...pathArguments, "key", ...queryArguments].join(", ");
  const messageExpression = queryArguments.includes("additionalMetadata")
    ? 'additionalMetadata ?? ""'
    : '""';

  return [
    `export function ${useCase.factoryName}(`,
    "  blobs: BlobStore,",
    `  ${useCase.repositoryParameterName}: ${useCase.repositoryName},`,
    `): ${useCase.typeName} {`,
    `  return async (${factoryParameters.join(", ")}) => {`,
    `    void ${contentTypeParameter.name};`,
    `    const { key } = await blobs.put(${bodyParameter.name});`,
    `    const saved = await ${useCase.repositoryParameterName}.${useCase.methodName}(${repositoryArguments});`,
    "    if (saved === undefined) return undefined;",
    `    return { code: 200, type: "unknown", message: ${messageExpression} };`,
    "  };",
    "}",
  ].join("\n");
}
