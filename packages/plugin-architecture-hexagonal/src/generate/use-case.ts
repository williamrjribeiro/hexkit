import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile, toKebabCase } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { UseCaseModel } from "../model/derive.ts";

export function renderUseCaseFile(useCase: UseCaseModel): GeneratedFile {
  const imports: ImportDeclaration[] = [
    ...useCase.referencedSchemas.toSorted(compareText).map((schema) => ({
      from: `../domain/${toKebabCase(schema)}.ts`,
      names: [schema],
      typeOnly: true,
    })),
    {
      from: `../ports/${toKebabCase(useCase.aggregate)}-repository.ts`,
      names: [useCase.repositoryName],
      typeOnly: true,
    },
  ];

  const parameterList = useCase.parameters
    .map((parameter) => `${parameter.name}: ${parameter.typeExpression}`)
    .join(", ");
  const argumentList = useCase.parameters.map((parameter) => parameter.name).join(", ");
  const statements = [
    `export type ${useCase.typeName} = (${parameterList}) => Promise<${useCase.returnTypeExpression}>;`,
    [
      `export function ${useCase.factoryName}(${useCase.repositoryParameterName}: ${useCase.repositoryName}): ${useCase.typeName} {`,
      `  return (${argumentList}) => ${useCase.repositoryParameterName}.${useCase.methodName}(${argumentList});`,
      "}",
    ].join("\n"),
  ];

  return {
    path: useCase.filePath,
    contents: renderSourceFile({ imports, statements }),
    ownership: "protected",
  };
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
