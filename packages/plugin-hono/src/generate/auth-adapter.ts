import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import { AUTH_ADAPTER_FILE_PATH } from "../model/derive.ts";
import { relativeImportPath } from "../model/paths.ts";

export function renderAuthAdapterFile(): GeneratedFile {
  const imports: ImportDeclaration[] = [
    {
      from: relativeImportPath(AUTH_ADAPTER_FILE_PATH, "src/core/ports/authenticator.ts"),
      names: ["Authenticator"],
      typeOnly: true,
    },
  ];

  return {
    path: AUTH_ADAPTER_FILE_PATH,
    contents: renderSourceFile({
      imports,
      statements: [
        [
          "export function createInMemoryAuthenticator(options: {",
          "  bearerTokens?: ReadonlySet<string>;",
          "  apiKeys?: ReadonlyMap<string, ReadonlySet<string>>;",
          "}): Authenticator {",
          "  return {",
          "    async authenticate(credentials) {",
          '      if (credentials.kind === "bearer") {',
          "        if (!options.bearerTokens?.has(credentials.token)) return null;",
          '        return { id: "bearer-user", scheme: "bearerAuth", scopes: [] };',
          "      }",
          "",
          "      const allowed = options.apiKeys?.get(credentials.headerName.toLowerCase());",
          "      if (!allowed?.has(credentials.apiKey)) return null;",
          '      return { id: "api-key-user", scheme: "apiKey", scopes: [] };',
          "    },",
          "  };",
          "}",
        ].join("\n"),
      ],
    }),
    ownership: "generated",
  };
}
