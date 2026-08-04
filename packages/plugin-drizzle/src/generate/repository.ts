import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile, toKebabCase } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import {
  mapperFunctionName,
  type PersistenceModel,
  type PersistenceRepositoryMethodModel,
  type PersistenceRepositoryModel,
} from "../model/derive.ts";

export function renderRepositoryFiles(model: PersistenceModel): GeneratedFile[] {
  return model.repositories.map((repository) => renderRepositoryFile(repository));
}

function renderRepositoryFile(repository: PersistenceRepositoryModel): GeneratedFile {
  const table = repository.table;
  const entityParameter = entityParameterName(repository);
  const needsEq = repository.methods.some(
    (method) => method.kind === "update" || method.kind === "select" || method.kind === "delete",
  );

  const imports: ImportDeclaration[] = [
    ...(needsEq ? [{ from: "drizzle-orm", names: ["eq"] }] : []),
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

  const methods = repository.methods.map((method) =>
    renderMethod(repository, method, entityParameter),
  );

  const statements = [
    [
      `export function ${repository.factoryName}(`,
      "  db: NodePgDatabase,",
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
  entityParameter: string,
): string {
  const table = repository.table;
  const mapper = mapperFunctionName(table.schemaName);
  const signatureParameters = method.parameters
    .map((parameter) => `${parameter.name}: ${parameter.typeExpression}`)
    .join(", ");

  switch (method.kind) {
    case "insert": {
      const parameter = method.parameters[0]?.name ?? entityParameter;
      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        `      const [row] = await db.insert(${table.exportName}).values(${parameter}).returning();`,
        `      if (!row) throw new Error("Drizzle did not return the inserted ${table.schemaName.toLowerCase()}");`,
        `      return ${mapper}(row);`,
        "    }",
      ].join("\n");
    }
    case "update": {
      const parameter = method.parameters[0]?.name ?? entityParameter;
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
      const idParameter = method.parameters[0]?.name ?? table.identityPropertyName;
      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        `      const [row] = await db.select().from(${table.exportName}).where(eq(${table.exportName}.${table.identityPropertyName}, ${idParameter})).limit(1);`,
        `      return row ? ${mapper}(row) : undefined;`,
        "    }",
      ].join("\n");
    }
    case "delete": {
      const idParameter = method.parameters[0]?.name ?? table.identityPropertyName;
      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        `      await db.delete(${table.exportName}).where(eq(${table.exportName}.${table.identityPropertyName}, ${idParameter}));`,
        "    }",
      ].join("\n");
    }
  }
}

function entityParameterName(repository: PersistenceRepositoryModel): string {
  return (
    repository.methods.find((method) => method.kind === "insert" || method.kind === "update")
      ?.parameters[0]?.name ?? repository.table.schemaName.toLowerCase()
  );
}
