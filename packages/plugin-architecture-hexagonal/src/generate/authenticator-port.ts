import type { ImportDeclaration } from "@hexkit/codegen";
import { renderSourceFile } from "@hexkit/codegen";
import type { GeneratedFile } from "@hexkit/plugin-api";

export function renderAuthenticatorPortFile(): GeneratedFile {
  const imports: ImportDeclaration[] = [
    {
      from: "../domain/auth-principal.ts",
      names: ["Principal"],
      typeOnly: true,
    },
  ];

  return {
    path: "src/core/ports/authenticator.ts",
    contents: renderSourceFile({
      imports,
      statements: [
        [
          "export type AuthCredentials =",
          '  | { kind: "bearer"; schemeName: string; token: string }',
          '  | { kind: "apiKey"; schemeName: string; headerName: string; apiKey: string };',
        ].join("\n"),
        [
          "export type Authenticator = {",
          "  authenticate(credentials: AuthCredentials): Promise<Principal | null>;",
          "};",
        ].join("\n"),
      ],
    }),
    ownership: "generated",
  };
}
