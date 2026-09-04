import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile, toKebabCase } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import type { PersistenceModel } from "../model/derive.ts";
import type {
  PersistenceRepositoryMethodModel,
  PersistenceRepositoryModel,
} from "../model/repository.ts";
import { findListFilterColumn, renderFilteredListMethodBody } from "./list-filter.ts";
import {
  assertValidFieldPatchUpdate,
  isFieldPatchUpdate,
  isLocatedUpdate,
  renderFieldPatchUpdateMethod,
} from "./field-patch.ts";
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
      const entityType =
        method.parameters.find((entry) => entry.name === parameter)?.typeExpression ?? "";
      if (entityType.startsWith("Array<")) {
        return [
          `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
          `      const rows = await db.insert(${table.exportName}).values(${parameter}).returning();`,
          ...(compactType(method.returnTypeExpression).startsWith("Array<")
            ? [`      return rows.map(${mapper});`]
            : [
                "      const [row] = rows;",
                `      if (!row) throw new Error("Drizzle did not return the inserted ${table.schemaName.toLowerCase()}");`,
                `      return ${mapper}(row);`,
              ]),
          "    }",
        ].join("\n");
      }
      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        `      const [row] = await db.insert(${table.exportName}).values(${parameter}).returning();`,
        `      if (!row) throw new Error("Drizzle did not return the inserted ${table.schemaName.toLowerCase()}");`,
        `      return ${mapper}(row);`,
        "    }",
      ].join("\n");
    }
    case "update": {
      if (isFieldPatchUpdate(method)) {
        return renderFieldPatchUpdateMethod(repository, method);
      }
      if (isLocatedUpdate(method)) {
        assertValidFieldPatchUpdate(method);
      }
      const parameter = method.entityParameterName;
      const setFields = table.columns
        .filter((column) => !column.isIdentity)
        .map((column) => `${column.propertyName}: ${parameter}.${column.propertyName}`)
        .join(", ");
      const pathKeyed = isPathKeyedEntityUpdate(method);
      const whereValue = pathKeyed
        ? method.identityParameterName
        : `${parameter}.${table.identityPropertyName}`;
      const whereColumn = pathKeyed ? method.lookupColumnName : table.identityPropertyName;
      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        "      const [row] = await db",
        `        .update(${table.exportName})`,
        `        .set({ ${setFields} })`,
        `        .where(eq(${table.exportName}.${whereColumn}, ${whereValue}))`,
        "        .returning();",
        ...renderMutationResult(method, table.schemaName, mapper, whereValue),
        "    }",
      ].join("\n");
    }
    case "select": {
      const idParameter = method.identityParameterName;
      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        `      const [row] = await db.select().from(${table.exportName}).where(eq(${table.exportName}.${method.lookupColumnName}, ${idParameter})).limit(1);`,
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
        renderStubReturn(method),
        "    }",
      ].join("\n");
    }
    case "delete": {
      const idParameter = method.identityParameterName;
      const where = `eq(${table.exportName}.${method.lookupColumnName}, ${idParameter})`;
      if (compactType(method.returnTypeExpression) === "boolean") {
        return [
          `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
          `      const [row] = await db.delete(${table.exportName}).where(${where}).returning();`,
          "      return row !== undefined;",
          "    }",
        ].join("\n");
      }
      return [
        `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
        `      await db.delete(${table.exportName}).where(${where});`,
        "    }",
      ].join("\n");
    }
  }
}

function isPathKeyedEntityUpdate(method: PersistenceRepositoryMethodModel): boolean {
  return (
    method.kind === "update" &&
    method.parameters.some((parameter) => parameter.location === "path") &&
    method.parameters.some((parameter) => parameter.location === undefined)
  );
}

function renderMutationResult(
  method: PersistenceRepositoryMethodModel,
  schemaName: string,
  mapper: string,
  missingKeyExpression: string,
): string[] {
  const compact = compactType(method.returnTypeExpression);
  if (compact === "boolean") {
    return ["      return row !== undefined;"];
  }
  if (compact === "void") {
    return [];
  }
  if (compact.includes("|undefined") || compact.includes("undefined|")) {
    return [`      return row ? ${mapper}(row) : undefined;`];
  }
  return [
    `      if (!row) throw new Error(\`${schemaName} \${${missingKeyExpression}} was not found\`);`,
    `      return ${mapper}(row);`,
  ];
}

function renderStubReturn(method: PersistenceRepositoryMethodModel): string {
  const headers = method.successHeaders ?? [];
  if (headers.length > 0) {
    const headerFields = headers
      .map((header) => `${JSON.stringify(header.name)}: ${stubLiteral(header.typeExpression)}`)
      .join(", ");
    const dataType = envelopeDataType(method.returnTypeExpression);
    return `      return { data: ${stubLiteral(dataType)}, headers: { ${headerFields} } };`;
  }
  return `      ${renderBareStubReturn(method.returnTypeExpression)}`;
}

function renderBareStubReturn(returnTypeExpression: string): string {
  const compact = compactType(returnTypeExpression);
  if (compact === "void") return "return;";
  if (compact === "string") return 'return "";';
  if (compact === "number") return "return 0;";
  if (compact === "boolean") return "return false;";
  return "return { ok: true };";
}

function stubLiteral(typeExpression: string): string {
  const compact = compactType(typeExpression);
  if (compact === "number") return "0";
  if (compact === "boolean") return "false";
  if (compact === "string") return '""';
  return "{ ok: true }";
}

function envelopeDataType(returnTypeExpression: string): string {
  const match = /\{ data: ([^;]+);/.exec(returnTypeExpression);
  return match?.[1]?.trim() ?? "string";
}

function compactType(returnTypeExpression: string): string {
  return returnTypeExpression.replaceAll(/\s+/g, "");
}
