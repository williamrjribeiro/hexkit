import { compareText } from "./text.ts";

export type ImportDeclaration = {
  from: string;
  names: readonly string[];
  typeOnly?: boolean;
};

export type NormalizedImport = {
  from: string;
  names: readonly string[];
  typeOnly: boolean;
};

type MutableNormalizedImport = {
  from: string;
  names: Set<string>;
  typeOnly: boolean;
};

export function mergeImports(imports: readonly ImportDeclaration[]): readonly NormalizedImport[] {
  const normalized = new Map<string, MutableNormalizedImport>();

  for (const declaration of imports) {
    const typeOnly = declaration.typeOnly ?? false;
    const key = `${declaration.from}\0${String(typeOnly)}`;
    const existing = normalized.get(key);

    if (existing) {
      for (const name of declaration.names) {
        existing.names.add(name);
      }
      continue;
    }

    normalized.set(key, {
      from: declaration.from,
      names: new Set(declaration.names),
      typeOnly,
    });
  }

  return [...normalized.values()]
    .filter(({ names }) => names.size > 0)
    .map((declaration) => ({
      from: declaration.from,
      names: [...declaration.names].toSorted(compareText),
      typeOnly: declaration.typeOnly,
    }));
}

export function renderImports(imports: readonly ImportDeclaration[]): string {
  return mergeImports(imports).toSorted(compareImports).map(renderImport).join("\n");
}

function compareImports(left: NormalizedImport, right: NormalizedImport): number {
  const moduleOrder = compareText(left.from, right.from);
  if (moduleOrder !== 0) {
    return moduleOrder;
  }

  return Number(left.typeOnly) - Number(right.typeOnly);
}

function renderImport(declaration: NormalizedImport): string {
  const keyword = declaration.typeOnly ? "import type" : "import";
  const names = declaration.names.join(", ");
  return `${keyword} { ${names} } from "${declaration.from}";`;
}
