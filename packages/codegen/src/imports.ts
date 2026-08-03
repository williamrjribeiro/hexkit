export type ImportDeclaration = {
  from: string;
  names: readonly string[];
  typeOnly?: boolean;
};

type NormalizedImport = {
  from: string;
  names: Set<string>;
  typeOnly: boolean;
};

export function renderImports(imports: readonly ImportDeclaration[]): string {
  const normalized = new Map<string, NormalizedImport>();

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
    .sort(compareImports)
    .map(renderImport)
    .join("\n");
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
  const names = [...declaration.names].sort(compareText).join(", ");
  return `${keyword} { ${names} } from "${declaration.from}";`;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
