import type {
  PersistenceRepositoryMethodModel,
  PersistenceRepositoryModel,
} from "../model/repository.ts";
import { mapperFunctionName } from "../model/table.ts";

export function isFieldPatchUpdate(method: PersistenceRepositoryMethodModel): boolean {
  if (method.kind !== "update") return false;
  const pathParams = method.parameters.filter((parameter) => parameter.location === "path");
  const queryParams = method.parameters.filter((parameter) => parameter.location === "query");
  return (
    pathParams.length === 1 &&
    queryParams.length >= 0 &&
    method.parameters.every(
      (parameter) => parameter.location === "path" || parameter.location === "query",
    )
  );
}

export function renderFieldPatchUpdateMethod(
  repository: PersistenceRepositoryModel,
  method: PersistenceRepositoryMethodModel,
): string {
  const table = repository.table;
  const mapper = mapperFunctionName(table.schemaName);
  const pathParameter = method.parameters.find((parameter) => parameter.location === "path");
  if (pathParameter === undefined) {
    throw new Error(
      `Field-patch update "${method.operationId}" requires exactly one path parameter.`,
    );
  }

  const queryParameters = method.parameters.filter((parameter) => parameter.location === "query");
  const patchFields: { name: string; typeExpression: string }[] = [];

  for (const parameter of queryParameters) {
    const column = table.columns.find(
      (entry) => entry.propertyName === parameter.name && !entry.isIdentity,
    );
    if (column === undefined) {
      throw new Error(
        `Update operation "${method.operationId}" parameter "${parameter.name}" has no matching persisted column on ${table.schemaName}.`,
      );
    }
    patchFields.push({
      name: parameter.name,
      typeExpression: stripUndefined(parameter.typeExpression),
    });
  }

  const signatureParameters = method.parameters
    .map((parameter) => `${parameter.name}: ${parameter.typeExpression}`)
    .join(", ");

  const patchType =
    patchFields.length === 0
      ? "Record<string, never>"
      : `{ ${patchFields.map((field) => `${field.name}?: ${field.typeExpression}`).join("; ")} }`;

  const assignLines = patchFields.map(
    (field) => `      if (${field.name} !== undefined) patch.${field.name} = ${field.name};`,
  );

  return [
    `    async ${method.name}(${signatureParameters}): Promise<${method.returnTypeExpression}> {`,
    `      const patch: ${patchType} = {};`,
    ...assignLines,
    "      if (Object.keys(patch).length === 0) {",
    "        const [existing] = await db",
    "          .select()",
    `          .from(${table.exportName})`,
    `          .where(eq(${table.exportName}.${table.identityPropertyName}, ${pathParameter.name}))`,
    "          .limit(1);",
    `        return existing ? ${mapper}(existing) : undefined;`,
    "      }",
    "      const [row] = await db",
    `        .update(${table.exportName})`,
    "        .set(patch)",
    `        .where(eq(${table.exportName}.${table.identityPropertyName}, ${pathParameter.name}))`,
    "        .returning();",
    `      return row ? ${mapper}(row) : undefined;`,
    "    }",
  ].join("\n");
}

function stripUndefined(typeExpression: string): string {
  return typeExpression
    .replace(/\s*\|\s*undefined\b/g, "")
    .replace(/\bundefined\s*\|\s*/g, "")
    .trim();
}
