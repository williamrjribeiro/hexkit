import type { ImportDeclaration } from "@hexkit/codegen";
import { compareText, renderSourceFile, toKebabCase } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { DomainEntityModel } from "../model/derive.ts";
import { renderEnumUnion } from "../model/type-render.ts";

export function renderDomainFile(entity: DomainEntityModel): GeneratedFile {
  const imports: ImportDeclaration[] = entity.referencedSchemas
    .toSorted(compareText)
    .map((schema) => ({
      from: `./${toKebabCase(schema)}.ts`,
      names: [schema],
      typeOnly: true,
    }));

  const statements = [
    ...entity.enumAliases.map(
      (alias) => `export type ${alias.name} = ${renderEnumUnion(alias.values)};`,
    ),
    [
      `export type ${entity.exportName} = {`,
      ...entity.properties.map(
        (property) =>
          `  ${property.name}${property.required ? "" : "?"}: ${property.typeExpression};`,
      ),
      "};",
    ].join("\n"),
  ];

  return {
    path: entity.filePath,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}
