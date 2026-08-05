import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

export function renderPrincipalFile(): GeneratedFile {
  return {
    path: "src/core/domain/principal.ts",
    contents: renderSourceFile({
      statements: [
        [
          "export type Principal = {",
          "  id: string;",
          "  scheme: string;",
          "  scopes: readonly string[];",
          "};",
        ].join("\n"),
      ],
    }),
    ownership: "generated",
  };
}
