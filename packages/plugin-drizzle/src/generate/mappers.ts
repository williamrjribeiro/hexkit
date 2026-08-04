import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile, toKebabCase } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import {
  mapperFunctionName,
  type PersistenceModel,
  type PersistenceTableModel,
} from "../model/derive.ts";

export function renderMapperFile(model: PersistenceModel): GeneratedFile {
  const tables = model.tables.toSorted((left, right) =>
    compareText(left.schemaName, right.schemaName),
  );

  const imports: ImportDeclaration[] = [
    ...tables.map((table) => ({
      from: `../../core/domain/${toKebabCase(table.schemaName)}.ts`,
      names: [table.schemaName],
      typeOnly: true,
    })),
    ...tables.map((table) => ({
      from: `../../generated/contracts/${table.apicalModulePath}`,
      names: [`${table.schemaName} as ${table.schemaName}Schema`],
    })),
    {
      from: "./schema.ts",
      names: tables.map((table) => table.exportName),
      typeOnly: true,
    },
  ];

  const statements = [
    tables
      .map((table) => `type ${table.schemaName}Row = typeof ${table.exportName}.$inferSelect;`)
      .join("\n"),
    ...tables.map(renderMapperFunction),
  ];

  return {
    path: model.mapperFilePath,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}

function renderMapperFunction(table: PersistenceTableModel): string {
  const optionalNullables = table.columns.filter((column) => !column.required);
  const parseArgument =
    optionalNullables.length === 0
      ? "row"
      : `{ ...row, ${optionalNullables
          .map((column) => `${column.propertyName}: row.${column.propertyName} ?? undefined`)
          .join(", ")} }`;

  return [
    `export function ${mapperFunctionName(table.schemaName)}(row: ${table.schemaName}Row): ${table.schemaName} {`,
    `  return ${table.schemaName}Schema.parse(${parseArgument});`,
    "}",
  ].join("\n");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
