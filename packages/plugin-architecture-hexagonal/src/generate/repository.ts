import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile, toKebabCase } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { RepositoryModel } from "../model/derive.ts";

export function renderRepositoryFile(repository: RepositoryModel): GeneratedFile {
  const referencedSchemas = unique(
    repository.methods.flatMap((method) => method.referencedSchemas),
  ).toSorted(compareText);

  const imports: ImportDeclaration[] = referencedSchemas.map((schema) => ({
    from: `../domain/${toKebabCase(schema)}.ts`,
    names: [schema],
    typeOnly: true,
  }));

  const methods = repository.methods.map((method) => {
    const parameters = method.parameters
      .map((parameter) => `${parameter.name}: ${parameter.typeExpression}`)
      .join(", ");
    return `  ${method.name}(${parameters}): Promise<${method.returnTypeExpression}>;`;
  });

  const statements = [[`export interface ${repository.name} {`, ...methods, "}"].join("\n")];

  return {
    path: repository.filePath,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
