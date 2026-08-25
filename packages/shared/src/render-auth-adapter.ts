import type { ImportDeclaration } from "@hexkit/codegen";
import { relativeImportPath, renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

import { IN_MEMORY_AUTH_ADAPTER_PATH } from "./security-render.ts";

/**
 * Emit the shared in-memory `Authenticator` adapter used by Hono and Next.
 *
 * @param filePath - Destination path. Defaults to {@link IN_MEMORY_AUTH_ADAPTER_PATH}.
 */
export function renderInMemoryAuthAdapterFile(
  filePath: string = IN_MEMORY_AUTH_ADAPTER_PATH,
): GeneratedFile {
  const imports: ImportDeclaration[] = [
    {
      from: relativeImportPath(filePath, "src/core/ports/authenticator.ts"),
      names: ["Authenticator"],
      typeOnly: true,
    },
  ];

  return {
    path: filePath,
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
          '        return { id: "bearer-user", scheme: credentials.schemeName, scopes: [] };',
          "      }",
          "",
          "      const allowed = options.apiKeys?.get(credentials.headerName.toLowerCase());",
          "      if (!allowed?.has(credentials.apiKey)) return null;",
          '      return { id: "api-key-user", scheme: credentials.schemeName, scopes: [] };',
          "    }",
          "  };",
          "}",
        ].join("\n"),
      ],
    }),
    ownership: "generated",
  };
}
