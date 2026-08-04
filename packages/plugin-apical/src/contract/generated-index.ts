import { posix } from "node:path";

import { parse } from "@babel/parser";

export type GeneratedApicalModules = {
  schemas: ReadonlyMap<string, string>;
  operations: ReadonlyMap<string, string>;
};

type ImportedBinding = {
  importedName: string;
  moduleSpecifier: string;
};

function parseIndex(source: string, fileName: string): ReturnType<typeof parse> {
  try {
    return parse(source, {
      sourceFilename: fileName,
      sourceType: "module",
      plugins: ["typescript"],
    });
  } catch (error) {
    throw new Error(
      `Unable to parse Apical index "${fileName}": ${
        error instanceof Error ? error.message : String(error)
      }`,
      { cause: error },
    );
  }
}

function collectImports(sourceFile: ReturnType<typeof parse>): Map<string, ImportedBinding> {
  const imports = new Map<string, ImportedBinding>();

  for (const statement of sourceFile.program.body) {
    if (statement.type !== "ImportDeclaration") continue;

    for (const specifier of statement.specifiers) {
      if (specifier.type !== "ImportSpecifier") continue;
      imports.set(specifier.local.name, {
        importedName:
          specifier.imported.type === "Identifier"
            ? specifier.imported.name
            : specifier.imported.value,
        moduleSpecifier: statement.source.value,
      });
    }
  }

  return imports;
}

function generatedModulePath(indexDirectory: string, moduleSpecifier: string): string {
  if (!moduleSpecifier.startsWith(".")) {
    throw new Error(
      `Apical generated index references external module "${moduleSpecifier}"; expected a relative module.`,
    );
  }

  const path = posix.normalize(posix.join(indexDirectory, moduleSpecifier));
  return posix.extname(path) === "" ? `${path}.ts` : path;
}

export function inspectSchemaIndex(source: string): ReadonlyMap<string, string> {
  const sourceFile = parseIndex(source, "schemas/index.ts");
  const imports = collectImports(sourceFile);
  const schemas = new Map<string, string>();

  for (const statement of sourceFile.program.body) {
    if (statement.type !== "ExportNamedDeclaration") continue;

    for (const specifier of statement.specifiers) {
      if (specifier.type !== "ExportSpecifier") continue;
      const exportedName =
        specifier.exported.type === "Identifier"
          ? specifier.exported.name
          : specifier.exported.value;
      const localName = specifier.local.name;

      if (statement.source !== null && statement.source !== undefined) {
        schemas.set(exportedName, generatedModulePath("schemas", statement.source.value));
        continue;
      }

      const importedBinding = imports.get(localName);
      if (importedBinding !== undefined && importedBinding.importedName === exportedName) {
        schemas.set(exportedName, generatedModulePath("schemas", importedBinding.moduleSpecifier));
      }
    }
  }

  return schemas;
}

export function inspectRoutesIndex(source: string): ReadonlyMap<string, string> {
  const sourceFile = parseIndex(source, "routes/index.ts");
  const imports = collectImports(sourceFile);
  const operations = new Map<string, string>();

  for (const statement of sourceFile.program.body) {
    if (
      statement.type !== "ExportNamedDeclaration" ||
      statement.declaration?.type !== "VariableDeclaration"
    ) {
      continue;
    }

    for (const declaration of statement.declaration.declarations) {
      if (declaration.id.type !== "Identifier" || declaration.id.name !== "routes") continue;
      if (declaration.init === null || declaration.init === undefined) continue;

      let initializer = declaration.init;
      while (
        initializer.type === "TSAsExpression" ||
        initializer.type === "TSSatisfiesExpression" ||
        initializer.type === "TypeCastExpression"
      ) {
        initializer = initializer.expression;
      }
      if (initializer.type !== "ObjectExpression") {
        throw new Error('Apical export "routes" must be an object literal.');
      }

      for (const property of initializer.properties) {
        if (
          property.type !== "ObjectProperty" ||
          property.computed ||
          property.value.type !== "Identifier"
        ) {
          throw new Error(
            'Apical route registry contains an unsupported entry in "routes/index.ts".',
          );
        }
        const operationId =
          property.key.type === "Identifier"
            ? property.key.name
            : property.key.type === "StringLiteral"
              ? property.key.value
              : property.key.type === "NumericLiteral"
                ? String(property.key.value)
                : undefined;
        if (operationId === undefined) {
          throw new Error('Apical index "routes/index.ts" contains a computed route key.');
        }
        const localName = property.value.name;

        const importedBinding = imports.get(localName);
        if (importedBinding === undefined || importedBinding.importedName !== "serverRoute") {
          throw new Error(
            `Apical route "${operationId}" is not backed by an imported serverRoute module.`,
          );
        }

        operations.set(operationId, generatedModulePath("routes", importedBinding.moduleSpecifier));
      }
    }
  }

  return operations;
}

export function inspectGeneratedIndexes(
  schemasIndex: string,
  routesIndex: string,
): GeneratedApicalModules {
  return {
    schemas: inspectSchemaIndex(schemasIndex),
    operations: inspectRoutesIndex(routesIndex),
  };
}
