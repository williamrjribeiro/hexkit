import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile, toKebabCase } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { PersistenceModel } from "../model/derive.ts";
import type {
  PersistenceRepositoryMethodModel,
  PersistenceRepositoryModel,
} from "../model/repository.ts";
import { findListFilterColumn, renderFilteredListMethodBody } from "./list-filter.ts";
import { mapperFunctionName } from "../model/table.ts";

export function renderRepositoryFiles(model: PersistenceModel): GeneratedFile[] {
  return model.repositories.map((repository) => renderRepositoryFile(repository));
}

function renderRepositoryFile(repository: PersistenceRepositoryModel): GeneratedFile {
  const table = repository.table;
  const needsEq = repository.methods.some(
    (method) => method.kind === "update" || method.kind === "select" || method.kind === "delete",
  );
  const needsInArray = repository.methods.some((method) => {
    if (method.kind !== "list" || method.parameters.length === 0) return false;
    const column = findListFilterColumn(table.columns, method.parameters[0]?.name ?? "");
    return column !== undefined && column.sqlType !== "jsonb";
  });

  const drizzleNames = [
    ...(needsEq ? (["eq"] as const) : []),
    ...(needsInArray ? (["inArray"] as const) : []),
  ];
  const imports: ImportDeclaration[] = [
    ...(drizzleNames.length > 0 ? [{ from: "drizzle-orm", names: [...drizzleNames] }] : []),
    {
      from: "drizzle-orm/node-postgres",
      names: ["NodePgDatabase"],
      typeOnly: true,
    },
    {
      from: `../../core/domain/${toKebabCase(table.schemaName)}.ts`,
      names: [table.schemaName],
      typeOnly: true,
    },
    {
      from: `../../core/ports/${toKebabCase(repository.aggregate)}-repository.ts`,
      names: [repository.portName],
      typeOnly: true,
    },
    {
      from: "./mappers.ts",
      names: [mapperFunctionName(table.schemaName)],
    },
    {
      from: "./schema.ts",
      names: [table.exportName],
    },
  ];

  const methods = repository.methods.map((method) => renderMethod(repository, method));

  const statements = [
    [
      `export function ${repository.factoryName}(`,
      "  db: NodePgDatabase<Record<string, unknown>>,",
      `): ${repository.portName} {`,
      "  return {",
      `${methods.join(",\n")},`,
      "  };",
      "}",
    ].join("\n"),
  ];

  return {
    path: repository.filePath,
    contents: renderSourceFile({ imports, statements }),
    ownership: "generated",
  };
}

function renderMethod(
  repository: PersistenceRepositoryModel,
  method: PersistenceRepositoryMethodModel,
): string {
  const table = repository.table;
  const mapper = mapperFunctionName(table.schemaName);
  const signatureParameters = method.parameters
    .map((parameter) => `${parameter.name}: ${parameter.typeExpression}`)
    .join(", ");

  switch (method.kind) {
    case "insert": {
      const parameter = method.entityParameterName;
      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        `      const [row] = await db.insert(${table.exportName}).values(${parameter}).returning();`,
        `      if (!row) throw new Error("Drizzle did not return the inserted ${table.schemaName.toLowerCase()}");`,
        `      return ${mapper}(row);`,
        "    }",
      ].join("\n");
    }
    case "update": {
      const parameter = method.entityParameterName;
      const setFields = table.columns
        .filter((column) => !column.isIdentity)
        .map((column) => `${column.propertyName}: ${parameter}.${column.propertyName}`)
        .join(", ");
      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        "      const [row] = await db",
        `        .update(${table.exportName})`,
        `        .set({ ${setFields} })`,
        `        .where(eq(${table.exportName}.${table.identityPropertyName}, ${parameter}.${table.identityPropertyName}))`,
        "        .returning();",
        `      if (!row) throw new Error(\`${table.schemaName} \${${parameter}.${table.identityPropertyName}} was not found\`);`,
        `      return ${mapper}(row);`,
        "    }",
      ].join("\n");
    }
    case "select": {
      const idParameter = method.identityParameterName;
      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        `      const [row] = await db.select().from(${table.exportName}).where(eq(${table.exportName}.${table.identityPropertyName}, ${idParameter})).limit(1);`,
        `      return row ? ${mapper}(row) : undefined;`,
        "    }",
      ].join("\n");
    }
    case "list": {
      if (method.parameters.length > 0) {
        return renderFilteredListMethodBody(repository, method).bodyLines.join("\n");
      }

      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        `      const rows = await db.select().from(${table.exportName});`,
        `      return rows.map(${mapper});`,
        "    }",
      ].join("\n");
    }
    case "stub": {
      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        "      return { ok: true };",
        "    }",
      ].join("\n");
    }
    case "delete": {
      const idParameter = method.identityParameterName;
      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        `      await db.delete(${table.exportName}).where(eq(${table.exportName}.${table.identityPropertyName}, ${idParameter}));`,
        "    }",
      ].join("\n");
    }
  }
}
