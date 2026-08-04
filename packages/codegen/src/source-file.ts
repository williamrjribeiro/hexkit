import { renderImports, type ImportDeclaration } from "./imports.ts";

export type SourceFile = {
  imports?: readonly ImportDeclaration[];
  statements: readonly string[];
};

export function renderSourceFile(sourceFile: SourceFile): string {
  const sections = [
    renderImports(sourceFile.imports ?? []),
    sourceFile.statements.filter((statement) => statement.length > 0).join("\n\n"),
  ].filter((section) => section.length > 0);

  return sections.length > 0 ? `${sections.join("\n\n")}\n` : "";
}
